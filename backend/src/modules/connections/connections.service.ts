import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TokenCipherService } from '../../common/crypto/token-cipher.service';
import { tokenHint } from '../../common/crypto/token-hint';
import {
  BusinessValidationException,
  ConnectionMissingException,
  ConnectionNameDuplicateException,
  ConnectionTokenMissingException,
  EntityNotFoundException,
} from '../../common/exceptions';
import { ForgeClientFactory } from '../forges/forge-client.factory';
import { ConnectionType } from '../forges/types/connection-type';
import { ForgeTestResult } from '../forges/types/forge-test-result';
import { Project } from '../projects/entities/project.entity';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { ConnectionResponseDto } from './dto/connection-response.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';

/** Manages the list of forge connections (RG-019-*). */
@Injectable()
export class ConnectionsService {
  constructor(
    @InjectRepository(Connection)
    private readonly repository: Repository<Connection>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    private readonly cipher: TokenCipherService,
    private readonly forges: ForgeClientFactory,
  ) {}

  /** Every connection, in the order they were added, with their repo count. */
  async list(): Promise<ConnectionResponseDto[]> {
    const connections = await this.repository.find({ order: { id: 'ASC' } });
    return Promise.all(
      connections.map(async (connection) =>
        this.toResponse(connection, await this.countProjects(connection.id)),
      ),
    );
  }

  /**
   * Adds a connection (RG-019-01 to RG-019-03).
   * @throws ForgeTypeUnsupportedException for `type: 'github'` (400, until US-020).
   * @throws BusinessValidationException when the URL cannot be normalised (400).
   * @throws ConnectionNameDuplicateException when the name is already used (400).
   */
  async add(dto: CreateConnectionDto): Promise<ConnectionResponseDto> {
    const forge = this.forges.forType(dto.type);
    const url = this.requireUrl(forge, dto.url);
    await this.assertNameAvailable(dto.name);
    const now = new Date().toISOString();
    const connection = await this.repository.save(
      this.repository.create({
        type: dto.type,
        name: dto.name.trim(),
        url,
        tokenEncrypted: this.cipher.encrypt(dto.token),
        meUsername: null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return this.toResponse(connection, 0);
  }

  /**
   * Updates a connection (RG-019-11) — `token` absent = unchanged (RG-019-03).
   * @throws EntityNotFoundException when `id` is unknown (404).
   * @throws BusinessValidationException when the new URL cannot be normalised (400).
   * @throws ConnectionNameDuplicateException when the new name is already used by another connection (400).
   */
  async update(
    id: number,
    dto: UpdateConnectionDto,
  ): Promise<ConnectionResponseDto> {
    const connection = await this.findOrThrow(id);
    // `!= null` (not `!== undefined`) on purpose: `@IsOptional()` lets a
    // literal `null` through DTO validation too (it only skips the other
    // validators, same pitfall as `SettingsService.mergeCommonFields`) —
    // treated the same as "absent" here, since none of these fields has a
    // "null clears the value" semantic (unlike `meEmail`, RG-002-02).
    if (dto.name != null) {
      await this.assertNameAvailable(dto.name, id);
      connection.name = dto.name.trim();
    }
    if (dto.url != null) {
      connection.url = this.requireUrl(
        this.forges.forType(connection.type),
        dto.url,
      );
    }
    if (dto.token != null) {
      connection.tokenEncrypted = this.cipher.encrypt(dto.token);
    }
    connection.updatedAt = new Date().toISOString();
    const saved = await this.repository.save(connection);
    return this.toResponse(saved, await this.countProjects(saved.id));
  }

  /**
   * Removes a connection (RG-019-13). Its repos, their merge requests and
   * users cascade at the database level.
   * @throws EntityNotFoundException when `id` is unknown (404).
   */
  async remove(id: number): Promise<void> {
    const connection = await this.findOrThrow(id);
    await this.repository.remove(connection);
  }

  /**
   * Tests a connection (RG-001-04, RG-019-14) — with the values submitted in
   * a form, or with the stored connection when `connectionId` is given and a
   * field is omitted.
   * @throws EntityNotFoundException when `connectionId` is given but unknown (404).
   * @throws BusinessValidationException when `type`/`url` cannot be resolved, or the resolved URL is invalid (400).
   * @throws ConnectionTokenMissingException when no token is available (409).
   */
  async test(dto: TestConnectionDto): Promise<ForgeTestResult> {
    const stored =
      dto.connectionId !== undefined
        ? await this.findOrThrow(dto.connectionId)
        : null;
    const type = dto.type ?? stored?.type;
    const rawUrl = dto.url ?? stored?.url;
    if (!type || !rawUrl) {
      throw new BusinessValidationException(
        'connections.missing',
        'type and url are required when connectionId is absent',
      );
    }
    const token =
      dto.token ??
      (stored?.tokenEncrypted
        ? this.cipher.decrypt(stored.tokenEncrypted)
        : null);
    if (!token) {
      throw new ConnectionTokenMissingException();
    }
    const forge = this.forges.forType(type);
    const url = this.requireUrl(forge, rawUrl);
    return forge.testConnection(url, token);
  }

  /**
   * Decrypted token for server-side use only (RG-001-10).
   * @throws EntityNotFoundException when `connectionId` is unknown.
   * @returns `null` when not configured or unreadable.
   */
  async getToken(connectionId: number): Promise<string | null> {
    const connection = await this.findOrThrow(connectionId);
    return connection.tokenEncrypted
      ? this.cipher.decrypt(connection.tokenEncrypted)
      : null;
  }

  /** Sets my username on a connection (RG-019-08), called by `SettingsService.update`. */
  async updateIdentity(connectionId: number, username: string): Promise<void> {
    const connection = await this.findOrThrow(connectionId);
    connection.meUsername = username.trim() || null;
    connection.updatedAt = new Date().toISOString();
    await this.repository.save(connection);
  }

  /**
   * Merges an imported connection by name (RG-019-19, case-insensitive):
   * updates `url`/`meUsername` of an existing connection without touching
   * its token, or creates a new one without a token when no match exists.
   * @returns the connection's own name (to resolve `ProjectsService.importMany`
   * entries) and whether it was newly created (always tokenless, RG-019-19 —
   * used by the caller to prompt the user to configure its token).
   * @throws BusinessValidationException when the URL cannot be normalised.
   */
  async importUpsert(entry: {
    type: ConnectionType;
    name: string;
    url: string;
    meUsername: string | null;
  }): Promise<{ name: string; created: boolean }> {
    const trimmedName = entry.name.trim();
    const existing = (await this.repository.find()).find(
      (c) => c.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    const url = this.requireUrl(this.forges.forType(entry.type), entry.url);
    const now = new Date().toISOString();
    if (existing) {
      existing.url = url;
      existing.meUsername = entry.meUsername;
      existing.updatedAt = now;
      await this.repository.save(existing);
      return { name: existing.name, created: false };
    }
    const created = await this.repository.save(
      this.repository.create({
        type: entry.type,
        name: trimmedName,
        url,
        tokenEncrypted: null,
        meUsername: entry.meUsername,
        createdAt: now,
        updatedAt: now,
      }),
    );
    return { name: created.name, created: true };
  }

  /**
   * Raw entities for internal, server-side use only — used by `SyncService`
   * to iterate every connection (RG-019-16).
   */
  async findAll(): Promise<Connection[]> {
    return this.repository.find({ order: { id: 'ASC' } });
  }

  /**
   * Raw entities for internal, server-side use only — used by
   * `MergeRequestsService.loadBase` to resolve `project.connectionId` in bulk.
   * @returns entities in no particular order; missing ids are silently omitted.
   */
  async findByIds(ids: number[]): Promise<Connection[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.repository.findBy({ id: In(ids) });
  }

  /**
   * Raw entity for internal, server-side use only.
   * @throws EntityNotFoundException when `id` is unknown (404) — also the
   * public 409 behaviour of `ProjectsService.add` (RG-019-15) relies on this
   * throwing, translated by the caller when appropriate.
   */
  async findOrThrow(id: number): Promise<Connection> {
    const connection = await this.repository.findOneBy({ id });
    if (!connection) {
      throw new EntityNotFoundException('Connection', id);
    }
    return connection;
  }

  /**
   * @throws ConnectionMissingException when no connection exists at all (409, RG-019-15).
   */
  async requireAny(): Promise<void> {
    const count = await this.repository.count();
    if (count === 0) {
      throw new ConnectionMissingException();
    }
  }

  private async countProjects(connectionId: number): Promise<number> {
    return this.projects.count({ where: { connectionId } });
  }

  private requireUrl(
    forge: { normalizeUrl(input: string): string | null },
    raw: string,
  ): string {
    const url = forge.normalizeUrl(raw);
    if (!url) {
      throw new BusinessValidationException(
        'connections.invalidUrl',
        'url must be an http(s) origin',
      );
    }
    return url;
  }

  private async assertNameAvailable(
    name: string,
    excludeId?: number,
  ): Promise<void> {
    const trimmed = name.trim();
    const clash = (await this.repository.find()).find(
      (c) =>
        c.id !== excludeId && c.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (clash) {
      throw new ConnectionNameDuplicateException();
    }
  }

  private toResponse(
    connection: Connection,
    projectsCount: number,
  ): ConnectionResponseDto {
    const token = connection.tokenEncrypted
      ? this.cipher.decrypt(connection.tokenEncrypted)
      : null;
    return {
      id: connection.id,
      type: connection.type,
      name: connection.name,
      url: connection.url,
      tokenConfigured: token !== null,
      tokenHint: token ? tokenHint(token) : null,
      meUsername: connection.meUsername,
      projectsCount,
    };
  }
}
