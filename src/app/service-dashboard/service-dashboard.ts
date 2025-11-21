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
import { ViewLogsDialog } from './view-logs-dialog/view-logs-dialog';
import { EngineResult } from '../models/app-config.models';
import { StorageKey } from '../enums/app-constants.enum';
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
  loadingServices: Set<string> = new Set();
  loadingTasks: Set<string> = new Set();
  hideControls: EngineResult = new EngineResult();

  // UI Data
  uiData: UIData = {
    OperationId: '6850',
    OperCategory: 'WINDOWSSERVICES'
  };

  // Service Data
  services: WindowsService[] = [];
  tasks: TaskScheduler[] = [];
  apiServiceData: ApiService[] = [];
  groupedApiServices: GroupedApiService[] = [];
  queService: QueueAlert[] = [];
  queService1: QueueAlert[] = [];
  PropService: QueueAlert[] = [];
  dbJobsList: DbJob[] = [];
  dbJobsData: DbJob[] = [];
  originalDbJobsData: DbJob[] = [];

  // Schema Selection for DB Jobs
  schemaList: { Id: string; Text: string }[] = [];
  selectedSchema: string = 'All'; // Default to "All"

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

  // Status Indicators
  serviceError: boolean = false;
  serviceErrorTaskList: boolean = false;
  serviceErrorApilist: boolean = false;
  serviceErrorQueuelist: boolean = false;
  dbJoblist: boolean = false;
  serviceErrorDbAlertslist: boolean = false;
  serviceErrorDbAlertslist1: boolean = false;

  // Polling
  private deviceStopPolling = new Subject<void>();
  private windowsPolling$ = new Subject<void>();
  private taskPolling$ = new Subject<void>();
  private apiPolling$ = new Subject<void>();
  private queuePolling$ = new Subject<void>();
  private dbJobsPolling$ = new Subject<void>();

  // Add property to track if config is loaded
  configLoaded: boolean = false;
  // DB Jobs column configuration (excludes ClientId and SiteId)
  dbJobsDisplayColumns: string[] = ['Id', 'Name', 'Schema', 'Broken', 'Active', 'LastRun', 'NextRun', 'Schedule', 'Failures'];
  private taskServerMapping: Map<string, string> = new Map();

  // Common Enum (matching web)
  commonEnum = {
    Running: 'Running',
    Stopped: 'Stopped',
    GREEN: 'GREEN'
  };

  // API Error States for each tab
  apiErrors = {
    windowsServices: false,
    taskScheduler: false,
    apiServices: false,
    queueAlerts: false,
    dbJobs: false
  };

  // Error messages for each tab
  errorMessages = {
    windowsServices: '',
    taskScheduler: '',
    apiServices: '',
    queueAlerts: '',
    dbJobs: ''
  };

  // Track if data has been loaded at least once
  dataLoadedOnce = {
    windowsServices: false,
    taskScheduler: false,
    apiServices: false,
    queueAlerts: false,
    dbJobs: false
  };


  // Column definitions for Material Table
  get displayedColumns(): string[] {
    const columns = ['serviceName'];
    columns.push('status');

    if (this.checkRolesMatch(this.hideControls.controlProperties?.serverName)) {
      columns.push('serverName');
    }

    if (this.checkLogsMatch(this.hideControls.controlProperties?.logs)) {
      columns.push('logs');
    }
    if (this.checkDescriptionMatch(this.hideControls.controlProperties?.description)) {
      columns.push('description');
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
    this.loadControlConfiguration();
    // let clientData = this.authService.getUpdatedClientData();
    // clientData.Roles = ['SERVICEADMIN'];
    // localStorage.setItem(StorageKey.CLIENT_DATA, JSON.stringify(clientData))
  }

  checkLastRunTimeShow(show?: boolean | string[]): boolean {
    // If not configured, default to false (hide by default)
    if (show === undefined || show === null) {
      return false;
    }

    // If it's a boolean, return it directly
    if (typeof show === 'boolean') {
      return show;
    }

    // If it's an array of roles, check user roles
    if (Array.isArray(show) && show.length > 0) {
      const clientData = this.authService.getUpdatedClientData();
      return show.some(role => clientData.Roles?.includes(role));
    }

    // Default to false if configuration is invalid
    return false;
  }

  get taskSchedulerDisplayColumns(): string[] {
    const columns = ['taskName'];

    // Conditionally add serverName column (after taskName, before description)
    if (this.checkTaskServerNameShow(this.hideControls.controlProperties?.taskScheduler?.taskServerName)) {
      columns.push('serverName');
    }

    // Add description column
    columns.push('description');

    // Conditionally add lastRunTime column
    if (this.checkLastRunTimeShow(this.hideControls.controlProperties?.taskScheduler?.lastRunTimeShow)) {
      columns.push('lastRunTime');
    }

    // Always show status column
    columns.push('status');

    return columns;
  }

  checkTaskServerNameShow(config?: any): boolean {
    // If not configured, default to false (hide by default)
    if (!config) {
      return false;
    }

    // If it's an array of roles, check user roles
    if (Array.isArray(config)) {
      const clientData = this.authService.getUpdatedClientData();
      return config.some(role => clientData.Roles?.includes(role));
    }

    // If it's an object with roles property
    if (config.roles && Array.isArray(config.roles)) {
      const clientData = this.authService.getUpdatedClientData();
      return config.roles.some((role: string) => clientData.Roles?.includes(role));
    }

    // Default to false
    return false;
  }

  getTaskServerName(taskName: string): string {
    if (!taskName) {
      return '';
    }

    // Return mapped server name or empty string
    return this.taskServerMapping.get(taskName) || '';
  }

  private buildTaskServerMapping(mappingConfig: any): void {
    this.taskServerMapping.clear();

    if (!mappingConfig) {
      return;
    }

    // Format 1: Object with taskName as key
    // Example: { "JRSocketClient": "tsgvm03520", "JR-WMx CRTC1 Web Socket": "tsgvm04373" }
    if (typeof mappingConfig === 'object' && !Array.isArray(mappingConfig)) {
      Object.keys(mappingConfig).forEach(taskName => {
        if (taskName !== 'roles' && typeof mappingConfig[taskName] === 'string') {
          this.taskServerMapping.set(taskName, mappingConfig[taskName]);
        }
      });
      return;
    }

    // Format 2: Array of objects
    // Example: [{ taskName: "JRSocketClient", serverName: "tsgvm03520" }]
    if (Array.isArray(mappingConfig)) {
      mappingConfig.forEach((item: any) => {
        if (item.taskName && item.serverName) {
          this.taskServerMapping.set(item.taskName, item.serverName);
        } else if (typeof item === 'string') {
          // Format 3: String format "TaskName=>ServerName"
          const parts = item.split('=>');
          if (parts.length === 2) {
            this.taskServerMapping.set(parts[0].trim(), parts[1].trim());
          }
        }
      });
    }
  }

  private loadControlConfiguration(): void {
    this.commonService.post<string>(
      '/common/getControlConfig',
      {
        ControlConfig: {
          Module: 'UTL',
          OperationId: '6850'
        }
      },
      { showLoader: true }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS' && response.Response) {
          try {
            // Parse the JSON string response
            let config:any = JSON.parse(response.Response);
            config.logs=["DEVELOPER"]

            // config.taskScheduler = {
            //   "taskServerName": {
            //     "roles": ["DEVELOPER", "SERVICEADMIN"],
            //     "JRSocketClient": "tsgvm04373",
            //     "JR-WMx CRTC1 Web Socket": "tsgvm03520",
            //     "JR-WMx CRTC1 Update Order Info Web Socket":"tsgvm03520"
            //   }
            // }
            this.applyControlConfiguration(config);
          } catch (error) {
            console.error('Error parsing control config:', error);
          }
        }
        this.configLoaded = true;
        // Load services after config is loaded
        this.loadAllServices();
        this.startAllPolling();
        this.loadSavedPreferences();
      },
      error: (error) => {
        console.error('Error loading control config:', error);
        // Use default config if API fails
        this.configLoaded = true;
        this.loadAllServices();
        this.startAllPolling();
        this.loadSavedPreferences();
      }
    });
  }

  private handleDbJobsConfiguration(dbJobTab: any): void {
    if (dbJobTab.column && Array.isArray(dbJobTab.column)) {
      // Store which columns are allowed based on roles
      this.hideControls.controlProperties.dbJobTabColumns = dbJobTab.column;
    }
  }

  private applyControlConfiguration(config: any): void {
    console.log('Applying control configuration:', config);

    if (config.allowWindowsTab !== undefined) {
      this.hideControls.controlProperties.allowWindowsTab = config.allowWindowsTab;
    }
    if (config.allowTaskScheTab !== undefined) {
      this.hideControls.controlProperties.allowTaskScheTab = config.allowTaskScheTab;
    }
    if (config.allowApiTab !== undefined) {
      this.hideControls.controlProperties.allowApiTab = config.allowApiTab;
    }
    if (config.allowQueueTab !== undefined) {
      this.hideControls.controlProperties.allowQueueTab = config.allowQueueTab;
    }
    if (config.allowQueueservicesTab !== undefined) {
      this.hideControls.controlProperties.allowQueueservicesTab = config.allowQueueservicesTab;
    }
    if (config.allowQueuepropogatorsTab !== undefined) {
      this.hideControls.controlProperties.allowQueuepropogatorsTab = config.allowQueuepropogatorsTab;
    }
    if (config.dbJobs !== undefined) {
      this.hideControls.controlProperties.dbJobs = config.dbJobs;
    }

    if (config.description !== undefined) {
      this.hideControls.controlProperties.description = config.description;
    }
    if (config.serverName !== undefined) {
      this.hideControls.controlProperties.serverName = config.serverName;
    }
    if (config.logs !== undefined) {
      this.hideControls.controlProperties.logs = config.logs;
    }
    if (config.memoryUtilization !== undefined) {
      this.hideControls.controlProperties.memoryUtilization = config.memoryUtilization;
    }
    if (config.ThreadCount !== undefined) {
      this.hideControls.controlProperties.ThreadCount = config.ThreadCount;
    }
    if (config.processUtilization !== undefined) {
      this.hideControls.controlProperties.processUtilization = config.processUtilization;
    }
    if (config.CpuUtilization !== undefined) {
      this.hideControls.controlProperties.CpuUtilization = config.CpuUtilization;
    }
    if (config.Threshold !== undefined) {
      this.hideControls.controlProperties.Threshold = config.Threshold;
    }
    if (config.statusAccess !== undefined) {
      this.hideControls.controlProperties.statusAccess = config.statusAccess;
    }

    // Handle Task Scheduler visibility
    if (config.canTaskSchedulerShow !== undefined) {
      this.hideControls.controlProperties.canTaskSchedulerShow = config.canTaskSchedulerShow.Show;
    }

    // ===== UPDATED SECTION: Handle Task Scheduler configuration =====
    if (config.taskScheduler) {
      if (!this.hideControls.controlProperties.taskScheduler) {
        this.hideControls.controlProperties.taskScheduler = {};
      }

      // Handle labels
      if (config.taskScheduler.taskNameLbl) {
        this.hideControls.controlProperties.taskScheduler.taskNameLbl = config.taskScheduler.taskNameLbl;
      }
      if (config.taskScheduler.desctiptionLbl) {
        this.hideControls.controlProperties.taskScheduler.desctiptionLbl = config.taskScheduler.desctiptionLbl;
      }
      if (config.taskScheduler.serverNameLbl) {
        this.hideControls.controlProperties.taskScheduler.serverNameLbl = config.taskScheduler.serverNameLbl;
      }
      if (config.taskScheduler.lastRunTimeLbl) {
        this.hideControls.controlProperties.taskScheduler.lastRunTimeLbl = config.taskScheduler.lastRunTimeLbl;
      }
      if (config.taskScheduler.statusLbl) {
        this.hideControls.controlProperties.taskScheduler.statusLbl = config.taskScheduler.statusLbl;
      }

      // Handle lastRunTimeShow configuration
      if (config.taskScheduler.lastRunTimeShow !== undefined) {
        this.hideControls.controlProperties.taskScheduler.lastRunTimeShow = config.taskScheduler.lastRunTimeShow;
      }

      // ===== NEW: Handle taskServerName configuration =====
      if (config.taskScheduler.taskServerName !== undefined) {
        this.hideControls.controlProperties.taskScheduler.taskServerName = config.taskScheduler.taskServerName;
        // Build the mapping when configuration is loaded
        this.buildTaskServerMapping(config.taskScheduler.taskServerName);
      }
    }

    // Handle DB Jobs configuration
    if (config.dbJobTab) {
      this.handleDbJobsConfiguration(config.dbJobTab);
    }

    // Handle grid data order for DB Jobs
    if (config.gridDataOrder && config.gridDataOrder.length > 0) {
      this.dbJobsDisplayColumns = this.getDbJobsColumns(config.gridDataOrder, config.gridReqCols || config.gridDataOrder);
    } else {
      // Default columns if not specified - use API field names (without ClientId and SiteId)
      this.dbJobsDisplayColumns = ['Id', 'Name', 'Schema', 'Broken', 'LastRun', 'NextRun', 'Schedule', 'Failures'];
    }

    // Save updated config to localStorage
    localStorage.setItem('controlConfig', JSON.stringify(this.hideControls));
  }


  private getDbJobsColumns(gridDataOrder: string[], gridReqCols: string[]): string[] {
    const columns: string[] = [];
    // Excluded columns that should not be displayed
    const excludedColumns = ['ClientId', 'SiteId'];

    // Add columns based on gridDataOrder - use API field names directly
    gridDataOrder.forEach(col => {
      // Skip excluded columns
      if (excludedColumns.includes(col)) {
        return;
      }

      if (gridReqCols.includes(col)) {
        // Check role-based permission for this column
        if (this.checkDbJobColumnPermission(col)) {
          columns.push(col);  // Use API field name directly
        }
      }
    });

    // If no columns determined, use defaults (without ClientId and SiteId)
    if (columns.length === 0) {
      return ['Id', 'Name', 'Schema', 'Broken', 'Active', 'LastRun', 'NextRun', 'Schedule', 'Failures'];
    }

    return columns;
  }

  private checkDbJobColumnPermission(column: string): boolean {
    const dbJobTabColumns = this.hideControls.controlProperties.dbJobTabColumns;

    // If no specific column restrictions, allow all required columns
    if (!dbJobTabColumns || dbJobTabColumns.length === 0) {
      return true;
    }

    // For 'Broken' and 'Active' columns, check if they're in the allowed list
    if (column === 'Broken' || column === 'Active') {
      return dbJobTabColumns.includes(column);
    }

    // Allow all other columns by default
    return true;
  }

  shouldShowDbJobColumn(columnName: string): boolean {
    return this.dbJobsDisplayColumns.includes(columnName);
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
      timer(0, this.hideControls.controlProperties?.servicePollTimer || 2000)
        .pipe(takeUntil(this.windowsPolling$))
        .subscribe(() => this.checkStatus());
    }

    // Task Schedulers Polling
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowTaskScheTab)) {
      timer(0, this.hideControls.controlProperties?.serviceTaskTimer || 2000)
        .pipe(takeUntil(this.taskPolling$))
        .subscribe(() => this.getTasksList());
    }

    // API Services Polling - matches web's checkApiServiceStatus()
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowApiTab)) {
      timer(0, this.hideControls.controlProperties?.apiStatusAlertPollTimer || 6000)
        .pipe(takeUntil(this.apiPolling$))
        .subscribe(() => this.checkApiServiceStatus());
    }

    // Queue Alerts Polling - matches web's checkQueAlertStatus()
    if (this.checkTabMatch(this.hideControls.controlProperties?.allowQueueTab)) {
      timer(0, this.hideControls.controlProperties?.queueAlertPollTimer || 6000)
        .pipe(takeUntil(this.queuePolling$))
        .subscribe(() => this.checkQueAlertStatus());
    }

    // DB Jobs Polling - matches web's checkDbJobsStatus()
    if (this.checkTabMatch(this.hideControls.controlProperties?.dbJobs)) {
      timer(0, this.hideControls.controlProperties?.dbJobsPollTimer || 6000)
        .pipe(takeUntil(this.dbJobsPolling$))
        .subscribe(() => this.checkDbJobsStatus());
    }
  }

  /**
   * Get Windows Services (matching web method name)
   */
 getServicesList(serviceName?: any): void {
    this.commonService.post<WindowsService[]>(
      '/utilities/getServicesList',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (serviceName) {
          this.loadingServices.delete(serviceName);
          this.commonService.showSuccess(`Service ${serviceName} toggled successfully`);
        }
        if (response.Status === 'PASS' && response.Response) {
          this.services = response.Response;
          this.serviceError = response.Response.some(s => s.Status !== 'Running');
          this.updateStatistics();

          // Clear error state on success
          this.apiErrors.windowsServices = false;
          this.errorMessages.windowsServices = '';
          this.dataLoadedOnce.windowsServices = true;
        } else {
          // API returned but with error status
          this.handleApiError('windowsServices', 'Failed to load Windows Services data');
        }
      },
      error: (error) => {
        console.error('Error loading Windows services:', error);
        this.serviceError = true;

        // Determine error message based on error type
        let errorMsg = 'Unable to connect to server. Please check your network connection.';
        if (error.status === 0) {
          errorMsg = 'Network connection lost. Please check your VPN or internet connection.';
        } else if (error.status === 504 || error.status === 408) {
          errorMsg = 'Request timeout. The server is taking too long to respond.';
        } else if (error.status >= 500) {
          errorMsg = 'Server error occurred. Please try again later.';
        }

        this.handleApiError('windowsServices', errorMsg);
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
getTasksList(taskName?: any): void {
    this.commonService.post<TaskScheduler[]>(
      '/utilities/getTasksList',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (taskName) {
          this.commonService.showSuccess(`Task ${taskName} toggled successfully`);
          this.loadingTasks.delete(taskName);
        }
        if (response.Status === 'PASS' && response.Response) {
          this.tasks = response.Response;
          this.serviceErrorTaskList = response.Response.some(t => t.Status !== 'Running');

          // Clear error state on success
          this.apiErrors.taskScheduler = false;
          this.errorMessages.taskScheduler = '';
          this.dataLoadedOnce.taskScheduler = true;
        } else {
          this.handleApiError('taskScheduler', 'Failed to load Task Scheduler data');
        }
      },
      error: (error) => {
        console.error('Error loading task schedulers:', error);
        this.serviceErrorTaskList = true;

        let errorMsg = 'Unable to connect to server. Please check your network connection.';
        if (error.status === 0) {
          errorMsg = 'Network connection lost. Please check your VPN or internet connection.';
        } else if (error.status === 504 || error.status === 408) {
          errorMsg = 'Request timeout. The server is taking too long to respond.';
        } else if (error.status >= 500) {
          errorMsg = 'Server error occurred. Please try again later.';
        }

        this.handleApiError('taskScheduler', errorMsg);
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
          this.groupedApiServices = this.groupApiServicesByServer(response.Response);
          this.serviceErrorApilist = response.Response.some(a => a.Status !== 'Running');

          // Clear error state on success
          this.apiErrors.apiServices = false;
          this.errorMessages.apiServices = '';
          this.dataLoadedOnce.apiServices = true;
        } else {
          this.handleApiError('apiServices', 'Failed to load API Services data');
        }
      },
      error: (error) => {
        console.error('Error loading API services:', error);
        this.serviceErrorApilist = true;

        let errorMsg = 'Unable to connect to server. Please check your network connection.';
        if (error.status === 0) {
          errorMsg = 'Network connection lost. Please check your VPN or internet connection.';
        } else if (error.status === 504 || error.status === 408) {
          errorMsg = 'Request timeout. The server is taking too long to respond.';
        } else if (error.status >= 500) {
          errorMsg = 'Server error occurred. Please try again later.';
        }

        this.handleApiError('apiServices', errorMsg);
      }
    });
  }

  /**
   * Group API services by server name
   * Parse WebAPIName format: "APIName:ServerName"
   */
  private groupApiServicesByServer(apiServices: ApiService[]): GroupedApiService[] {
    // Create a map to group services by server
    const serverMap = new Map<string, GroupedApiService>();

    apiServices.forEach(api => {
      // Parse the WebAPIName to extract API name and server name
      // Format: "CommonAPI:tsgvm04133" or "ReceivingAPI:tsgvm04155"
      const parts = api.WebAPIName.split(':');
      const apiName = parts[0] || api.WebAPIName;
      const serverName = parts[1] || 'Unknown';

      if (!serverMap.has(serverName)) {
        serverMap.set(serverName, {
          serverName: serverName,
          services: [],
          hasError: false
        });
      }

      const serverGroup = serverMap.get(serverName)!;

      serverGroup.services.push({
        name: apiName,
        status: api.Status
      });

      if (api.Status !== 'Running') {
        serverGroup.hasError = true;
      }
    });

    return Array.from(serverMap.values()).sort((a, b) =>
      a.serverName.localeCompare(b.serverName)
    );
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

          this.queService = response.Response;
          this.queService1 = response.Response.filter(q => q.QueueType === propType);
          this.PropService = response.Response.filter(q => q.QueueType === nonPropType);

          this.serviceErrorDbAlertslist1 = this.queService1.some(q => q.Color !== 'GREEN');
          this.serviceErrorDbAlertslist = this.PropService.some(q => q.Color !== 'GREEN');
          this.serviceErrorQueuelist = this.serviceErrorDbAlertslist1 || this.serviceErrorDbAlertslist;

          // Clear error state on success
          this.apiErrors.queueAlerts = false;
          this.errorMessages.queueAlerts = '';
          this.dataLoadedOnce.queueAlerts = true;
        } else {
          this.handleApiError('queueAlerts', 'Failed to load Queue Alerts data');
        }
      },
      error: (error) => {
        console.error('Error loading queue alerts:', error);
        this.serviceErrorQueuelist = true;

        let errorMsg = 'Unable to connect to server. Please check your network connection.';
        if (error.status === 0) {
          errorMsg = 'Network connection lost. Please check your VPN or internet connection.';
        } else if (error.status === 504 || error.status === 408) {
          errorMsg = 'Request timeout. The server is taking too long to respond.';
        } else if (error.status >= 500) {
          errorMsg = 'Server error occurred. Please try again later.';
        }

        this.handleApiError('queueAlerts', errorMsg);
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
          this.dbJoblist = response.Response.some(job => job.Broken === 'Y');

          // Extract unique schemas
          const schemas = [...new Set(response.Response.map(job => job.Schema))];
          this.schemaList = schemas.map(schema => ({
            Id: schema as string,
            Text: schema as string
          }));

          if (this.schemaList.length > 0 && !this.selectedSchema) {
            this.selectedSchema = this.schemaList[0].Id;
            this.onSchima(this.selectedSchema);
          }

          // Clear error state on success
          this.apiErrors.dbJobs = false;
          this.errorMessages.dbJobs = '';
          this.dataLoadedOnce.dbJobs = true;
        } else {
          this.handleApiError('dbJobs', 'Failed to load DB Jobs data');
        }
      },
      error: (error) => {
        console.error('Error loading DB jobs:', error);
        this.dbJoblist = true;

        let errorMsg = 'Unable to connect to server. Please check your network connection.';
        if (error.status === 0) {
          errorMsg = 'Network connection lost. Please check your VPN or internet connection.';
        } else if (error.status === 504 || error.status === 408) {
          errorMsg = 'Request timeout. The server is taking too long to respond.';
        } else if (error.status >= 500) {
          errorMsg = 'Server error occurred. Please try again later.';
        }

        this.handleApiError('dbJobs', errorMsg);
      }
    });
  }
 private handleApiError(tabName: keyof typeof this.apiErrors, message: string): void {
  this.apiErrors[tabName] = true;
  this.errorMessages[tabName] = message;

  // Clear data when error occurs - no data should be shown
  switch (tabName) {
    case 'windowsServices':
      this.services = [];
      this.updateStatistics();
      break;
    case 'taskScheduler':
      this.tasks = [];
      break;
    case 'apiServices':
      this.apiServiceData = [];
      this.groupedApiServices = [];
      break;
    case 'queueAlerts':
      this.queService = [];
      this.queService1 = [];
      this.PropService = [];
      break;
    case 'dbJobs':
      this.dbJobsData = [];
      this.dbJobsList = [];
      this.originalDbJobsData = [];
      this.schemaList = [];
      break;
  }
}


 retryLoadData(tabName: string): void {
    switch (tabName) {
      case 'windowsServices':
        this.getServicesList();
        break;
      case 'taskScheduler':
        this.getTasksList();
        break;
      case 'apiServices':
        this.getApiList();
        break;
      case 'queueAlerts':
        this.getQueueAlerts();
        break;
      case 'dbJobs':
        this.getdbJobs();
        break;
    }
  }

  /**
   * Check DB Jobs Status with polling (matching web method)
   */
  checkDbJobsStatus(): void {
    this.getdbJobs();
  }

  /**
   * Schema change handler (matching web method name)
   * Empty value "" means "All" schemas
   */
  onSchima(schema: string): void {
    if (schema === 'All') {
      // "All" selected - show all jobs
      this.dbJobsData = this.originalDbJobsData;
      this.dbJobsList = this.originalDbJobsData;
    } else {
      // Specific schema selected - filter by schema
      this.dbJobsData = this.originalDbJobsData.filter(job => job.Schema === schema);
      this.dbJobsList = this.dbJobsData;
    }
    // Update error badge
    this.dbJoblist = this.dbJobsList.some(job => job.Broken === 'Y');
  }

  /**
   * Start or Stop Service (matching web method name)
   */
  startOrStop(serviceName: string): void {
    if (!this.checkStatusAccessMatch(this.hideControls.controlProperties?.statusAccess, serviceName)) {
      this.commonService.showWarning('You do not have permission to modify this service');
      return;
    }

    // Add service to loading set
    this.loadingServices.add(serviceName);

    this.commonService.post(
      `/utilities/startstop/${serviceName}`,
      { UIData: this.uiData },
      { showLoader: false, showError: true }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS') {
          this.getServicesList(serviceName);
        }
        // Remove from loading set

      },
      error: (error) => {
        console.error('Error toggling service:', error);
        // Remove from loading set on error too
        this.loadingServices.delete(serviceName);
      }
    });
  }

  isServiceLoading(serviceName: string): boolean {
    return this.loadingServices.has(serviceName);
  }

  getServiceButtonText(service: WindowsService): string {
    if (this.isServiceLoading(service.ServiceName)) {
      return service.Status === this.commonEnum.Running ? 'Stopping...' : 'Starting...';
    }
    return service.Status;
  }


  /**
   * Start or Stop Task (matching web method name)
   */
  startOrStopTask(taskName: string): void {
    // Add task to loading set
    this.loadingTasks.add(taskName);

    this.commonService.post(
      `/utilities/taskstartstop/${taskName}`,
      { UIData: this.uiData },
      { showLoader: false, showError: true }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS') {
          this.getTasksList(taskName);
        }
      },
      error: (error) => {
        console.error('Error toggling task:', error);
        this.loadingTasks.delete(taskName);
      }
    });
  }

  isTaskLoading(taskName: string): boolean {
    return this.loadingTasks.has(taskName);
  }

  getTaskButtonText(task: TaskScheduler): string {
    if (this.isTaskLoading(task.TaskName)) {
      return task.Status === this.commonEnum.Running ? 'Stopping...' : 'Starting...';
    }
    return task.Status;
  }

  /**
   * Process Confirm for View Logs (matching web method name)
   */
  processConfirm(serviceName: string, serverName: string): void {
    if (!this.checkLogsMatch(this.hideControls.controlProperties?.logs)) {
      this.commonService.showWarning('You do not have permission to view logs');
      return;
    }

    this.dialog.open(ViewLogsDialog, {
      width: '90%',
      maxWidth: '1200px',
      height: '80vh',
      data: {
        ServiceName: serviceName,
        ServerName: serverName,
        uiData: this.uiData
      }
    });
  }

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
   * NEW: Get filtered grouped services with search applied
   */
  getFilteredServices(): WindowsService[] {
    let filtered = this.services;

    // Apply search filter
    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(s =>
        (s.ServiceName && s.ServiceName.toLowerCase().includes(search)) ||
        (s.Description && s.Description.toLowerCase().includes(search)) ||
        (s.ServerName && s.ServerName.toLowerCase().includes(search))
      );
    }

    // Apply status filter
    if (this.statusFilter !== 'all') {
      if (this.statusFilter === 'running') {
        filtered = filtered.filter(s => s.Status === 'Running');
      } else if (this.statusFilter === 'stopped') {
        filtered = filtered.filter(s => s.Status !== 'Running');
      }
    }

    // Sort: Stopped services first (regardless of server), then by server name, then by status
    return filtered.sort((a, b) => {
      // First priority: Stopped services at top
      const aIsStopped = a.Status !== 'Running' ? 0 : 1;
      const bIsStopped = b.Status !== 'Running' ? 0 : 1;

      if (aIsStopped !== bIsStopped) {
        return aIsStopped - bIsStopped;
      }

      // Second priority: Group by server name
      const serverCompare = (a.ServerName || '').localeCompare(b.ServerName || '');
      if (serverCompare !== 0) {
        return serverCompare;
      }

      // Third priority: Within same server, stopped first
      if (a.Status !== b.Status) {
        return a.Status === 'Running' ? 1 : -1;
      }

      // Final: Sort by service name
      return (a.ServiceName || '').localeCompare(b.ServiceName || '');
    });
  }

  getFilteredTasks(): TaskScheduler[] {
  let filtered = this.tasks;

  if (this.searchKey) {
    const search = this.searchKey.toLowerCase();
    filtered = filtered.filter(t =>
      (t.TaskName && t.TaskName.toLowerCase().includes(search)) ||
      (t.Description && t.Description.toLowerCase().includes(search))
    );
  }

  // Sort: Stopped/Ready tasks first, then by task name
  return filtered.sort((a, b) => {
    // First priority: Non-running tasks at top (Ready, Stopped, etc.)
    const aIsRunning = a.Status === 'Running' ? 1 : 0;
    const bIsRunning = b.Status === 'Running' ? 1 : 0;

    if (aIsRunning !== bIsRunning) {
      return aIsRunning - bIsRunning;
    }

    // Second priority: Sort by status name (Ready before Stopped)
    if (a.Status !== b.Status) {
      return a.Status.localeCompare(b.Status);
    }

    // Final: Sort by task name
    return (a.TaskName || '').localeCompare(b.TaskName || '');
  });
}

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
   * Get filtered queue alerts (combines all queues regardless of type)
   */
  getFilteredQueueAlerts(): QueueAlert[] {
    let filtered = this.queService; // All queues combined

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(q =>
        (q.QueueName && q.QueueName.toLowerCase().includes(search)) ||
        (q.QueueDesc && q.QueueDesc.toLowerCase().includes(search))
      );
    }

    return filtered;
  }

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

  checkRolesMatch(roles: string[], serviceName?: string): boolean {
    if (serviceName === 'Spooler') {
      return true;
    }
    if (roles && roles.length) {
      const clientData = this.authService.getUpdatedClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return false;
  }

  checkDescriptionMatch(roles: string[]): boolean {
    if (roles && roles.length) {
      const clientData = this.authService.getUpdatedClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return false;
  }

  checkLogsMatch(roles: string[]): boolean {
    if (roles && roles.length) {
      const clientData = this.authService.getUpdatedClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return false;
  }

  checkTabMatch(roles: string[]): boolean {
    console.log('checkTabMatch called with:', roles);
    console.log('hideControls.controlProperties?.allowQueueTab:', this.hideControls.controlProperties?.allowQueueTab);

    if (roles && roles.length) {
      const clientData = this.authService.getUpdatedClientData();
      console.log('User roles:', clientData.Roles);
      const result = roles.some(role => clientData.Roles?.includes(role));
      console.log('Match result:', result);
      return result;
    }
    console.log('Returning false - roles empty or undefined');
    return false;
  }

  checkStatusAccessMatch(roles: string[], serviceName?: string): boolean {
    if (roles && roles.length) {
      const clientData = this.authService.getUpdatedClientData();
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

interface GroupedApiService {
  serverName: string;
  services: {
    name: string;
    status: string;
  }[];
  hasError: boolean;
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
  ClientId: string | null;
  SiteId: string | null;
  Id: string;
  Name: string;
  Schema: string;
  LastRun: string;
  NextRun: string;
  Schedule: string;
  Broken: 'Y' | 'N';
  Active?: 'Y' | 'N';
  Failures?: number;
}

interface ServiceStatistics {
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  warningServices: number;
}
