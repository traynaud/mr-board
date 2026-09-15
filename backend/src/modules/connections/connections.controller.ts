import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ForgeTestResult } from '../forges/types/forge-test-result.js';
import { ConnectionsService } from './connections.service.js';
import { ConnectionResponseDto } from './dto/connection-response.dto.js';
import { CreateConnectionDto } from './dto/create-connection.dto.js';
import { TestConnectionDto } from './dto/test-connection.dto.js';
import { UpdateConnectionDto } from './dto/update-connection.dto.js';

/** REST facade of the configured forge connections (RG-019-22). */
@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  /** `GET /api/v1/connections` */
  @Get()
  list(): Promise<ConnectionResponseDto[]> {
    return this.connectionsService.list();
  }

  /** `POST /api/v1/connections` */
  @Post()
  add(@Body() dto: CreateConnectionDto): Promise<ConnectionResponseDto> {
    return this.connectionsService.add(dto);
  }

  /** `POST /api/v1/connections/test` */
  @Post('test')
  test(@Body() dto: TestConnectionDto): Promise<ForgeTestResult> {
    return this.connectionsService.test(dto);
  }

  /** `PUT /api/v1/connections/:id` */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConnectionDto,
  ): Promise<ConnectionResponseDto> {
    return this.connectionsService.update(id, dto);
  }

  /** `DELETE /api/v1/connections/:id` */
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.connectionsService.remove(id);
  }
}
