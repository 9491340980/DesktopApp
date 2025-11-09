import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Auth } from '../services/auth';

/**
 * Auth Guard - Protects routes that require authentication
 */
export const authGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(Auth);
  const router = inject(Router);

  // Check if user is authenticated
  if (authService.isAuthenticated()) {
    // Check if route requires specific roles
    const requiredRoles = route.data['roles'] as string[];

    if (requiredRoles && requiredRoles.length > 0) {
      const user = authService.currentUserValue;
      const siteId = user?.siteId || authService.getUserSites()[0];

      // Check if user has any of the required roles
      const hasRequiredRole = authService.hasAnyRole(siteId, requiredRoles);

      if (!hasRequiredRole) {
        console.warn('User does not have required roles:', requiredRoles);
        router.navigate(['/unauthorized']);
        return false;
      }
    }

    // Reset session timeout on successful authentication check
    authService.resetSessionTimeout();

    return true;
  } else {
    // Redirect to login with return URL
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }
};

/**
 * Login Guard - Redirects to dashboard if already authenticated
 */
export const loginGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(Auth);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    // Check if there's a return URL
    const returnUrl = route.queryParams['returnUrl'];

    if (returnUrl) {
      router.navigate([returnUrl]);
    } else {
      router.navigate(['/dashboard']);
    }

    return false;
  }

  return true;
};

/**
 * Role Guard - Checks if user has specific role for a route
 * Usage: Add to route data -> data: { roles: ['ADMIN', 'MANAGER'] }
 */
export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(Auth);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login'], {
      queryParams: { returnUrl: state.url }
    });
    return false;
  }

  const requiredRoles = route.data['roles'] as string[];

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  const user = authService.currentUserValue;
  const siteId = user?.siteId || authService.getUserSites()[0];

  // Check if user has any of the required roles
  const hasRequiredRole = authService.hasAnyRole(siteId, requiredRoles);

  if (!hasRequiredRole) {
    console.warn('Access denied. Required roles:', requiredRoles);
    router.navigate(['/unauthorized'], {
      queryParams: {
        returnUrl: state.url,
        reason: 'insufficient_permissions'
      }
    });
    return false;
  }

  return true;
};

/**
 * Can Deactivate Guard - Prevents navigation if there are unsaved changes
 */
export interface CanComponentDeactivate {
  canDeactivate: () => boolean | Promise<boolean>;
}

export const canDeactivateGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const component = route.component as any;

  if (component && typeof component.canDeactivate === 'function') {
    return component.canDeactivate();
  }

  return true;
};
