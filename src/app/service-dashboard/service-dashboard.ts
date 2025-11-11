import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Subject, timer } from 'rxjs';
import { exhaustMap, startWith, takeUntil } from 'rxjs/operators';
import { CommonService } from '../services/common-service';
import { Auth } from '../services/auth';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
// import { ViewLogsDialogComponent } from './view-logs-dialog.component';

@Component({
  selector: 'app-service-dashboard',
 imports: [CommonModule,
    FormsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatButtonToggleModule,
    MatSlideToggleModule],
  templateUrl: './service-dashboard.html',
  styleUrl: './service-dashboard.scss',
})
export class ServiceDashboard {
  // Control Configuration (EXACTLY matching web version)
  hideControls: any = {
    controlProperties: {
      // Tab visibility controls
      allowWindowsTab: [],  // Empty = show to all
      allowTaskScheTab: [],
      allowApiTab: [],
      allowQueueTab: ['DEVELOPER', 'CLIENTSUPPORT'],
      dbJobs: ['DEVELOPER', 'CLIENTSUPPORT'],
      allowQueueservicesTab: ['DEVELOPER', 'CLIENTSUPPORT'],
      allowQueuepropogatorsTab: ['DEVELOPER', 'CLIENTSUPPORT'],

      // Column visibility controls
      description: ['DEVELOPER', 'ADMIN'],
      serverName: ['DEVELOPER', 'ADMIN'],
      logs: ['DEVELOPER', 'ADMIN'],
      memoryUtilization: ['DEVELOPER', 'ADMIN'],
      ThreadCount: ['DEVELOPER', 'ADMIN'],
      processUtilization: ['DEVELOPER', 'ADMIN'],
      CpuUtilization: ['DEVELOPER', 'ADMIN'],
      Threshold: ['DEVELOPER', 'ADMIN'],
      statusAccess: ['DEVELOPER', 'ADMIN'],

      // Search configuration
      searchKey: {
        Pattern: '^[a-zA-Z0-9\\s]*$',
        MaxLength: 50,
        TextCase: 'upper'
      },

      // Labels (for translation support)
      windowsServices: {
        serviceLbl: 'Service Name',
        descriptionLbl: 'Description',
        statusLbl: 'Status',
        serverNameLbl: 'Server Name',
        logsLbl: 'Logs',
        memoryUtilizationLbl: 'Memory Utilization',
        threadCountLbl: 'Thread Count',
        processUtilizationLbl: 'Process CPU Utilization',
        cpuUtilizationLbl: 'Total CPU Utilization'
      },
      taskScheduler: {
        taskNameLbl: 'Task Name',
        desctiptionLbl: 'Description',
        lastRunTimeLbl: 'Last Run Time',
        statusLbl: 'Status'
      },

      // Queue configuration
      queueData: {
        propogation: 'S',
        nonPropogation: 'P'
      },

      // Polling intervals (milliseconds)
      servicePollTimer: 30000,           // 30 seconds
      queueAlertPollTimer: 60000,        // 60 seconds
      apiStatusAlertPollTimer: 60000,    // 60 seconds
      dbJobsPollTimer: 60000             // 60 seconds
    }
  };

  // UI Data
  uiData: UIData = {
    OperationId: '6850',
    OperCategory: 'WINDOWSSERVICES'
  };

  // Service Data
  services: WindowsService[] = [];  // Web uses 'services'
  tasks: TaskScheduler[] = [];      // Web uses 'tasks'
  apiServiceData: ApiService[] = []; // Web uses 'apiServiceData'
  queService: QueueAlert[] = [];     // Web uses 'queService'
  queService1: QueueAlert[] = [];    // Web uses 'queService1'
  PropService: QueueAlert[] = [];    // Web uses 'PropService'
  dbJobsList: DbJob[] = [];          // Web uses 'dbJobsList'
  dbJobsData: DbJob[] = [];          // Web uses 'dbJobsData'
  originalDbJobsData: DbJob[] = [];  // Web uses 'originalDbJobsData'

  // Schema Selection for DB Jobs
  schemaList: { Id: string; Text: string }[] = [];
  selectedSchema: string = '';

  // UI State
  selectedTab: number = 0;
  viewMode: string = 'table';  // 'table' or 'cards'
  loading: boolean = false;
  searchKey: string = '';
  statusFilter: string = 'all';
  isServicesSearchBtnDisabled: boolean = false;
  isClearBtnDisabled: boolean = true;

  // Statistics
  statistics: ServiceStatistics = {
    totalServices: 0,
    runningServices: 0,
    stoppedServices: 0,
    warningServices: 0
  };

  // Status Indicators (EXACTLY matching web)
  serviceError: boolean = false;                    // Web uses this
  serviceErrorTaskList: boolean = false;            // Web uses this
  serviceErrorApilist: boolean = false;             // Web uses this
  serviceErrorQueuelist: boolean = false;           // Web uses this
  dbJoblist: boolean = false;                       // Web uses this
  serviceErrorDbAlertslist: boolean = false;        // Web uses this
  serviceErrorDbAlertslist1: boolean = false;       // Web uses this

  // Polling
  private deviceStopPolling = new Subject<void>();  // Web uses this name
  private windowsPolling$ = new Subject<void>();
  private taskPolling$ = new Subject<void>();
  private apiPolling$ = new Subject<void>();
  private queuePolling$ = new Subject<void>();
  private dbJobsPolling$ = new Subject<void>();

  // Common Enum (matching web)
  commonEnum = {
    Running: 'Running',
    Stopped: 'Stopped',
    GREEN: 'GREEN'
  };

  // Column definitions for Material Table
  get displayedColumns(): string[] {
    const columns = ['serviceName'];

    if (this.checkDescriptionMatch(this.hideControls.controlProperties?.description)) {
      columns.push('description');
    }

    columns.push('status');

    if (this.checkRolesMatch(this.hideControls.controlProperties?.serverName)) {
      columns.push('serverName');
    }

    if (this.checkLogsMatch(this.hideControls.controlProperties?.logs)) {
      columns.push('logs');
    }

    if (this.checkRolesMatch(this.hideControls.controlProperties?.memoryUtilization)) {
      columns.push('memoryUtilization');
    }

    if (this.checkRolesMatch(this.hideControls.controlProperties?.ThreadCount)) {
      columns.push('threadCount');
    }

    if (this.checkRolesMatch(this.hideControls.controlProperties?.processUtilization)) {
      columns.push('processUtilization');
    }

    if (this.checkRolesMatch(this.hideControls.controlProperties?.CpuUtilization)) {
      columns.push('cpuUtilization');
    }

    return columns;
  }

  constructor(
    private commonService: CommonService,
    private authService: Auth,
    private dialog: MatDialog
  ) {
    this.initializeComponent();
  }

  ngOnInit(): void {
    this.loadAllServices();
    this.startAllPolling();
    this.loadSavedPreferences();
  }

  ngOnDestroy(): void {
    // Matching web's cleanup method
    this.deviceStopPolling.next();
    this.deviceStopPolling.complete();
    this.windowsPolling$.next();
    this.windowsPolling$.complete();
    this.taskPolling$.next();
    this.taskPolling$.complete();
    this.apiPolling$.next();
    this.apiPolling$.complete();
    this.queuePolling$.next();
    this.queuePolling$.complete();
    this.dbJobsPolling$.next();
    this.dbJobsPolling$.complete();
  }

  /**
   * Initialize component with stored data
   */
  private initializeComponent(): void {
    // Load control configuration from storage
    const storedConfig = localStorage.getItem('controlConfig');
    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        this.hideControls = { ...this.hideControls, ...config };
      } catch (error) {
        console.error('Error loading control config:', error);
      }
    }
  }

  /**
   * Load saved preferences
   */
  private loadSavedPreferences(): void {
    const savedViewMode = localStorage.getItem('viewMode');
    if (savedViewMode) {
      this.viewMode = savedViewMode;
    }

    const savedTab = localStorage.getItem('selectedTab');
    if (savedTab) {
      this.selectedTab = parseInt(savedTab, 10);
    }
  }

  /**
   * Set view mode
   */
  setViewMode(mode: string): void {
    this.viewMode = mode;
    localStorage.setItem('viewMode', mode);
  }

  /**
   * Tab change handler
   */
  onTabChange(index: number): void {
    this.selectedTab = index;
    localStorage.setItem('selectedTab', index.toString());
    this.searchKey = '';
    this.statusFilter = 'all';
  }

  /**
   * Load all services (matching web method names)
   */
  loadAllServices(): void {
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowWindowsTab)) {
      this.getServicesList();
    }
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowTaskScheTab)) {
      this.getTasksList();
    }
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowApiTab)) {
      this.getApiList();
    }
    if (this.checkTabMatch(this.hideControls.controlProperties?.allowQueueTab)) {
      this.getQueueAlerts();
    }
    if (this.checkTabMatch(this.hideControls.controlProperties?.dbJobs)) {
      this.getdbJobs();
    }
  }

  /**
   * Start all polling services (matching web polling methods)
   */
  private startAllPolling(): void {
    // Windows Services Polling - matches web's checkStatus()
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowWindowsTab)) {
      timer(0, this.hideControls.controlProperties?.servicePollTimer || 30000)
        .pipe(takeUntil(this.windowsPolling$))
        .subscribe(() => this.checkStatus());
    }

    // Task Schedulers Polling
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowTaskScheTab)) {
      timer(0, this.hideControls.controlProperties?.servicePollTimer || 30000)
        .pipe(takeUntil(this.taskPolling$))
        .subscribe(() => this.getTasksList());
    }

    // API Services Polling - matches web's checkApiServiceStatus()
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowApiTab)) {
      timer(0, this.hideControls.controlProperties?.apiStatusAlertPollTimer || 60000)
        .pipe(takeUntil(this.apiPolling$))
        .subscribe(() => this.checkApiServiceStatus());
    }

    // Queue Alerts Polling - matches web's checkQueAlertStatus()
    if (this.checkTabMatch(this.hideControls.controlProperties?.allowQueueTab)) {
      timer(0, this.hideControls.controlProperties?.queueAlertPollTimer || 60000)
        .pipe(takeUntil(this.queuePolling$))
        .subscribe(() => this.checkQueAlertStatus());
    }

    // DB Jobs Polling - matches web's checkDbJobsStatus()
    if (this.checkTabMatch(this.hideControls.controlProperties?.dbJobs)) {
      timer(0, this.hideControls.controlProperties?.dbJobsPollTimer || 60000)
        .pipe(takeUntil(this.dbJobsPolling$))
        .subscribe(() => this.checkDbJobsStatus());
    }
  }

  /**
   * Get Windows Services (matching web method name)
   */
  getServicesList(): void {
    this.commonService.post<WindowsService[]>(
      '/utilities/getServicesList',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS' && response.Response) {
          this.services = response.Response;
          this.serviceError = response.Response.some(s => s.Status !== 'Running');
          this.updateStatistics();
        }
      },
      error: (error) => {
        console.error('Error loading Windows services:', error);
        this.serviceError = true;
      }
    });
  }

  /**
   * Check status with polling (matching web method)
   */
  checkStatus(): void {
    this.getServicesList();
  }

  /**
   * Get Task Schedulers (matching web method name)
   */
  getTasksList(): void {
    this.commonService.post<TaskScheduler[]>(
      '/utilities/getTasksList',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS' && response.Response) {
          this.tasks = response.Response;
          this.serviceErrorTaskList = response.Response.some(t => t.Status !== 'Running');
        }
      },
      error: (error) => {
        console.error('Error loading task schedulers:', error);
        this.serviceErrorTaskList = true;
      }
    });
  }

  /**
   * Get API Services (matching web method name)
   */
  getApiList(): void {
    this.commonService.post<ApiService[]>(
      '/utilities/getWebAPIsStatus',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS' && response.Response) {
          this.apiServiceData = response.Response;
          this.serviceErrorApilist = response.Response.some(a => a.Status !== 'Running');
        }
      },
      error: (error) => {
        console.error('Error loading API services:', error);
        this.serviceErrorApilist = true;
      }
    });
  }

  /**
   * Check API Service Status with polling (matching web method)
   */
  checkApiServiceStatus(): void {
    this.getApiList();
  }

  /**
   * Get Queue Alerts (matching web method name)
   */
  getQueueAlerts(): void {
    this.commonService.post<QueueAlert[]>(
      '/utilities/getQueueAlerts',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS' && response.Response) {
          const propType = this.hideControls.controlProperties?.queueData?.propogation || 'S';
          const nonPropType = this.hideControls.controlProperties?.queueData?.nonPropogation || 'P';

          // Matching web's variable names exactly
          this.queService = response.Response;
          this.queService1 = response.Response.filter(q => q.QueueType === propType);
          this.PropService = response.Response.filter(q => q.QueueType === nonPropType);

          this.serviceErrorDbAlertslist1 = this.queService1.some(q => q.Color !== 'GREEN');
          this.serviceErrorDbAlertslist = this.PropService.some(q => q.Color !== 'GREEN');
          this.serviceErrorQueuelist = this.serviceErrorDbAlertslist1 || this.serviceErrorDbAlertslist;
        }
      },
      error: (error) => {
        console.error('Error loading queue alerts:', error);
        this.serviceErrorQueuelist = true;
      }
    });
  }

  /**
   * Check Queue Alert Status with polling (matching web method)
   */
  checkQueAlertStatus(): void {
    this.getQueueAlerts();
  }

  /**
   * Get DB Jobs (matching web method name)
   */
  getdbJobs(): void {
    this.commonService.post<DbJob[]>(
      '/utilities/getDbJobs',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS' && response.Response) {
          this.dbJobsData = response.Response;
          this.originalDbJobsData = response.Response;
          this.dbJobsList = response.Response;
          this.dbJoblist = response.Response.some(job => job.Broken === 'Y' || job.Active === 'Y');

          // Extract unique schemas (matching web logic)
          const schemas = [...new Set(response.Response.map(job => job.Schema))];
          this.schemaList = schemas.map(schema => ({
            Id: schema as string,
            Text: schema as string
          }));

          if (this.schemaList.length > 0 && !this.selectedSchema) {
            this.selectedSchema = this.schemaList[0].Id;
            this.onSchima(this.selectedSchema);
          }
        }
      },
      error: (error) => {
        console.error('Error loading DB jobs:', error);
        this.dbJoblist = true;
      }
    });
  }

  /**
   * Check DB Jobs Status with polling (matching web method)
   */
  checkDbJobsStatus(): void {
    this.getdbJobs();
  }

  /**
   * Schema change handler (matching web method name)
   */
  onSchima(schema: string): void {
    if (schema) {
      this.selectedSchema = schema;
      this.dbJobsData = this.originalDbJobsData.filter(job => job.Schema === schema);
      this.dbJobsList = this.dbJobsData;
      this.dbJoblist = this.dbJobsData.some(job => job.Broken === 'Y' || job.Active === 'Y');
    } else {
      this.dbJobsData = this.originalDbJobsData;
      this.dbJobsList = this.originalDbJobsData;
    }
  }

  /**
   * Start or Stop Service (matching web method name)
   */
  startOrStop(serviceName: string): void {
    if (!this.checkStatusAccessMatch(this.hideControls.controlProperties?.statusAccess, serviceName)) {
      this.commonService.showWarning('You do not have permission to modify this service');
      return;
    }

    this.commonService.post(
      `/utilities/startStopService/${serviceName}`,
      { UIData: this.uiData },
      { showLoader: true, showError: true }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS') {
          this.commonService.showSuccess(`Service ${serviceName} toggled successfully`);
          this.getServicesList();
        }
      },
      error: (error) => {
        console.error('Error toggling service:', error);
      }
    });
  }

  /**
   * Start or Stop Task (matching web method name)
   */
  startOrStopTask(taskName: string): void {
    this.commonService.post(
      `/utilities/startOrStopTask/${taskName}`,
      { UIData: this.uiData },
      { showLoader: true, showError: true }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS') {
          this.commonService.showSuccess(`Task ${taskName} toggled successfully`);
          this.getTasksList();
        }
      },
      error: (error) => {
        console.error('Error toggling task:', error);
      }
    });
  }

  /**
   * Process Confirm for View Logs (matching web method name)
   */
  processConfirm(serviceName: string, serverName: string): void {
    if (!this.checkLogsMatch(this.hideControls.controlProperties?.logs)) {
      this.commonService.showWarning('You do not have permission to view logs');
      return;
    }

    // this.dialog.open(ViewLogsDialogComponent, {
    //   width: '90%',
    //   maxWidth: '1200px',
    //   height: '80vh',
    //   data: {
    //     ServiceName: serviceName,
    //     ServerName: serverName,
    //     uiData: this.uiData
    //   }
    // });
  }

  /**
   * Refresh Services (matching web method name)
   */
  refreshServices(): void {
    this.searchKey = '';
    this.getServicesList();
  }

  /**
   * Change Input (matching web method name)
   */
  changeInput(): void {
    this.isClearBtnDisabled = false;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    this.statistics.totalServices = this.services.length;
    this.statistics.runningServices = this.services.filter(s => s.Status === 'Running').length;
    this.statistics.stoppedServices = this.services.filter(s => s.Status === 'Stopped').length;
    this.statistics.warningServices = this.services.filter(s =>
      s.Status !== 'Running' && s.Status !== 'Stopped'
    ).length;
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
   * Get queue color class
   */
  getQueueColorClass(color: string): string {
    return color === 'GREEN' ? 'queue-success' : 'queue-error';
  }

  /**
   * Get filtered services (matching web with | search pipe)
   */
  getFilteredServices(): WindowsService[] {
    let filtered = this.services;

    // Search filter (matching web's search pipe)
    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(s =>
        (s.ServiceName && s.ServiceName.toLowerCase().includes(search)) ||
        (s.Description && s.Description.toLowerCase().includes(search)) ||
        (s.ServerName && s.ServerName.toLowerCase().includes(search))
      );
    }

    // Status filter
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
   * Get filtered tasks
   */
  getFilteredTasks(): TaskScheduler[] {
    let filtered = this.tasks;

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(t =>
        (t.TaskName && t.TaskName.toLowerCase().includes(search)) ||
        (t.Description && t.Description.toLowerCase().includes(search))
      );
    }

    return filtered;
  }

  /**
   * Get filtered API services
   */
  getFilteredApiServices(): ApiService[] {
    let filtered = this.apiServiceData;

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(a =>
        a.WebAPIName && a.WebAPIName.toLowerCase().includes(search)
      );
    }

    return filtered;
  }

  /**
   * Get filtered queue services
   */
  getFilteredQueueServices(): QueueAlert[] {
    let filtered = this.queService1;

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(q =>
        (q.QueueName && q.QueueName.toLowerCase().includes(search)) ||
        (q.QueueDesc && q.QueueDesc.toLowerCase().includes(search))
      );
    }

    return filtered;
  }

  /**
   * Get filtered queue propagators
   */
  getFilteredQueuePropagators(): QueueAlert[] {
    let filtered = this.PropService;

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(q =>
        (q.QueueName && q.QueueName.toLowerCase().includes(search)) ||
        (q.QueueDesc && q.QueueDesc.toLowerCase().includes(search))
      );
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
   * Role-based access control helpers (EXACTLY matching web methods)
   */
  checkRolesMatch(roles: string[], serviceName?: string): boolean {
    if (serviceName === 'Spooler') {
      return true;
    }
    if (roles && roles.length) {
      const clientData = this.authService.getClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return false;
  }

  checkDescriptionMatch(roles: string[]): boolean {
    if (roles && roles.length) {
      const clientData = this.authService.getClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return false;
  }

  checkLogsMatch(roles: string[]): boolean {
    if (roles && roles.length) {
      const clientData = this.authService.getClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return false;
  }

  checkTabMatch(roles: string[]): boolean {
    if (roles && roles.length) {
      const clientData = this.authService.getClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return false;
  }

  checkStatusAccessMatch(roles: string[], serviceName?: string): boolean {
    if (roles && roles.length) {
      const clientData = this.authService.getClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return true;
  }

  /**
   * Refresh all data
   */
  refreshAll(): void {
    this.searchKey = '';
    this.statusFilter = 'all';
    this.loadAllServices();
    this.commonService.showSuccess('Data refreshed');
  }
}

// Interfaces (matching web models)
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

interface DbJob {
  Schema: string;
  JobName: string;
  LastRunDate: string;
  NextRunDate: string;
  Broken: 'Y' | 'N' | string;
  Active: 'Y' | 'N' | string;
  Failures: number;
}

interface ServiceStatistics {
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  warningServices: number;
}
