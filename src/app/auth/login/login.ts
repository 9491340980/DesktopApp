import { Component } from '@angular/core';
import { Auth } from '../../services/auth';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginService } from '../../services/login-service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CryptoService } from '../../services/crypto-service';

@Component({
  selector: 'app-login',
  imports: [CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  username: string = '';
  password: string = '';
  rememberMe: boolean = false;

  // UI states
  loading: boolean = false;
  errorMessage: string = '';
  isCapLockOn: boolean = false;
  showPassword: boolean = false;

  // Environment info
  environment: string = 'DEV'; // Can be changed to PROD, UAT, etc.
  releaseVersion: string = '1.0.0';

  constructor(
    private loginService: LoginService,
    private cryptoService: CryptoService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    // Check if already logged in
    const token = localStorage.getItem('token');
    if (token) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Check for timeout message
    this.route.queryParams.subscribe(params => {
      if (params['reason'] === 'timeout') {
        this.showSnackbar(
          'Your session has expired due to inactivity. Please login again.',
          'warning'
        );
      }
    });

    // Load remembered username
    this.loadRememberedCredentials();

    // Get release version from package or config
    this.releaseVersion = this.getAppVersion();
  }

  ngOnDestroy(): void {
    this.clearError();
  }

  /**
   * Handle form submission
   */
  onSubmit(): void {
    // Validate inputs
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    // Encrypt credentials
    const encryptedUsername = this.cryptoService.encrypt(this.username.toLowerCase());
    const encryptedPassword = this.cryptoService.encrypt(this.password);

    // Get device ID
    const deviceId = this.getDeviceId();

    // Perform login
    this.loginService.performLogin(
      encryptedUsername,
      encryptedPassword,
      deviceId,
      this.releaseVersion
    ).subscribe({
      next: (response: any) => {
        console.log('Login successful:', response);

        // Save user data
        this.saveUserData(response);

        // Handle remember me
        if (this.rememberMe) {
          localStorage.setItem('rememberedUsername', this.username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
debugger
        // Show success message
        this.showSnackbar('Login successful! Welcome back.', 'success');

        // Navigate to dashboard
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 500);
      },
      error: (error) => {
        console.error('Login failed:', error);
        this.loading = false;

        // Handle specific error cases
        if (error.details?.status === 401) {
          this.errorMessage = 'Invalid username or password';
        } else if (error.details?.status === 0) {
          this.errorMessage = 'Unable to connect to server. Please check your network connection.';
        } else {
          this.errorMessage = error.message || 'Login failed. Please try again.';
        }

        this.showSnackbar(this.errorMessage, 'error');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  /**
   * Validate form inputs
   */
  private validateForm(): boolean {
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter username and password';
      this.showSnackbar(this.errorMessage, 'error');
      return false;
    }

    if (this.username.length < 3) {
      this.errorMessage = 'Username must be at least 3 characters';
      this.showSnackbar(this.errorMessage, 'error');
      return false;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      this.showSnackbar(this.errorMessage, 'error');
      return false;
    }

    return true;
  }

  /**
   * Save user data to localStorage
   */
  private saveUserData(response: any): void {
    try {
      // Save token
      if (response.roles?.Response?.Token) {
        localStorage.setItem('token', response.roles.Response.Token);
      }

      // Save roles
      if (response.roles?.Response?.rolesList) {
        localStorage.setItem('rolesList', JSON.stringify(response.roles.Response.rolesList));
        localStorage.setItem('siteIds', JSON.stringify(Object.keys(response.roles.Response.rolesList)));
      }

      // Save user profile
      if (response.profile?.Response?.UserProfile) {
        const profile = response.profile.Response.UserProfile;
        localStorage.setItem('userProfile', JSON.stringify(profile));
        localStorage.setItem('clientId', profile.ClientId);
        localStorage.setItem('siteId', profile.SiteId);
        localStorage.setItem('location', profile.Loc);
        localStorage.setItem('userId', profile.UserId);
      }

      // Save session
      if (response.profile?.Response?.Session) {
        localStorage.setItem('session', JSON.stringify(response.profile.Response.Session));
      }

      // Save control config
      if (response.config?.Response) {
        localStorage.setItem('controlConfig', response.config.Response);
      }

      // Save session timeout
      if (response.sessionTime?.Response) {
        localStorage.setItem('sessionTimeout', response.sessionTime.Response);
      }

      // Save menu
      if (response.menu?.Response) {
        localStorage.setItem('menu', JSON.stringify(response.menu.Response));
      }

      // Save messages
      if (response.messages?.Response) {
        localStorage.setItem('messages', JSON.stringify(response.messages.Response));
      }

      // Save username for display
      localStorage.setItem('username', this.username);

    } catch (error) {
      console.error('Error saving user data:', error);
    }
  }

  /**
   * Get or create device ID
   */
  private getDeviceId(): string {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      // Try to get computer name or generate unique ID
      deviceId = this.generateDeviceId();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Generate unique device ID
   */
  private generateDeviceId(): string {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const timestamp = Date.now();

    // Create a simple unique ID based on browser info
    const uniqueString = `${userAgent}-${platform}-${timestamp}`;
    const hash = this.simpleHash(uniqueString);

    return `WEB_${hash.substring(0, 12).toUpperCase()}`;
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Get app version
   */
  private getAppVersion(): string {
    return localStorage.getItem('releaseVersion') || '1.0.0';
  }

  /**
   * Load remembered credentials
   */
  private loadRememberedCredentials(): void {
    const rememberedUsername = localStorage.getItem('rememberedUsername');
    if (rememberedUsername) {
      this.username = rememberedUsername;
      this.rememberMe = true;
    }
  }

  /**
   * Check Caps Lock status
   */
  checkCapsLock(event: KeyboardEvent): void {
    const capsOn = event.getModifierState && event.getModifierState('CapsLock');
    this.isCapLockOn = capsOn || false;
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  /**
   * Clear error message
   */
  clearError(): void {
    this.errorMessage = '';
  }

  /**
   * Handle forgot password
   */
  forgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }

  /**
   * Show snackbar notification
   */
  private showSnackbar(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: type === 'success' ? 3000 : 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: [`${type}-snackbar`]
    });
  }

  /**
   * Handle Enter key press
   */
  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.username && this.password && !this.loading) {
      this.onSubmit();
    }
  }
}
