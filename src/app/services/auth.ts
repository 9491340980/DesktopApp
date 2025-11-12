import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthUser } from '../models/api.models';
import { StorageKey } from '../enums/app-constants.enum';

export interface User {
  username: string;
  token: string;
  roles: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}


@Injectable({
  providedIn: 'root',
})
export class Auth {
   private currentUserSubject: BehaviorSubject<AuthUser | null>;
  public currentUser: Observable<AuthUser | null>;
  private sessionTimeoutId: any = null;
  private sessionWarningTimeoutId: any = null;

  constructor(private router: Router) {
    const storedUser = this.getUserFromStorage();
    this.currentUserSubject = new BehaviorSubject<AuthUser | null>(storedUser);
    this.currentUser = this.currentUserSubject.asObservable();

    // Start session timeout if user is authenticated
    if (storedUser) {
      this.startSessionTimeout();
    }
  }

  /**
   * Get current user value
   */
  public get currentUserValue(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    const token = this.getToken();

    if (!token) {
      return false;
    }

    // Check if token is expired
    if (this.isTokenExpired(token)) {
      this.logout(true);
      return false;
    }

    return true;
  }

  /**
   * Get authentication token
   */
  public getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Get user from localStorage
   */
  private getUserFromStorage(): AuthUser | null {
    try {
      const token = this.getToken();
      const userId = localStorage.getItem('userId');
      const username = localStorage.getItem('username');
      const clientId = localStorage.getItem('clientId');
      const siteId = localStorage.getItem('siteId');
      const rolesListStr = localStorage.getItem('rolesList');

      if (!token || !userId || !username) {
        return null;
      }

      const rolesList = rolesListStr ? JSON.parse(rolesListStr) : {};

      return {
        userId,
        username,
        clientId: clientId || '',
        siteId: siteId || '',
        roles: rolesList,
        token
      };
    } catch (error) {
      console.error('Error getting user from storage:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeToken(token);

      if (!payload || !payload.exp) {
        return true;
      }

      const expirationDate = new Date(payload.exp * 1000);
      const now = new Date();

      return expirationDate <= now;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true;
    }
  }

  /**
   * Decode JWT token
   */
  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Set authentication data after successful login
   */
  public setAuthData(user: AuthUser): void {
    this.currentUserSubject.next(user);
    this.startSessionTimeout();
  }

  /**
   * Start session timeout
   */
  private startSessionTimeout(): void {
    // Clear existing timeouts
    this.clearSessionTimeouts();

    // Get session timeout from localStorage (in seconds)
    const sessionTimeoutStr = localStorage.getItem('sessionTimeout');
    const sessionTimeout = sessionTimeoutStr ? parseInt(sessionTimeoutStr, 10) : 3600; // Default 1 hour

    // Convert to milliseconds
    const timeoutMs = sessionTimeout * 1000;
    const warningMs = timeoutMs - (5 * 60 * 1000); // Warn 5 minutes before timeout

    // Set warning timeout
    if (warningMs > 0) {
      this.sessionWarningTimeoutId = setTimeout(() => {
        this.handleSessionWarning();
      }, warningMs);
    }

    // Set logout timeout
    this.sessionTimeoutId = setTimeout(() => {
      this.logout(true, 'Session expired due to inactivity');
    }, timeoutMs);
  }

  /**
   * Handle session warning (5 minutes before timeout)
   */
  private handleSessionWarning(): void {
    // You can show a warning dialog here
    console.warn('Session will expire in 5 minutes');

    // Emit event or show notification
    // this.sessionWarningSubject.next(true);
  }

  /**
   * Clear session timeouts
   */
  private clearSessionTimeouts(): void {
    if (this.sessionTimeoutId) {
      clearTimeout(this.sessionTimeoutId);
      this.sessionTimeoutId = null;
    }
    if (this.sessionWarningTimeoutId) {
      clearTimeout(this.sessionWarningTimeoutId);
      this.sessionWarningTimeoutId = null;
    }
  }

  /**
   * Reset session timeout (call on user activity)
   */
  public resetSessionTimeout(): void {
    if (this.isAuthenticated()) {
      this.startSessionTimeout();
    }
  }

  /**
   * Check if user has specific role
   */
  public hasRole(siteId: string, role: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.roles) {
      return false;
    }

    const siteRoles = user.roles[siteId];
    return siteRoles ? siteRoles.includes(role) : false;
  }

  /**
   * Check if user has any of the specified roles
   */
  public hasAnyRole(siteId: string, roles: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.roles) {
      return false;
    }

    const siteRoles = user.roles[siteId];
    if (!siteRoles) {
      return false;
    }

    return roles.some(role => siteRoles.includes(role));
  }

  /**
   * Get user roles for specific site
   */
  public getUserRoles(siteId: string): string[] {
    const user = this.currentUserValue;
    if (!user || !user.roles) {
      return [];
    }

    return user.roles[siteId] || [];
  }

  /**
   * Get all user sites
   */
  public getUserSites(): string[] {
    const user = this.currentUserValue;
    if (!user || !user.roles) {
      return [];
    }

    return Object.keys(user.roles);
  }

  /**
   * Logout user
   */
  public logout(isTimeout: boolean = false, message?: string): void {
    // Clear session timeouts
    this.clearSessionTimeouts();

    // Clear localStorage
    const keysToRemove = [
      'token',
      'userId',
      'username',
      'clientId',
      'siteId',
      'location',
      'rolesList',
      'siteIds',
      'userProfile',
      'session',
      'controlConfig',
      'sessionTimeout',
      'menu',
      'messages'
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Update current user
    this.currentUserSubject.next(null);

    // Navigate to login with reason
    if (isTimeout) {
      this.router.navigate(['/login'], {
        queryParams: {
          reason: 'timeout',
          message: message || 'Your session has expired'
        }
      });
    } else {
      this.router.navigate(['/login']);
    }
  }

  /**
   * Check if current route requires authentication
   */
  public isProtectedRoute(url: string): boolean {
    const publicRoutes = ['/login', '/forgot-password', '/reset-password'];
    return !publicRoutes.some(route => url.startsWith(route));
  }

getUpdatedClientData(){
  if(localStorage.getItem(StorageKey.CLIENT_DATA)){
    const clientData:any=localStorage.getItem(StorageKey.CLIENT_DATA)
   return JSON.parse(clientData);
  }
}


  /**
   * Get client data for API calls
   */
  // public getClientData(): any {
  //   const user = this.currentUserValue;
  //   const deviceId = localStorage.getItem('deviceId') || '';
  //   const location = localStorage.getItem('location') || '';

  //   if (!user) {
  //     return {
  //       Location: location,
  //       ClientId: '9999',
  //       SiteId: 'LOGIN',
  //       LoggedInUser: '',
  //       DeviceId: deviceId
  //     };
  //   }

  //   const siteId = user.siteId || this.getUserSites()[0] || '';
  //   const roles = this.getUserRoles(siteId);

  //   return {
  //     Location: location,
  //     ClientId: user.clientId,
  //     SiteId: siteId,
  //     LoggedInUser: user.userId,
  //     DeviceId: deviceId,
  //     Roles: roles
  //   };
  // }

  /**
   * Update user profile
   */
  public updateUserProfile(profileData: any): void {
    const currentUser = this.currentUserValue;
    if (currentUser) {
      const updatedUser: AuthUser = {
        ...currentUser,
        ...profileData
      };
      this.currentUserSubject.next(updatedUser);
    }
  }

  /**
   * Refresh token (if your backend supports token refresh)
   */
  public async refreshToken(): Promise<boolean> {
    try {
      // TODO: Implement token refresh logic with your backend
      // const response = await this.httpService.post('/auth/refresh-token', {...}).toPromise();
      // if (response.Status === 'PASS') {
      //   localStorage.setItem('token', response.Response.Token);
      //   return true;
      // }
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }
}
