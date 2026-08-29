import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthResponse, AuthService } from '../services/auth.service';

/** Endpoints that must never trigger a refresh, or a failed refresh would retry itself forever. */
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

/** Shared across concurrent 401s so a burst of requests triggers one refresh, not many. */
let inFlightRefresh: Observable<AuthResponse> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((error: HttpErrorResponse) => {
      const refreshable = error.status === 401 && auth.refreshToken() && !NO_REFRESH.some((path) => req.url.includes(path));
      if (!refreshable) return throwError(() => error);

      inFlightRefresh ??= auth.refresh().pipe(shareReplay(1));
      return inFlightRefresh.pipe(
        catchError((refreshError) => {
          inFlightRefresh = null;
          auth.logout();
          return throwError(() => refreshError);
        }),
        switchMap((fresh) => {
          inFlightRefresh = null;
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${fresh.access_token}` } }));
        })
      );
    })
  );
};
