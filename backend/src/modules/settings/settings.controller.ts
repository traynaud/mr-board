import { Body, Controller, Get, Put } from '@nestjs/common';
import { SettingsResponseDto } from './dto/settings-response.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SettingsService } from './settings.service.js';

/** REST facade of the global application preferences (RG-019-23). */
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /** `GET /api/v1/settings` */
  @Get()
  getSettings(): Promise<SettingsResponseDto> {
    return this.settingsService.get();
  }

  /** `PUT /api/v1/settings` */
  @Put()
  putSettings(@Body() dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    return this.settingsService.update(dto);
  }
}
