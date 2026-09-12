import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ExportConfigDto } from './dto/export-config.dto';
import { ImportConfigDto } from './dto/import-config.dto';
import { ImportResultDto } from './dto/import-result.dto';
import { SettingsTransferService } from './settings-transfer.service';

/**
 * Export/import of the whole configuration (RG-015-03, RG-015-04). Shares
 * the `settings` route prefix with `SettingsController` — NestJS allows
 * several controllers on the same prefix as long as the paths differ.
 */
@Controller('settings')
export class SettingsTransferController {
  constructor(private readonly transfer: SettingsTransferService) {}

  /** `GET /api/v1/settings/export` */
  @Get('export')
  getExport(): Promise<ExportConfigDto> {
    return this.transfer.export();
  }

  /** `POST /api/v1/settings/import` */
  @Post('import')
  @HttpCode(200)
  postImport(@Body() dto: ImportConfigDto): Promise<ImportResultDto> {
    return this.transfer.import(dto);
  }
}
