import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../api/api-error';

interface BackendErrorBody {
  statusCode?: number;
  message?: string | string[];
  code?: string;
}

/** Convertit toute `HttpErrorResponse` en {@link ApiError}. */
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const body: BackendErrorBody | null =
          typeof error.error === 'object' ? (error.error as BackendErrorBody) : null;
        const message = Array.isArray(body?.message)
          ? body.message.join(', ')
          : (body?.message ?? error.message);
        return throwError(() => new ApiError(error.status, body?.code, message));
      }
      return throwError(() => error);
    }),
  );
