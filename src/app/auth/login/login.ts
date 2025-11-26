import { ConfigService } from './../../services/config-service';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LoginService, LoginResponse } from '../../services/login-service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CryptoService } from '../../services/crypto-service';
import { NotificationType, StorageKey } from '../../enums/app-constants.enum';
import { UpdateNotificationComponent } from "../../update-notification/update-notification.component/update-notification";

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    UpdateNotificationComponent
],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {
  username: string = '';
  password: string = '';
  rememberMe: boolean = false;

  // UI states
  loading: boolean = false;
  errorMessage: string = '';
  isCapLockOn: boolean = false;
  showPassword: boolean = false;

  // Environment info (from config)
  environment: string = '';
  releaseVersion: string = '';
  buildDate: any;

  constructor(
    private loginService: LoginService,
    private cryptoService: CryptoService,
    private configService: ConfigService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.buildDate = new Date().toString();

    // Check if already logged in
    const token = localStorage.getItem(StorageKey.TOKEN);
    if (token) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Load environment from config
    this.environment = this.configService.getEnvironment();
    this.releaseVersion = this.getAppVersion();

    // Check for timeout message
    this.route.queryParams.subscribe(params => {
      if (params['reason'] === 'timeout') {
        this.showSnackbar(
          'Your session has expired due to inactivity. Please login again.',
          NotificationType.WARNING
        );
      }
    });

    // Load remembered username
    this.loadRememberedCredentials();
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

    this.performLogin(encryptedUsername, encryptedPassword);
  }

  /**
   * Perform the actual login
   */
  private performLogin(
    encryptedUsername: string,
    encryptedPassword: string
  ): void {
    const clientName = 'VERIZON';

    this.loginService.performLogin(
      encryptedUsername,
      encryptedPassword,
      this.releaseVersion,
      clientName
    ).subscribe({
      next: (response: LoginResponse) => {

        // Save all response data
        this.saveUserData(response);

        // ✅ Check navigateTo signal
        if (response.navigateTo === 'user-profile') {
          // getUserProfile failed - navigate to user-profile page
          this.showSnackbar('Please complete your profile', NotificationType.INFO);

          setTimeout(() => {
            this.router.navigate(['/user-profile']);
          }, 500);

          return; // Don't continue with normal flow
        }

        // ✅ Normal flow - getUserProfile succeeded
        // Filter roles by site
        this.loginService.filterRolesBySite(response.clientData.SiteId);

        // Handle remember me
        if (this.rememberMe) {
          localStorage.setItem(StorageKey.REMEMBERED_USERNAME, this.username);
        } else {
          localStorage.removeItem(StorageKey.REMEMBERED_USERNAME);
        }

        // Show success message
        this.showSnackbar('Login successful! Welcome back.', NotificationType.SUCCESS);

        // Navigate to dashboard
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 500);
      },
      error: (error) => {
        this.loading = false;

        // Handle specific error cases
        if (error.details?.status === 401) {
          this.errorMessage = 'Invalid username or password';
        } else if (error.details?.status === 0) {
          this.errorMessage = 'Unable to connect to server. Please check your network connection.';
        } else {
          this.errorMessage = error.message || 'Login failed. Please try again.';
        }

        this.showSnackbar(this.errorMessage, NotificationType.ERROR);
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
      this.showSnackbar(this.errorMessage, NotificationType.ERROR);
      return false;
    }

    if (this.username.length < 3) {
      this.errorMessage = 'Username must be at least 3 characters';
      this.showSnackbar(this.errorMessage, NotificationType.ERROR);
      return false;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      this.showSnackbar(this.errorMessage, NotificationType.ERROR);
      return false;
    }

    return true;
  }

  /**
   * Save user data to localStorage
   */
 private saveUserData(response: LoginResponse): void {
  try {
    // Check if control config has default location
    let updatedClientData = response.clientData;

    if (response.config?.Response) {
      // Parse the JSON string ONCE
      const controlConfig = JSON.parse(response.config.Response);

      // Add defaultLocation temporarily (until it's in DB)
      controlConfig.defaultLocation = "RTN01";

      if (controlConfig.defaultLocation) {
        if (updatedClientData) {
          updatedClientData = {
            ...updatedClientData,
            Location: controlConfig.defaultLocation
          };
        }
      }

      // Save control config as JSON string (localStorage.setItem automatically stringifies if you pass object)
      // But it's better to be explicit
      localStorage.setItem(StorageKey.CONTROL_CONFIG, JSON.stringify(controlConfig));
    }

    // Save updated ClientData (with location if it was updated)
    if (updatedClientData) {
      localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(updatedClientData));
    }

    // Save session timeout
    if (response.sessionTime?.Response) {
      localStorage.setItem(StorageKey.SESSION_TIMEOUT, response.sessionTime.Response);
    }

    // Save menu
    if (response.menu?.Response) {
      localStorage.setItem(StorageKey.MENU, JSON.stringify(response.menu.Response));
    }

    // Save messages
    if (response.messages?.Response) {
      localStorage.setItem(StorageKey.MESSAGES, JSON.stringify(response.messages.Response));
    }

    // Set module
    localStorage.setItem('module', 'COM');

  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

  /**
   * Get app version
   */
  private getAppVersion(): string {
    return localStorage.getItem(StorageKey.RELEASE_VERSION) || '1.0.0';
  }

  /**
   * Load remembered credentials
   */
  private loadRememberedCredentials(): void {
    const rememberedUsername = localStorage.getItem(StorageKey.REMEMBERED_USERNAME);
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
  private showSnackbar(message: string, type: NotificationType): void {
    this.snackBar.open(message, 'Close', {
      duration: type === NotificationType.SUCCESS ? 3000 : 5000,
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
