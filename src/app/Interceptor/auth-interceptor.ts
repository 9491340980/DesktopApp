import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { Auth } from '../services/auth';

/**
 * HTTP Interceptor to add authentication token and handle errors
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // Get token from auth service
  const token = authService.getToken();

  // Clone request and add token if available
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Reset session timeout on API activity
  if (authService.isAuthenticated()) {
    authService.resetSessionTimeout();
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Handle 401 Unauthorized errors
      if (error.status === 401) {
        console.error('Unauthorized request - logging out');
        authService.logout(true, 'Your session has expired. Please login again.');
        return throwError(() => error);
      }

      // Handle 403 Forbidden errors
      if (error.status === 403) {
        console.error('Forbidden - insufficient permissions');
        router.navigate(['/unauthorized'], {
          queryParams: { reason: 'forbidden' }
        });
        return throwError(() => error);
      }

      // Handle other errors
      return throwError(() => error);
    })
  );
};
