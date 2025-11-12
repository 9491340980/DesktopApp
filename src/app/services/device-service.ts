import { Injectable } from '@angular/core';
import { Observable, of, tap } from 'rxjs';
import { StorageKey } from '../enums/app-constants.enum';
import { DeviceInfo } from '../models/app-config.models';
import { CommonService } from './common-service';
import { ApiResponse, ClientData } from '../models/api.models';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private deviceInfo: DeviceInfo | null = null;

  constructor(private commonService: CommonService) {}

  /**
   * Get device ID - from API or generate if needed
   */
  getDeviceId(): Observable<string> {
    // Check if device ID already exists in storage
    const storedDeviceId = localStorage.getItem(StorageKey.DEVICE_ID);
    if (storedDeviceId) {
      return of(storedDeviceId);
    }

    // Get device info from API
    return this.fetchDeviceInfoFromApi();
  }

  /**
   * Fetch device information from API
   */
  private fetchDeviceInfoFromApi(): Observable<string> {
    const clientData: ClientData = {
      Location: '',
      ClientId: '9999',
      SiteId: 'LOGIN',
      LoggedInUser: ''
    };

    // Prepare device details to send to API
    const deviceDetails = this.collectDeviceDetails();

    return new Observable<string>(observer => {
      this.commonService.postWithClientData<DeviceInfo>(
        '/utilities/getDeviceId',
        clientData,
        { DeviceDetails: deviceDetails },
        { showLoader: false, showError: false }
      ).subscribe({
        next: (response: ApiResponse<DeviceInfo>) => {
          if (response.Status === 'PASS' && response.Response) {
            const deviceId = response.Response.deviceId;
            this.saveDeviceInfo(response.Response);
            observer.next(deviceId);
            observer.complete();
          } else {
            // Fallback to generated device ID
            const generatedId = this.generateDeviceId();
            observer.next(generatedId);
            observer.complete();
          }
        },
        error: () => {
          // Fallback to generated device ID on error
          const generatedId = this.generateDeviceId();
          observer.next(generatedId);
          observer.complete();
        }
      });
    });
  }

  /**
   * Collect device details for API call
   */
  private collectDeviceDetails(): any {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      browserInfo: this.getBrowserInfo(),
      osInfo: this.getOSInfo()
    };
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';

    if (userAgent.indexOf('Chrome') > -1) {
      browserName = 'Chrome';
    } else if (userAgent.indexOf('Firefox') > -1) {
      browserName = 'Firefox';
    } else if (userAgent.indexOf('Safari') > -1) {
      browserName = 'Safari';
    } else if (userAgent.indexOf('Edge') > -1) {
      browserName = 'Edge';
    } else if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) {
      browserName = 'IE';
    }

    return browserName;
  }

  /**
   * Get OS information
   */
  private getOSInfo(): string {
    const userAgent = navigator.userAgent;
    let osName = 'Unknown';

    if (userAgent.indexOf('Win') > -1) {
      osName = 'Windows';
    } else if (userAgent.indexOf('Mac') > -1) {
      osName = 'MacOS';
    } else if (userAgent.indexOf('Linux') > -1) {
      osName = 'Linux';
    } else if (userAgent.indexOf('Android') > -1) {
      osName = 'Android';
    } else if (userAgent.indexOf('iOS') > -1) {
      osName = 'iOS';
    }

    return osName;
  }

  /**
   * Generate device ID (fallback)
   */
  private generateDeviceId(): string {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const timestamp = Date.now();

    // Create a simple unique ID based on browser info
    const uniqueString = `${userAgent}-${platform}-${timestamp}`;
    const hash = this.simpleHash(uniqueString);

    const deviceId = `WEB_${hash.substring(0, 12).toUpperCase()}`;

    // Save to localStorage
    localStorage.setItem(StorageKey.DEVICE_ID, deviceId);

    return deviceId;
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
   * Save device information
   */
  private saveDeviceInfo(deviceInfo: DeviceInfo): void {
    this.deviceInfo = deviceInfo;
    localStorage.setItem(StorageKey.DEVICE_ID, deviceInfo.deviceId);

    // Optionally save full device info
    try {
      localStorage.setItem('deviceInfo', JSON.stringify(deviceInfo));
    } catch (error) {
      console.error('Failed to save device info:', error);
    }
  }

  /**
   * Get stored device information
   */
  getDeviceInfo(): DeviceInfo | null {
    if (this.deviceInfo) {
      return this.deviceInfo;
    }

    try {
      const deviceInfoStr = localStorage.getItem('deviceInfo');
      if (deviceInfoStr) {
        this.deviceInfo = JSON.parse(deviceInfoStr);
        return this.deviceInfo;
      }
    } catch (error) {
      console.error('Failed to load device info:', error);
    }

    return null;
  }

  /**
   * Clear device information
   */
  clearDeviceInfo(): void {
    this.deviceInfo = null;
    localStorage.removeItem(StorageKey.DEVICE_ID);
    localStorage.removeItem('deviceInfo');
  }
}
