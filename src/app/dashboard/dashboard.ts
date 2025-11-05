import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, timer } from 'rxjs';
import { exhaustMap, startWith, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit, OnDestroy {
  // Configuration
  private apiBaseUrl = 'http://tsgvm04112:8015/api/';
  private token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJUaW1lU3RhbXAiOiIxMS81LzIwMjUgNjo0Mjo0NCBQTSIsInVuaXF1ZV9uYW1lIjoic2FuZGVlcC5ldGlrYWxhIiwiQ2xpZW50SWQiOiI5OTk5IiwiU2l0ZUlkIjoiTE9HSU4iLCJuYmYiOjE3NjIzNjgxNjQsImV4cCI6MTc2MjQ1NDU2NCwiaWF0IjoxNzYyMzY4MTY0LCJpc3MiOiJSTXgiLCJhdWQiOiJSTXhVc2VycyJ9.0VeCQcEHsyv-qmHnn3bwVM1aZVBoEkFr398ub2Sy6d0';

  // Data
  clientData: ClientData = {
    Location: 'DS0102',
    ClientId: '1011',
    SiteId: 'DFW009',
    LoggedInUser: 'cMT1sNYfJKKUiLnKUN5m0A==',
    DeviceId: 'ITLGXORMX012',
    Roles: ['DEVELOPER', 'CLIENTSUPPORT']
  };

  uiData: UIData = {
    OperationId: '6850',
    OperCategory: 'WINDOWSSERVICES'
  };

  // Service Data
  windowsServices: WindowsService[] = [];
  taskSchedulers: TaskScheduler[] = [];
  apiServices: ApiService[] = [];
  queueAlerts: QueueAlert[] = [];

  // UI State
  selectedTab: string = 'windows';
  viewMode: string = 'table'; // 'table' or 'cards'
  loading: boolean = false;
  searchKey: string = '';
  statusFilter: string = 'all';

  // Statistics
  statistics: ServiceStatistics = {
    totalServices: 0,
    runningServices: 0,
    stoppedServices: 0,
    warningServices: 0
  };

  // Status Indicators
  windowsServiceError: boolean = false;
  taskSchedulerError: boolean = false;
  apiServiceError: boolean = false;
  queueAlertError: boolean = false;

  // Polling
  private stopPolling$ = new Subject();
  private pollingInterval = 30000;

  constructor(private http: HttpClient) {
    this.initializeClientData();
  }

  ngOnInit(): void {
    this.loadAllServices();
    this.startPolling();

    // Load saved view mode
    const savedViewMode = localStorage.getItem('viewMode');
    if (savedViewMode) {
      this.viewMode = savedViewMode;
    }
  }

  ngOnDestroy(): void {
    this.stopPolling$.next(null);
    this.stopPolling$.complete();
  }

  /**
   * Initialize Client Data
   */
  private initializeClientData(): void {
    try {
      const storedData = localStorage.getItem('clientData');
      if (storedData) {
        this.clientData = JSON.parse(storedData);
      }
      if (!this.clientData.Roles || this.clientData.Roles.length === 0) {
        this.clientData.Roles = ['ADMIN', 'USER'];
      }
    } catch (error: any) {
      console.error('Error loading client data:', error);
    }
  }

  /**
   * ✅ NEW: Set view mode (called from dashboard buttons)
   */
  setViewMode(mode: string): void {
    this.viewMode = mode;
    localStorage.setItem('viewMode', mode);
  }

  /**
   * Load all services
   */
  loadAllServices(): void {
    this.getWindowsServices();
    this.getTaskSchedulers();
    this.getApiServices();
    this.getQueueAlerts();
  }

  /**
   * Start polling
   */
  private startPolling(): void {
    timer(this.pollingInterval, this.pollingInterval).pipe(
      startWith(0),
      takeUntil(this.stopPolling$)
    ).subscribe(() => {
      this.refreshCurrentTab();
    });
  }

  /**
   * Refresh current tab
   */
  refreshCurrentTab(): void {
    switch (this.selectedTab) {
      case 'windows':
        this.getWindowsServices();
        break;
      case 'tasks':
        this.getTaskSchedulers();
        break;
      case 'api':
        this.getApiServices();
        break;
      case 'queue':
        this.getQueueAlerts();
        break;
    }
  }

  /**
   * Get Windows Services
   */
  getWindowsServices(): void {
    const url = `${this.apiBaseUrl}utilities/getServicesList`;
    const requestObj = {
      ClientData: this.clientData,
      UIData: this.uiData
    };

    this.apiCall<WindowsService[]>(url, requestObj).subscribe({
      next: (response: any) => {
        if (response && response.length > 0) {
          this.windowsServices = response;
          this.windowsServiceError = response.some((s: any) => s.Status !== 'Running');
          this.updateStatistics();
        }
      },
      error: (error: any) => {
        console.error('Error loading Windows services:', error);
        this.windowsServiceError = true;
      }
    });
  }

  /**
   * Get Task Schedulers
   */
  getTaskSchedulers(): void {
    const url = `${this.apiBaseUrl}utilities/getTaskList`;
    const requestObj = {
      ClientData: this.clientData,
      UIData: this.uiData
    };

    this.apiCall<TaskScheduler[]>(url, requestObj).subscribe({
      next: (response: any) => {
        if (response && response.length > 0) {
          this.taskSchedulers = response;
          this.taskSchedulerError = response.some((t: any) => t.Status !== 'Running');
        }
      },
      error: (error: any) => {
        console.error('Error loading task schedulers:', error);
        this.taskSchedulerError = true;
      }
    });
  }

  /**
   * Get API Services
   */
  getApiServices(): void {
    const url = `${this.apiBaseUrl}utilities/getWebAPIsStatus`;
    const requestObj = {
      ClientData: this.clientData,
      UIData: this.uiData
    };

    this.apiCall<ApiService[]>(url, requestObj).subscribe({
      next: (response: any) => {
        if (response && response.length > 0) {
          this.apiServices = response;
          this.apiServiceError = response.some((a: any) => a.Status !== 'Running');
        }
      },
      error: (error: any) => {
        console.error('Error loading API services:', error);
        this.apiServiceError = true;
      }
    });
  }

  /**
   * Get Queue Alerts
   */
  getQueueAlerts(): void {
    const url = `${this.apiBaseUrl}utilities/getQueueAlerts`;
    const requestObj = {
      ClientData: this.clientData,
      UIData: this.uiData
    };

    this.apiCall<QueueAlert[]>(url, requestObj).subscribe({
      next: (response: any) => {
        if (response && response.length > 0) {
          this.queueAlerts = response;
          this.queueAlertError = response.some((q: any) => q.Color !== 'GREEN');
        }
      },
      error: (error: any) => {
        console.error('Error loading queue alerts:', error);
        this.queueAlertError = true;
      }
    });
  }

  /**
   * Generic API call
   */
  private apiCall<T>(url: string, requestObj: any): any {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    });

    return this.http.post<any>(url, requestObj, { headers }).pipe(
      exhaustMap((response: any) => {
        if (response && response.Response) {
          return [response.Response as T];
        }
        return [[] as T];
      })
    );
  }

  /**
   * Toggle Windows Service
   */
  toggleWindowsService(serviceName: string): void {
    const url = `${this.apiBaseUrl}utilities/startStopService/${serviceName}`;
    const requestObj = {
      ClientData: this.clientData,
      UIData: this.uiData
    };

    this.loading = true;
    this.apiCall<any>(url, requestObj).subscribe({
      next: () => {
        this.loading = false;
        this.getWindowsServices();
      },
      error: (error: any) => {
        console.error('Error toggling service:', error);
        this.loading = false;
        alert('Error toggling service status');
      }
    });
  }

  /**
   * Toggle Task Scheduler
   */
  toggleTaskScheduler(taskName: string): void {
    const url = `${this.apiBaseUrl}utilities/startOrStopTask/${taskName}`;
    const requestObj = {
      ClientData: this.clientData,
      UIData: this.uiData
    };

    this.loading = true;
    this.apiCall<any>(url, requestObj).subscribe({
      next: () => {
        this.loading = false;
        this.getTaskSchedulers();
      },
      error: (error: any) => {
        console.error('Error toggling task:', error);
        this.loading = false;
        alert('Error toggling task status');
      }
    });
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.totalServices = this.windowsServices.length;
    this.statistics.runningServices = this.windowsServices.filter(s => s.Status === 'Running').length;
    this.statistics.stoppedServices = this.windowsServices.filter(s => s.Status === 'Stopped').length;
    this.statistics.warningServices = this.windowsServices.filter(s =>
      s.Status !== 'Running' && s.Status !== 'Stopped'
    ).length;
  }

  /**
   * Switch tab
   */
  selectTab(tab: string): void {
    this.selectedTab = tab;
    this.searchKey = '';
    this.statusFilter = 'all';
  }

  /**
   * Get status class
   */
  getStatusClass(status: string): string {
    if (status === 'Running') return 'status-running';
    if (status === 'Stopped') return 'status-stopped';
    return 'status-warning';
  }

  /**
   * Get CPU class
   */
  getCpuClass(cpu: number): string {
    if (cpu > 70) return 'cpu-high';
    if (cpu > 35) return 'cpu-medium';
    return 'cpu-low';
  }

  /**
   * Get filtered services
   */
  getFilteredServices(): WindowsService[] {
    let filtered = this.windowsServices;

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(s =>
        s.ServiceName.toLowerCase().includes(search) ||
        s.Description.toLowerCase().includes(search) ||
        s.ServerName.toLowerCase().includes(search)
      );
    }

    if (this.statusFilter !== 'all') {
      if (this.statusFilter === 'running') {
        filtered = filtered.filter(s => s.Status === 'Running');
      } else if (this.statusFilter === 'stopped') {
        filtered = filtered.filter(s => s.Status !== 'Running');
      }
    }

    return filtered;
  }

  /**
   * Get percentage
   */
  getPercentage(value: number): number {
    if (this.statistics.totalServices === 0) return 0;
    return Math.round((value / this.statistics.totalServices) * 100);
  }

  /**
   * Refresh all data
   */
  refreshAll(): void {
    this.searchKey = '';
    this.statusFilter = 'all';
    this.loadAllServices();
  }

  /**
   * View service logs
   */
  viewLogs(serviceName: string, serverName: string): void {
    alert(`View logs for:\nService: ${serviceName}\nServer: ${serverName}`);
  }
}

// Models (keep all your existing interfaces)
interface ClientData {
  Location: string;
  ClientId: string;
  SiteId: string;
  LoggedInUser?: string;
  DeviceId?: string;
  Roles?: string[];
}

interface UIData {
  OperationId?: string;
  OperCategory?: string;
}

interface WindowsService {
  ServiceName: string;
  Description: string;
  Status: string;
  ServerName: string;
  MemoryUtilization: number;
  ThreadCount: number;
  CPUUtilization: number;
  Total_CPU: number;
}

interface TaskScheduler {
  TaskName: string;
  Description: string;
  LastRunTime: string;
  Status: string;
}

interface ApiService {
  WebAPIName: string;
  Status: string;
  Url?: string;
}

interface QueueAlert {
  QueueName: string;
  QueueDesc: string;
  LastHour: number;
  New: number;
  Inprocess: number;
  Error: number;
  Completed: number;
  Color: string;
  Threshold: number;
  LastRun: string;
  QueueType: string;
}

interface ServiceStatistics {
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  warningServices: number;
}
