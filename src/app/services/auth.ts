import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;

  // API Configuration
  private apiBaseUrl = 'https://qaapi-rmxt026.am.gxo.com:8333/api/';

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Load user from localStorage if exists
    const storedUser = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser = this.currentUserSubject.asObservable();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentUserValue;
  }

  /**
   * Login user
   */
  login(credentials: LoginCredentials): Observable<User> {
    const url = `${this.apiBaseUrl}auth/login`;

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(url, {
      username: credentials.username,
      password: credentials.password
    }, { headers }).pipe(
      map(response => {
        // Assuming API returns token and user info
        const user: User = {
          username: credentials.username,
          token: response.token || response.Token,
          roles: response.roles || ['USER']
        };

        // Store user
        if (credentials.rememberMe) {
          localStorage.setItem('currentUser', JSON.stringify(user));
        } else {
          sessionStorage.setItem('currentUser', JSON.stringify(user));
        }

        this.currentUserSubject.next(user);
        return user;
      })
    );
  }

  /**
   * Simple login (for demo/testing)
   */
  simpleLogin(credentials: LoginCredentials): boolean {
    // Demo credentials
    if (credentials.username === 'admin' && credentials.password === 'admin123') {
      const user: User = {
        username: credentials.username,
        token: 'demo-token-' + Date.now(),
        roles: ['ADMIN', 'USER']
      };

      // Store user
      if (credentials.rememberMe) {
        localStorage.setItem('currentUser', JSON.stringify(user));
      } else {
        sessionStorage.setItem('currentUser', JSON.stringify(user));
      }

      this.currentUserSubject.next(user);
      return true;
    }
    return false;
  }

  /**
   * Logout user
   */
  logout(): void {
    // Remove user from storage
    localStorage.removeItem('currentUser');
    sessionStorage.removeItem('currentUser');

    // Clear current user
    this.currentUserSubject.next(null);

    // Navigate to login
    this.router.navigate(['/login']);
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return this.currentUserValue?.token || null;
  }

  /**
   * Get username
   */
  getUsername(): string | null {
    return this.currentUserValue?.username || null;
  }

  /**
   * Check if user has role
   */
  hasRole(role: string): boolean {
    return this.currentUserValue?.roles.includes(role) || false;
  }
}
