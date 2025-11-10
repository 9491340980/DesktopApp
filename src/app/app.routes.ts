import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from './services/auth';
import { Layout } from './shared/navigation/layout/layout';
import { authGuard } from './guard/auth-guard';




// Login Guard (redirect if already logged in)
export const loginGuard = () => {
  const authService = inject(Auth);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    router.navigate(['/dashboard']);
    return false;
  } else {
    return true;
  }
};

export const routes: Routes = [
    {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./auth/login/login').then(m => m.Login)
  },
  // {
  //   path: 'forgot-password',
  //   canActivate: [loginGuard],
  //   loadComponent: () => import('./auth/forgot-password/forgot-password').then(m => m.ForgotPassword)
  // },
  // {
  //   path: 'unauthorized',
  //   loadComponent: () => import('./shared/unauthorized/unauthorized').then(m => m.Unauthorized)
  // },
  {
    path: '',
    component: Layout, // All authenticated routes use this layout
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard)
      },  {
        path: 'windowsservices',
        loadComponent: () => import('./service-dashboard/service-dashboard').then(m => m.ServiceDashboard)
      },
      {
        path: 'ios-management',
        loadComponent: () => import('./ios-management/ios-management').then(m => m.IosManagement),
        // Example: Add roles if this route requires specific permissions
        // data: { roles: ['ADMIN', 'DEVELOPER', 'MANAGER'] }
      },

      // ADD NEW ROUTES HERE - They will automatically get the navigation bar!

      // Example routes with role-based access:
      /*
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports.component').then(m => m.ReportsComponent),
        data: { roles: ['ADMIN', 'MANAGER', 'DEVELOPER'] }
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent),
        data: { roles: ['ADMIN'] }
      },
      {
        path: 'user-management',
        loadComponent: () => import('./user-management/user-management.component').then(m => m.UserManagementComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'MANAGER'] }
      },
      {
        path: 'receiving',
        loadComponent: () => import('./receiving/receiving.component').then(m => m.ReceivingComponent),
        data: { roles: ['DEVELOPER', 'OPERATOR'] }
      },
      {
        path: 'audit',
        loadComponent: () => import('./audit/audit.component').then(m => m.AuditComponent),
        data: { roles: ['ADMIN', 'AUDITOR'] }
      }
      */
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
