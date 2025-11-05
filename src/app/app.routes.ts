import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from './services/auth';
import { Layout } from './shared/navigation/layout/layout';


// Auth Guard
export const authGuard = () => {
  const authService = inject(Auth);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};

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
  {
    path: '',
    component: Layout, // All authenticated routes use this layout
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard').then(m => m.Dashboard)
      },
      {
        path: 'ios-management',
        loadComponent: () => import('./ios-management/ios-management').then(m => m.IosManagement)
      }
      // ADD NEW ROUTES HERE - They will automatically get the navigation bar!
      /*
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports.component').then(m => m.ReportsComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./settings/settings.component').then(m => m.SettingsComponent)
      }
      */
    ]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
