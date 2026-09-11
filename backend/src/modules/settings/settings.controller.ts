import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { SettingsResponseDto } from './dto/settings-response.dto';
import { TestConnectionResultDto } from './dto/test-connection-result.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

/** REST facade of the application settings. */
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

  /** `POST /api/v1/settings/test-connection` */
  @Post('test-connection')
  @HttpCode(200)
  postTestConnection(
    @Body() dto: TestConnectionDto,
  ): Promise<TestConnectionResultDto> {
    return this.settingsService.testConnection(dto);
  }
}
