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
import { DeviceService } from '../../services/device-service';
import { NotificationType, StorageKey } from '../../enums/app-constants.enum';

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
    MatSnackBarModule
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

  constructor(
    private loginService: LoginService,
    private cryptoService: CryptoService,
    private configService: ConfigService,
    private deviceService: DeviceService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
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

    // Initialize workstation details if not present
    if (!localStorage.getItem('WorkStationDetails')) {
      this.fetchWorkstationDetails();
    }
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

    // Get device ID first (from WorkStationDetails or API)
    const workstationName = localStorage.getItem('WorkStationName');
    const deviceId = workstationName || '';

    // If we have a workstation name, use it; otherwise, get from API
    if (deviceId) {
      this.performLogin(encryptedUsername, encryptedPassword, deviceId);
    } else {
      this.deviceService.getDeviceId().subscribe({
        next: (deviceId) => {
          this.performLogin(encryptedUsername, encryptedPassword, deviceId);
        },
        error: (error) => {
          console.error('Failed to get device ID:', error);
          // Proceed with login even if device ID fails
          this.performLogin(encryptedUsername, encryptedPassword, '');
        }
      });
    }
  }

  /**
   * Perform the actual login
   */
  private performLogin(
    encryptedUsername: string,
    encryptedPassword: string,
    deviceId: string
  ): void {
    // Get client name from config if needed (you can make this dynamic)
    const clientName = 'VERIZON'; // Or get from domain/user selection

    this.loginService.performLogin(
      encryptedUsername,
      encryptedPassword,
      deviceId,
      this.releaseVersion,
      clientName
    ).subscribe({
      next: (response: LoginResponse) => {
        console.log('Login successful:', response);
        console.log('Updated ClientData with Roles:', response.clientData);

        // Save all response data
        this.saveUserData(response);

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
   * The response now includes updated clientData with proper Roles
   */
  private saveUserData(response: LoginResponse): void {
    try {
      // ClientData is already saved in LoginService with Roles, but verify it's there
      if (response.clientData) {
        console.log('✅ ClientData saved with Roles:', response.clientData.Roles);
        // Re-save to ensure it's properly stored
        localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(response.clientData));
      }

      // Save control config
      if (response.config?.Response) {
        localStorage.setItem(StorageKey.CONTROL_CONFIG, JSON.stringify(response.config.Response));
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

      // Set module (for compatibility)
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
   * Fetch workstation details (if not already present)
   */
  private fetchWorkstationDetails(): void {
    // This would call your existing workstation details service
    // For now, just log that it should be fetched
    console.log('WorkStationDetails should be fetched here');
    // You can integrate with your existing masterPageService.fetchWorkstationDetails()
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
