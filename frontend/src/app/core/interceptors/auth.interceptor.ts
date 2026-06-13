import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(authed).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.refreshToken()) {
        return auth.refresh().pipe(switchMap((fresh) => next(req.clone({ setHeaders: { Authorization: `Bearer ${fresh.access_token}` } }))));
      }
      return throwError(() => error);
    })
  );
};
