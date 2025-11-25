import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Auth } from '../services/auth';

@Component({
  selector: 'app-ios-management',
   imports: [CommonModule, FormsModule],
  templateUrl: './ios-management.html',
  styleUrl: './ios-management.scss',
})
export class IosManagement {
// Configuration
  private apiBaseUrl = 'https://qaapi-rmxt026.am.gxo.com:8333/api/';

  // Data
  devices: IOSDevice[] = [];
  apps: IOSApp[] = [];

  // UI State
  selectedTab: string = 'devices'; // 'devices' or 'apps'
  loading: boolean = false;
  searchKey: string = '';

  // Statistics
  statistics = {
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    totalApps: 0
  };

  // Polling
  private stopPolling$ = new Subject();
  private pollingInterval = 60000; // 60 seconds

  constructor(
    private http: HttpClient,
    private authService: Auth
  ) {}

  ngOnInit(): void {
    this.loadAllData();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.stopPolling$.next(null);
    this.stopPolling$.complete();
  }

  /**
   * Load all data
   */
  loadAllData(): void {
    this.getDevices();
    this.getApps();
  }

  /**
   * Start polling
   */
  private startPolling(): void {
    timer(this.pollingInterval, this.pollingInterval).pipe(
      takeUntil(this.stopPolling$)
    ).subscribe(() => {
      this.loadAllData();
    });
  }

  /**
   * Get iOS devices
   */
  getDevices(): void {
    // For demo: Generate mock data
    this.devices = this.generateMockDevices();
    this.updateStatistics();

    // For real API:
    /*
    const url = `${this.apiBaseUrl}ios/getDevices`;
    const token = this.authService.getToken();

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });

    this.http.get<any>(url, { headers }).subscribe({
      next: (response) => {
        if (response && response.Devices) {
          this.devices = response.Devices;
          this.updateStatistics();
        }
      },
      error: (error) => {
        console.error('Error loading devices:', error);
      }
    });
    */
  }

  /**
   * Get iOS apps
   */
  getApps(): void {
    // For demo: Generate mock data
    this.apps = this.generateMockApps();

    // For real API - uncomment when ready
  }

  /**
   * Generate mock devices for demo
   */
  private generateMockDevices(): IOSDevice[] {
    return [
      {
        DeviceId: 'IPH-001',
        DeviceName: 'iPhone 15 Pro',
        Model: 'iPhone15,2',
        OSVersion: 'iOS 17.2',
        Status: 'Online',
        BatteryLevel: 85,
        LastSync: '2 minutes ago',
        Apps: 45,
        SerialNumber: 'DMPTL2ABCD'
      },
      {
        DeviceId: 'IPD-001',
        DeviceName: 'iPad Pro 12.9',
        Model: 'iPad8,1',
        OSVersion: 'iPadOS 17.1',
        Status: 'Online',
        BatteryLevel: 62,
        LastSync: '5 minutes ago',
        Apps: 38,
        SerialNumber: 'DLXTL3EFGH'
      },
      {
        DeviceId: 'IPH-002',
        DeviceName: 'iPhone 14',
        Model: 'iPhone14,1',
        OSVersion: 'iOS 16.7',
        Status: 'Offline',
        BatteryLevel: 0,
        LastSync: '2 hours ago',
        Apps: 32,
        SerialNumber: 'FMPTL4IJKL'
      },
      {
        DeviceId: 'IPH-003',
        DeviceName: 'iPhone 13',
        Model: 'iPhone13,2',
        OSVersion: 'iOS 17.0',
        Status: 'Online',
        BatteryLevel: 95,
        LastSync: '1 minute ago',
        Apps: 28,
        SerialNumber: 'GMPTL5MNOP'
      }
    ];
  }

  /**
   * Generate mock apps for demo
   */
  private generateMockApps(): IOSApp[] {
    return [
      {
        AppId: 'APP-001',
        AppName: 'Service Monitor',
        Version: '2.5.1',
        Status: 'Active',
        InstallDate: '2024-01-15',
        Size: '45.2 MB'
      },
      {
        AppId: 'APP-002',
        AppName: 'Remote Access',
        Version: '1.8.3',
        Status: 'Active',
        InstallDate: '2024-02-20',
        Size: '32.8 MB'
      },
      {
        AppId: 'APP-003',
        AppName: 'Data Sync',
        Version: '3.1.0',
        Status: 'Inactive',
        InstallDate: '2024-03-10',
        Size: '28.5 MB'
      },
      {
        AppId: 'APP-004',
        AppName: 'Configuration',
        Version: '2.0.5',
        Status: 'Active',
        InstallDate: '2024-01-05',
        Size: '15.3 MB'
      }
    ];
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.totalDevices = this.devices.length;
    this.statistics.onlineDevices = this.devices.filter(d => d.Status === 'Online').length;
    this.statistics.offlineDevices = this.devices.filter(d => d.Status === 'Offline').length;
    this.statistics.totalApps = this.apps.length;
  }

  /**
   * Filter devices
   */
  get filteredDevices(): IOSDevice[] {
    if (!this.searchKey) return this.devices;

    const search = this.searchKey.toLowerCase();
    return this.devices.filter(d =>
      d.DeviceName.toLowerCase().includes(search) ||
      d.Model.toLowerCase().includes(search) ||
      d.SerialNumber.toLowerCase().includes(search)
    );
  }

  /**
   * Filter apps
   */
  get filteredApps(): IOSApp[] {
    if (!this.searchKey) return this.apps;

    const search = this.searchKey.toLowerCase();
    return this.apps.filter(a =>
      a.AppName.toLowerCase().includes(search) ||
      a.Version.toLowerCase().includes(search)
    );
  }

  /**
   * Select tab
   */
  selectTab(tab: string): void {
    this.selectedTab = tab;
    this.searchKey = '';
  }

  /**
   * Get status class
   */
  getStatusClass(status: string): string {
    if (status === 'Online' || status === 'Active') return 'status-online';
    if (status === 'Offline' || status === 'Inactive') return 'status-offline';
    return 'status-warning';
  }

  /**
   * Get battery class
   */
  getBatteryClass(level: number): string {
    if (level > 60) return 'battery-good';
    if (level > 20) return 'battery-medium';
    return 'battery-low';
  }

  /**
   * Refresh all data
   */
  refreshAll(): void {
    this.searchKey = '';
    this.loadAllData();
  }

  /**
   * Sync device
   */
  syncDevice(deviceId: string): void {
    this.loading = true;
    // Simulate sync
    setTimeout(() => {
      this.loading = false;
      alert(`Device ${deviceId} synced successfully!`);
      this.getDevices();
    }, 1000);
  }

  /**
   * View device details
   */
  viewDeviceDetails(device: IOSDevice): void {
    alert(`Device Details:\n\nName: ${device.DeviceName}\nModel: ${device.Model}\nOS: ${device.OSVersion}\nSerial: ${device.SerialNumber}`);
  }
}
export interface IOSDevice {
  DeviceId: string;
  DeviceName: string;
  Model: string;
  OSVersion: string;
  Status: string;
  BatteryLevel: number;
  LastSync: string;
  Apps: number;
  SerialNumber: string;
}

export interface IOSApp {
  AppId: string;
  AppName: string;
  Version: string;
  Status: string;
  InstallDate: string;
  Size: string;
}
