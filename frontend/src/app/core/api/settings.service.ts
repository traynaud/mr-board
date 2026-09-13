import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ExportConfig,
  ImportConfig,
  ImportResult,
  Settings,
  UpdateSettingsRequest,
} from '../../models/settings.model';

/** Accès HTTP aux paramètres. Appelé uniquement par `SettingsStore`. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);

  /** `GET /api/v1/settings` */
  getSettings(): Observable<Settings> {
    return this.http.get<Settings>('api://settings');
  }

  /** `PUT /api/v1/settings` */
  putSettings(request: UpdateSettingsRequest): Observable<Settings> {
    return this.http.put<Settings>('api://settings', request);
  }

  /** `GET /api/v1/settings/export` */
  getExportConfig(): Observable<ExportConfig> {
    return this.http.get<ExportConfig>('api://settings/export');
  }

  /** `POST /api/v1/settings/import` */
  postImportConfig(request: ImportConfig): Observable<ImportResult> {
    return this.http.post<ImportResult>('api://settings/import', request);
  }
}
