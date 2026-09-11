import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateProjectRequest,
  Project,
  UpdateProjectRequest,
} from '../../models/project.model';

/** Accès HTTP aux repos configurés. Appelé uniquement par `ProjectsStore`. */
@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);

  /** `GET /api/v1/projects` */
  getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>('api://projects');
  }

  /** `POST /api/v1/projects` */
  postProject(request: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>('api://projects', request);
  }

  /** `PUT /api/v1/projects/:id` */
  putProject(id: number, request: UpdateProjectRequest): Observable<Project> {
    return this.http.put<Project>(`api://projects/${id}`, request);
  }

  /** `DELETE /api/v1/projects/:id` */
  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`api://projects/${id}`);
  }
}
