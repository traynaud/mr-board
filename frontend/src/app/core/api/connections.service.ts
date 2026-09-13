import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Connection,
  CreateConnectionRequest,
  TestConnectionRequest,
  TestConnectionResult,
  UpdateConnectionRequest,
} from '../../models/connection.model';

/** Accès HTTP aux connexions. Appelé uniquement par `ConnectionsStore`. */
@Injectable({ providedIn: 'root' })
export class ConnectionsService {
  private readonly http = inject(HttpClient);

  /** `GET /api/v1/connections` */
  getConnections(): Observable<Connection[]> {
    return this.http.get<Connection[]>('api://connections');
  }

  /** `POST /api/v1/connections` */
  postConnection(request: CreateConnectionRequest): Observable<Connection> {
    return this.http.post<Connection>('api://connections', request);
  }

  /** `PUT /api/v1/connections/:id` */
  putConnection(id: number, request: UpdateConnectionRequest): Observable<Connection> {
    return this.http.put<Connection>(`api://connections/${id}`, request);
  }

  /** `DELETE /api/v1/connections/:id` */
  deleteConnection(id: number): Observable<void> {
    return this.http.delete<void>(`api://connections/${id}`);
  }

  /** `POST /api/v1/connections/test` */
  postTestConnection(request: TestConnectionRequest): Observable<TestConnectionResult> {
    return this.http.post<TestConnectionResult>('api://connections/test', request);
  }
}
