import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity.js';

/**
 * Persists favorite merge requests (RG-027-01/03), keyed by
 * (`projectId`, `iid`) (RG-027-04). Orphan rows are never purged here — the
 * `favorites.project_id` foreign key cascades on repo removal (RG-027-05).
 */
@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favorites: Repository<Favorite>,
  ) {}

  /** Every favorite, regardless of whether its merge request is currently synchronised (RG-027-05). */
  async list(): Promise<Favorite[]> {
    return this.favorites.find();
  }

  /** Idempotent: a no-op if `(projectId, iid)` is already a favorite. */
  async add(projectId: number, iid: number): Promise<void> {
    const existing = await this.favorites.findOneBy({ projectId, iid });
    if (existing) {
      return;
    }
    await this.favorites.insert({
      projectId,
      iid,
      createdAt: new Date().toISOString(),
    });
  }

  /** Idempotent: a no-op if `(projectId, iid)` was not a favorite. */
  async remove(projectId: number, iid: number): Promise<void> {
    await this.favorites.delete({ projectId, iid });
  }
}
