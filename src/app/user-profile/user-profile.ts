import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfigService } from '../services/config-service';
import { CommonService } from '../services/common-service';
import { LoginService } from '../services/login-service';
import { CryptoService } from '../services/crypto-service';
import { ConfigModule, NotificationType, StorageKey } from '../enums/app-constants.enum';
import { ClientData } from '../models/api.models';
import { catchError, forkJoin, of } from 'rxjs';

interface SiteIdOption {
  siteId: string;
  clientName: string;
}

interface ClientOption {
  ClientId: string;
  ClientName: string;
  Loc?: string;
}

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss',
})
export class UserProfile implements OnInit, OnDestroy {
  userForm: FormGroup;
  userName: string = '';
  siteIdOptions: SiteIdOption[] = [];
  client: ClientOption[] = [];
  userProfile: any = {};
  clientData: any = {};

  // UI states
  loading: boolean = false;
  isSiteIdChanged: boolean = false;
  isSiteIdChangedandSaved: boolean = false;
  isClientDisable: boolean = true;
  isLocationDisabled: boolean = true;
  isDeviceIdDisabled: boolean = true;
  clientDisabled: boolean = true;
  locationDisabled: boolean = true;
  enableWorkStationSaving: boolean = false;

  // Control config
  controlConfig: any = {};
  controlConfigs: any = {};
  currentProfile: any;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private configService: ConfigService,
    private commonService: CommonService,
    private loginService: LoginService,
    private cryptoService: CryptoService,
    private snackBar: MatSnackBar
  ) {
    // ✅ Initialize form - location is now optional
    this.userForm = this.fb.group({
      siteId: ['', Validators.required],
      clientId: ['', Validators.required],
      location: [''], // ✅ REMOVED Validators.required
      deviceId: [{ value: '', disabled: true }]
    });
  }

  ngOnInit(): void {
    // Load control configs if available
    if (localStorage.getItem(StorageKey.CONTROL_CONFIG)) {
      this.controlConfigs = JSON.parse(localStorage.getItem(StorageKey.CONTROL_CONFIG) || '{}');
      this.controlConfig = this.controlConfigs;
    }

    // Load client data from localStorage
    this.clientData = JSON.parse(localStorage.getItem(StorageKey.CLIENT_DATA) || '{}');

    // Load username
    this.userName = this.getUserName();

    // Set DeviceId from clientData or localStorage
    if (!this.controlConfigs?.checkDeviceId && localStorage.getItem(StorageKey.DEVICE_ID)) {
      this.clientData.DeviceId = localStorage.getItem(StorageKey.DEVICE_ID) || '';
    }
    this.userProfile.DeviceId = this.clientData.DeviceId;

    // DeviceId is always disabled
    this.isDeviceIdDisabled = this.userProfile.DeviceId ? true : false;

    // Load current user profile if exists
    const currentProfile = localStorage.getItem(StorageKey.USER_PROFILE);
    if (currentProfile) {
      this.currentProfile = JSON.parse(currentProfile);
      // Deep clone to avoid reference issues
      this.userProfile = JSON.parse(JSON.stringify(this.currentProfile));
    }

    // ✅ Get location from clientData or control config
    let defaultLocation = this.clientData.Location || '';

    // ✅ Check if control config has defaultLocation
    if (!defaultLocation && this.controlConfigs?.defaultLocation) {
      defaultLocation = this.controlConfigs.defaultLocation;
      console.log('Using defaultLocation from control config:', defaultLocation);
    }

    // ✅ Set location in userProfile and clientData if available
    if (defaultLocation) {
      this.userProfile.Loc = defaultLocation.toUpperCase();
      this.clientData.Location = defaultLocation.toUpperCase();
      // ✅ Location should be disabled when auto-populated
      this.isLocationDisabled = true;
      this.locationDisabled = true;
    }

    // Check if we have valid clientData (not LOGIN state)
    if (this.clientData && this.clientData.SiteId !== 'LOGIN' && this.clientData.SiteId !== '') {
      // Load clients for current site
      this.getStorer(this.clientData.SiteId);

      // Populate form with current profile
      if (this.userProfile) {
        this.disableControls(false);
        // ✅ Keep location disabled if it has a value
        if (this.userProfile.Loc) {
          this.isLocationDisabled = true;
          this.locationDisabled = true;
        }
      }
    } else {
      this.disableControls(true);
    }

    // Load site IDs
    this.loadSiteIds();

    // Populate form
    this.populateForm();

    // ✅ Subscribe to form changes to keep userProfile in sync
    this.subscribeToFormChanges();

    // Focus site ID
    this.siteIdFocus();
  }

  ngOnDestroy(): void {
    // Cleanup
  }

  /**
   * ✅ Subscribe to form value changes to keep userProfile in sync
   */
  private subscribeToFormChanges(): void {
    // ✅ Use valueChanges with getRawValue to include disabled fields
    this.userForm.valueChanges.subscribe(() => {
      const values = this.userForm.getRawValue();

      // Update userProfile with current form values
      if (values.siteId) {
        this.userProfile.SiteId = values.siteId;
      }
      if (values.clientId) {
        this.userProfile.ClientId = values.clientId;
      }
      // ✅ Update location even if disabled
      if (values.location !== undefined) {
        this.userProfile.Loc = values.location.toUpperCase();
      }

      // DeviceId is read-only but keep it synced
      this.userProfile.DeviceId = this.clientData.DeviceId;
    });
  }

  /**
   * Load site IDs from localStorage and config
   */
  private loadSiteIds(): void {
    const siteIds: string[] = JSON.parse(localStorage.getItem(StorageKey.SITE_IDS) || '[]');
    const clientsInfo = this.configService.getAllClients();

    this.siteIdOptions = [];
    clientsInfo.forEach(client => {
      client.siteIds.forEach(siteId => {
        if (siteIds.length && siteIds.indexOf(siteId) > -1) {
          this.siteIdOptions.push({
            siteId: siteId,
            clientName: client.clientName
          });
        }
      });
    });
  }

  /**
   * Get username from localStorage
   */
  private getUserName(): string {
    const username = localStorage.getItem(StorageKey.USERNAME);
    if (username && this.cryptoService) {
      try {
        return this.cryptoService.decrypt(username);
      } catch {
        return username;
      }
    }
    return 'User';
  }

  /**
   * Populate form with current profile
   */
  private populateForm(): void {
    this.userForm.patchValue({
      siteId: this.userProfile.SiteId || '',
      clientId: this.userProfile.ClientId || '',
      location: this.userProfile.Loc || '',
      deviceId: this.userProfile.DeviceId || this.clientData.DeviceId || ''
    });
  }

  /**
   * ✅ NEW: Call getControlConfig API and update location
   */
  private callGetControlConfig(updatedClientData: any, onSuccess?: (location: string) => void): void {
    console.log('📞 Calling getControlConfig with ClientData:', updatedClientData);

    this.loginService.getControlConfig(updatedClientData, ConfigModule.LOGIN).subscribe({
      next: (response) => {
        console.log('✅ getControlConfig response:', response);
        if (response.Status === 'PASS' && response.Response) {
          try {
            // Parse the JSON string
            const controlConfig = JSON.parse(response.Response);

            // ⚠️ Temporarily add defaultLocation (until it's in DB)
            controlConfig.defaultLocation = "RTN01";

            console.log('📋 Control Config:', controlConfig);

            // Save control config
            localStorage.setItem(StorageKey.CONTROL_CONFIG, JSON.stringify(controlConfig));
            this.controlConfigs = controlConfig;
            this.controlConfig = controlConfig;

            // ✅ Update location from defaultLocation if available
            if (controlConfig.defaultLocation) {
              const defaultLocation = controlConfig.defaultLocation.toUpperCase();
              console.log('✅ Default location found:', defaultLocation);

              // Update ClientData
              updatedClientData.Location = defaultLocation;
              this.clientData.Location = defaultLocation;

              // Update userProfile
              this.userProfile.Loc = defaultLocation;

              // Update form
              this.userForm.patchValue({
                location: defaultLocation
              });

              // Disable location field
              this.isLocationDisabled = true;
              this.locationDisabled = true;
              this.userForm.get('location')?.disable();

              console.log('✅ Location updated in ClientData:', this.clientData.Location);

              // Call success callback if provided
              if (onSuccess) {
                onSuccess(defaultLocation);
              }
            }
          } catch (error) {
            console.error('❌ Failed to parse control config:', error);
          }
        }
      },
      error: (error) => {
        console.error('❌ getControlConfig API failed:', error);
        // Don't block the flow if API fails
      }
    });
  }

  /**
   * Handle site ID change
   */
  changeSiteId(event: any): void {
    const siteId = event.target.value;
    const previousSiteId = this.userProfile.SiteId;

    // Check if changing back to current profile site
    if (this.currentProfile && this.currentProfile.SiteId === siteId) {
      // Restore current profile values
      this.userProfile.SiteId = this.currentProfile.SiteId;
      this.userProfile.Loc = this.currentProfile.Loc;
      this.userProfile.ClientId = this.currentProfile.ClientId;

      this.updateClientDataObj(this.currentProfile);
      this.isSiteIdChanged = false;
      this.isSiteIdChangedandSaved = false;

      // Restore form values
      this.userForm.patchValue({
        siteId: this.currentProfile.SiteId,
        clientId: this.currentProfile.ClientId,
        location: this.currentProfile.Loc
      });

      // ✅ ALWAYS call getControlConfig when site changes (even returning to original)
      if (previousSiteId !== siteId) {
        const updatedClientData = { ...this.clientData };
        console.log('🔄 Returned to original site - calling getControlConfig');
        this.callGetControlConfig(updatedClientData);
      }
    } else {
      // Changing to different site
      // ✅ PRESERVE location if it exists in clientData - NEVER clear it
      const preservedLocation = this.clientData.Location || this.userProfile.Loc || '';

      this.userProfile.ClientId = '';
      this.userProfile.SiteId = siteId;

      // ✅ Keep location from clientData
      if (preservedLocation) {
        this.userProfile.Loc = preservedLocation;
      } else {
        this.userProfile.Loc = '';
      }

      this.updateClientDataObj(this.userProfile);

      // ✅ Preserve location in form - only clear client
      this.userForm.patchValue({
        siteId: siteId,
        clientId: '',
        location: preservedLocation  // ✅ Keep existing location
      });

      this.isSiteIdChanged = true;
      this.isSiteIdChangedandSaved = true;
      this.focusClient();

      // ✅ ALWAYS call getControlConfig when site changes
      const updatedClientData = { ...this.clientData };
      console.log('🔄 Site changed - calling getControlConfig');
      this.callGetControlConfig(updatedClientData);
    }
  }

  /**
   * Update ClientData object based on selection
   */
  private updateClientDataObj(obj: any): void {
    this.clientData.SiteId = obj.SiteId;
    this.clientData.ClientId = obj.ClientId;
    this.clientData.Location = obj.Loc;
    this.getStorer(obj.SiteId);
  }

  /**
   * Get clients for selected site (getStorer API)
   */
  getStorer(siteId: string): void {
    this.loading = true;
    this.clientData.SiteId = siteId;

    const requestObj = { ClientData: this.clientData };

    this.commonService.post(`/LogIn/getStorer/${siteId}`, requestObj, { showLoader: true }).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.Status === 'PASS' && response.Response) {
          this.client = response.Response;

          if (this.client.length === 1) {
            // Single client - auto-select
            const clientId = this.client[0].ClientId;
            const clientLocation = this.client[0].Loc || '';

            // ✅ PRESERVE existing location from clientData/userProfile
            const existingLocation = this.userProfile.Loc || this.clientData.Location || '';
            const finalLocation = existingLocation || clientLocation;

            this.userForm.patchValue({
              clientId: clientId,
              location: finalLocation
            });

            this.userProfile.ClientId = clientId;

            // ✅ Only update location if it was empty
            if (!existingLocation && clientLocation) {
              this.userProfile.Loc = clientLocation.toUpperCase();
            }

            this.clientData.ClientId = clientId;
            this.disableControls(false);

            // ✅ Keep location disabled if it has a value
            if (this.userProfile.Loc) {
              this.isLocationDisabled = true;
              this.locationDisabled = true;
              this.userForm.get('location')?.disable();
            } else if (!clientLocation || clientLocation === '') {
              this.focusLocation();
            }

            // ✅ ALWAYS call getControlConfig after auto-selecting single client
            const updatedClientData = { ...this.clientData };
            console.log('🔄 Single client auto-selected - calling getControlConfig');
            this.callGetControlConfig(updatedClientData);
          } else {
            // Multiple clients
            if (this.userProfile.SiteId && !this.userProfile.ClientId) {
              this.focusClient();
            }
            this.disableControls(false);

            // ✅ Keep location disabled if it has a value
            if (this.userProfile.Loc) {
              this.isLocationDisabled = true;
              this.locationDisabled = true;
              this.userForm.get('location')?.disable();
            }
          }
        } else {
          this.client = [];
          this.disableControls(true);
          this.showSnackbar('No clients found for selected site', NotificationType.WARNING);
        }
      },
      error: (error) => {
        console.error('Failed to get clients:', error);
        this.loading = false;
        this.client = [];
        this.disableControls(true);
        this.showSnackbar('Failed to load clients', NotificationType.ERROR);
      }
    });
  }

  /**
   * Handle client change
   */
  onChangeData(event: any): void {
    const clientId = event.target.value;
    const selectedClient = this.client.find(c => c.ClientId === clientId);

    if (selectedClient) {
      const previousClientId = this.userProfile.ClientId;

      this.userProfile.ClientId = selectedClient.ClientId;
      this.clientData.ClientId = selectedClient.ClientId;

      // ✅ Only auto-fill location if current location is empty
      if (selectedClient.Loc && selectedClient.Loc !== '') {
        // ✅ Check if current location is empty before updating
        if (!this.userProfile.Loc || this.userProfile.Loc.trim() === '') {
          const location = selectedClient.Loc.toUpperCase();
          this.userForm.patchValue({ location: location });
          this.userProfile.Loc = location;
          this.isLocationDisabled = true;
          this.locationDisabled = true;
          this.userForm.get('location')?.disable();
        }
        // ✅ If location already exists, keep it and don't update
      }

      // ✅ ALWAYS call getControlConfig when client changes
      const updatedClientData = { ...this.clientData };
      console.log('🔄 Client changed - calling getControlConfig');
      this.callGetControlConfig(updatedClientData, (location) => {
        // ✅ After getting default location, focus location if still empty
        if (!location && !this.isLocationDisabled) {
          this.focusLocation();
        }
      });
    }
  }

  /**
   * Handle device ID change (with uppercase)
   */
  onDeviceIdChange(event: any): void {
    const deviceId = event.target.value.toUpperCase(); // ✅ Uppercase
    this.clientData.DeviceId = deviceId;
    this.userProfile.DeviceId = deviceId;

    // Update form with uppercase value
    this.userForm.patchValue({
      deviceId: deviceId
    }, { emitEvent: false });
  }

  /**
   * Handle location input (convert to uppercase)
   */
  onLocationInput(event: any): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.toUpperCase(); // ✅ Uppercase

    // Update form with uppercase value
    this.userForm.patchValue({
      location: value
    }, { emitEvent: false });

    this.userProfile.Loc = value;
  }

  /**
   * Handle input change
   */
  changeInput(input: any): void {
    // Input changes are handled by form subscription
  }

  /**
   * Validate and save profile
   */
  validateLocation(formValue: any = this.userForm.value, locationInput: any = null): void {
    const currentFormValue = this.userForm.getRawValue();

    if (!currentFormValue.siteId || !currentFormValue.clientId) {
      this.showSnackbar('Please fill in all required fields', NotificationType.ERROR);
      return;
    }

    this.userProfile.SiteId = currentFormValue.siteId;
    this.userProfile.ClientId = currentFormValue.clientId;
    this.userProfile.Loc = (currentFormValue.location || '').toUpperCase();

    if (this.currentProfile) {
      const siteChanged = this.userProfile.SiteId !== this.currentProfile.SiteId;
      const clientChanged = this.userProfile.ClientId !== this.currentProfile.ClientId;
      const locationChanged = this.userProfile.Loc !== this.currentProfile.Loc;
      const deviceChanged = !this.isDeviceIdDisabled && this.userProfile.DeviceId !== this.currentProfile.DeviceId;

      if (!siteChanged && !clientChanged && !locationChanged && !deviceChanged) {
        this.showSnackbar('No changes to save', NotificationType.INFO);
        return;
      }
    }

    // Validate and save
    this.userProfileValidate(currentFormValue, locationInput);
  }

  /**
   * Validate location before saving profile
   */
  private userProfileValidate(value: any, locationInput: any): void {
    this.loading = true;

    // Check if enabling workstation saving
    if (!this.clientData?.Location) {
      this.enableWorkStationSaving = true;
    }

    // ✅ Update clientData with form values (use getRawValue to include disabled fields)
    this.clientData.ClientId = value.clientId;
    this.clientData.Location = (value.location || '').toUpperCase(); // ✅ Handle empty location
    this.clientData.SiteId = value.siteId;

    // ✅ Prepare location object - handle empty location
    const locationObj = { Loc: (value.location || '').toUpperCase() };

    const requestObj = {
      ClientData: this.clientData,
      Location: locationObj
    };

    // ✅ If location is empty, skip validation and proceed to save
    if (!value.location || value.location.trim() === '') {
      console.log('⚠️ Location is empty - skipping validation');
      this.saveUserProfile();
      return;
    }

    // Call validateLocation API
    this.commonService.post('/common/validateLocation', requestObj, { showLoader: true }).subscribe({
      next: (response) => {
        if (response.Status === 'PASS') {
          // Location valid - proceed to save profile
          this.saveUserProfile();
        } else {
          this.loading = false;
          this.showSnackbar(response.StatusMessage || 'Invalid location', NotificationType.ERROR);
          if (locationInput) {
            this.focusLocation();
          }
        }
      },
      error: (error) => {
        console.error('Failed to validate location:', error);
        this.loading = false;
        this.showSnackbar('Failed to validate location', NotificationType.ERROR);
      }
    });
  }

  /**
   * Save user profile
   */
  private saveUserProfile(): void {
    // ✅ Get raw form values (includes disabled fields)
    const formValue = this.userForm.getRawValue();

    // ✅ Update userProfile with final values (uppercase)
    this.userProfile.SiteId = formValue.siteId;
    this.userProfile.ClientId = formValue.clientId;
    this.userProfile.Loc = (formValue.location || '').toUpperCase(); // ✅ Handle empty location
    this.userProfile.UserId = this.clientData.LoggedInUser;

    // Add release version
    if (localStorage.getItem(StorageKey.RELEASE_VERSION)) {
      this.userProfile.ReleaseVersion = localStorage.getItem(StorageKey.RELEASE_VERSION);
    }

    // Add session if exists
    let session: any = {};
    if (localStorage.getItem(StorageKey.SESSION)) {
      session = JSON.parse(localStorage.getItem(StorageKey.SESSION) || '{}');
    }

    // ✅ Update clientData to match userProfile
    this.clientData.Location = this.userProfile.Loc;
    this.clientData.ClientId = this.userProfile.ClientId;
    this.clientData.SiteId = this.userProfile.SiteId;

    const requestObj = {
      ClientData: this.clientData,
      UserProfile: this.userProfile,
      Session: session
    };

    console.log('💾 Saving user profile:', requestObj);

    this.commonService.post('/LogIn/saveUserProfile', requestObj, { showLoader: true }).subscribe({
      next: (response) => {
        if (response.Status === 'PASS') {
          // Save workstation information if needed
          if (localStorage.getItem('WorkStationDetails') && this.enableWorkStationSaving) {
            const workStationDetails = JSON.parse(localStorage.getItem('WorkStationDetails') || '{}');
            if (workStationDetails) {
              this.saveWorkStation(this.clientData, workStationDetails);
            }
          }

          // Update session
          if (response.Response?.Session) {
            localStorage.setItem(StorageKey.SESSION, JSON.stringify(response.Response.Session));
          }

          // Update userProfile with response
          this.isSiteIdChangedandSaved = false;
          localStorage.setItem('isSiteIdChanged', this.isSiteIdChanged.toString());

          if (response.Response?.BookmarkOperations) {
            this.userProfile.BookmarkOperations = response.Response.BookmarkOperations;
          }

          if (response.Response?.DefaultOperations) {
            this.userProfile.DefaultOperations = response.Response.DefaultOperations;
          }

          // Save to localStorage
          localStorage.setItem(StorageKey.USER_PROFILE, JSON.stringify(this.userProfile));
          localStorage.setItem(StorageKey.LOCATION, this.userProfile.Loc);
          localStorage.setItem(StorageKey.CLIENT_ID, this.userProfile.ClientId);
          localStorage.setItem(StorageKey.SITE_ID, this.userProfile.SiteId);

          // Update clientData
          this.clientData.Location = this.userProfile.Loc;
          this.clientData.ClientId = this.userProfile.ClientId;
          this.clientData.SiteId = this.userProfile.SiteId;
          if (this.userProfile.DeviceId) {
            this.clientData.DeviceId = this.userProfile.DeviceId;
          }

          localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(this.clientData));
          localStorage.setItem('module', 'COM');

          // Filter roles for this site
          this.loginService.filterRolesBySite(this.userProfile.SiteId);

          // ✅ Call all APIs after save (matching web flow)
          this.callPostSaveAPIs();

          this.showSnackbar(response.StatusMessage || 'Profile saved successfully', NotificationType.SUCCESS);
        } else {
          this.loading = false;
          this.showSnackbar(response.StatusMessage || 'Failed to save profile', NotificationType.ERROR);
        }
      },
      error: (error) => {
        console.error('Failed to save profile:', error);
        this.loading = false;
        this.showSnackbar('Failed to save profile', NotificationType.ERROR);
      }
    });
  }

  /**
   * ✅ Call all APIs after save with proper error handling
   * getDeviceId can fail (non-critical) but we still save other results
   */
  private callPostSaveAPIs(): void {
    console.log('=== Calling Post-Save APIs ===');

    const controlConfig$ = this.loginService.getControlConfig(this.clientData, ConfigModule.LOGIN).pipe(
      catchError(error => {
        console.warn('⚠️ getControlConfig failed (continuing anyway):', error);
        return of({ Status: 'FAIL', Response: null });
      })
    );

    const sessionTime$ = this.loginService.getSessionTime(this.clientData).pipe(
      catchError(error => {
        console.warn('⚠️ getSessionTime failed (continuing anyway):', error);
        return of({ Status: 'FAIL', Response: null });
      })
    );

    const deviceId$ = this.loginService.getDeviceId(this.clientData).pipe(
      catchError(error => {
        console.warn('⚠️ getDeviceId failed (non-critical, continuing):', error);
        return of({ Status: 'FAIL', Response: null });
      })
    );

    const menu$ = this.loginService.getMenu(this.clientData, {
      Roles: JSON.parse(localStorage.getItem(StorageKey.ROLES_LIST) || '{}')
    }).pipe(
      catchError(error => {
        console.warn('⚠️ getMenu failed (continuing anyway):', error);
        return of({ Status: 'FAIL', Response: null });
      })
    );

    // Call all APIs in parallel - even if one fails, others will complete
    forkJoin({
      controlConfig: controlConfig$,
      sessionTime: sessionTime$,
      deviceId: deviceId$,
      menu: menu$
    }).subscribe({
      next: (results) => {
        console.log('✅ Post-save APIs completed:', results);

        if (results.controlConfig.Status === 'PASS' && results.controlConfig.Response) {
          localStorage.setItem(StorageKey.CONTROL_CONFIG, JSON.stringify(results.controlConfig.Response));
          console.log('✅ Saved control config');
        } else {
          console.warn('⚠️ Control config not saved (API failed)');
        }

        if (results.sessionTime.Status === 'PASS' && results.sessionTime.Response) {
          localStorage.setItem(StorageKey.SESSION_TIMEOUT, results.sessionTime.Response);
          console.log('✅ Saved session timeout');
        } else {
          console.warn('⚠️ Session timeout not saved (API failed)');
        }

        if (results.deviceId.Status === 'PASS' && results.deviceId.Response?.DeviceId) {
          this.clientData.DeviceId = results.deviceId.Response.DeviceId;
          localStorage.setItem(StorageKey.DEVICE_ID, results.deviceId.Response.DeviceId);
          localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(this.clientData));
          console.log('✅ Updated device ID:', results.deviceId.Response.DeviceId);
        } else {
          console.warn('⚠️ Device ID not updated (API failed - non-critical)');
        }

        // ✅ Save menu (if succeeded)
        if (results.menu.Status === 'PASS' && results.menu.Response) {
          localStorage.setItem(StorageKey.MENU, JSON.stringify(results.menu.Response));
          console.log('✅ Saved menu');
        } else {
          console.warn('⚠️ Menu not saved (API failed)');
        }

        // ✅ Navigate to dashboard regardless of individual API failures
        this.loading = false;
        console.log('✅ Navigating to dashboard...');
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 500);
      },
      error: (error) => {
        // This should never happen since we catch errors in each observable
        console.error('❌ Unexpected error in forkJoin:', error);
        this.loading = false;
        // Navigate to dashboard anyway
        this.router.navigate(['/dashboard']);
      }
    });
  }

  /**
   * Save workstation
   */
  private saveWorkStation(clientData: any, workStationDetails: any): void {
    if (!localStorage.getItem("IsWorkStationSaved")) {
      const requestObj = {
        ClientData: clientData,
        WorkStation: workStationDetails
      };

      this.commonService.post('/common/saveWorkStation', requestObj, {
        showLoader: false,
        showError: false
      }).subscribe({
        next: () => {
          localStorage.setItem("IsWorkStationSaved", "true");
        },
        error: (error) => {
          console.error('Failed to save workstation:', error);
        }
      });
    }
  }

  /**
   * Disable/enable form controls
   */
  private disableControls(disable: boolean): void {
    this.clientDisabled = disable;
    if (!this.userProfile.Loc) {
      this.locationDisabled = disable;
      this.isLocationDisabled = disable;
    }

    this.isClientDisable = disable;

    if (disable) {
      this.userForm.get('clientId')?.disable();
      if (!this.userProfile.Loc) {
        this.userForm.get('location')?.disable();
      }
    } else {
      this.userForm.get('clientId')?.enable();
      if (!this.userProfile.Loc) {
        this.userForm.get('location')?.enable();
      }
    }
  }

  /**
   * Focus site ID
   */
  private siteIdFocus(): void {
    setTimeout(() => {
      const element = document.getElementById('siteId');
      if (element) {
        element.focus();
      }
    }, 100);
  }

  /**
   * Focus client dropdown
   */
  private focusClient(): void {
    setTimeout(() => {
      const element = document.getElementById('clientId');
      if (element) {
        element.focus();
      }
    }, 100);
  }

  /**
   * Focus location input
   */
  private focusLocation(): void {
    setTimeout(() => {
      const element = document.getElementById('location');
      if (element) {
        element.focus();
        const inputElement = element as HTMLInputElement;
        inputElement.select();
      }
    }, 100);
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
   * Cancel and go back
   */
  cancel(): void {
    this.router.navigate(['/dashboard']);
  }
}
