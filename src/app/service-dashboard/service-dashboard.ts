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
import { PatchStatus, PatchStatusService } from '../services/patch-status.service';

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
  selectedSchema: string = 'All';

  // UI State
  selectedTab: number = 0;
  viewMode: string = 'table';
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

  configLoaded: boolean = false;
  dbJobsDisplayColumns: string[] = ['Id', 'Name', 'Schema', 'Broken', 'Active', 'LastRun', 'NextRun', 'Schedule', 'Failures'];
  private taskServerMapping: Map<string, string> = new Map();

  // Common Enum
  commonEnum = {
    Running: 'Running',
    Stopped: 'Stopped',
    GREEN: 'GREEN'
  };

  // API Error States
  apiErrors = {
    windowsServices: false,
    taskScheduler: false,
    apiServices: false,
    queueAlerts: false,
    dbJobs: false
  };

  errorMessages = {
    windowsServices: '',
    taskScheduler: '',
    apiServices: '',
    queueAlerts: '',
    dbJobs: ''
  };

  dataLoadedOnce = {
    windowsServices: false,
    taskScheduler: false,
    apiServices: false,
    queueAlerts: false,
    dbJobs: false
  };

  isSearchExpanded: boolean = false;
  private taskSchedulerPollingEnabled: boolean = false;
  private taskSchedulerPollingInterval: number = 60000;
  patchStatus: PatchStatus = { isPatching: false };
  private destroy$ = new Subject<void>();

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
    private dialog: MatDialog,
    private patchStatusService: PatchStatusService

  ) {
    this.initializeComponent();
  }

  ngOnInit(): void {
    this.loadControlConfiguration();
    this.patchStatusService.patchStatus$
      .pipe(takeUntil(this.destroy$))
      .subscribe(status => {
        this.patchStatus = status;

        // If patching starts, you can take additional actions:
        if (status.isPatching) {
          console.log('Patching started - disabling interactions');
          this.stopAllServicePolling(); // Example: stop your data polling
        } else {
          console.log('Patching completed - re-enabling interactions');
          this.startAllPolling(); // Example: restart your data polling
        }
      });
  }
  private stopAllServicePolling(): void {
    // Stop Windows Services polling
    this.windowsPolling$.next();

    // Stop Task Scheduler polling
    this.taskPolling$.next();

    // Stop API Services polling
    this.apiPolling$.next();

    // Stop Queue Alerts polling
    this.queuePolling$.next();

    // Stop DB Jobs polling
    this.dbJobsPolling$.next();

    console.log('All service polling stopped due to patching');
  }

  toggleSearchPanel(): void {
    this.isSearchExpanded = !this.isSearchExpanded;

    if (this.isSearchExpanded) {
      setTimeout(() => {
        const searchInput = document.querySelector('.expandable-search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }, 300);
    } else {
      this.searchKey = '';
    }
  }

  closeSearchPanel(): void {
    this.isSearchExpanded = false;
    this.searchKey = '';
  }

  checkLastRunTimeShow(show?: boolean | string[]): boolean {
    if (show === undefined || show === null) {
      return false;
    }

    if (typeof show === 'boolean') {
      return show;
    }

    if (Array.isArray(show) && show.length > 0) {
      const clientData = this.authService.getUpdatedClientData();
      return show.some(role => clientData.Roles?.includes(role));
    }

    return false;
  }

  get taskSchedulerDisplayColumns(): string[] {
    const columns = ['taskName'];

    if (this.checkTaskServerNameShow(this.hideControls.controlProperties?.taskScheduler?.taskServerName)) {
      columns.push('serverName');
    }

    columns.push('description');

    if (this.checkLastRunTimeShow(this.hideControls.controlProperties?.taskScheduler?.lastRunTimeShow)) {
      columns.push('lastRunTime');
    }

    columns.push('status');

    return columns;
  }

  checkTaskServerNameShow(config?: any): boolean {
    if (!config) {
      return false;
    }

    if (Array.isArray(config)) {
      const clientData = this.authService.getUpdatedClientData();
      return config.some(role => clientData.Roles?.includes(role));
    }

    if (config.roles && Array.isArray(config.roles)) {
      const clientData = this.authService.getUpdatedClientData();
      return config.roles.some((role: string) => clientData.Roles?.includes(role));
    }

    return false;
  }

  /**
   * ✅ UPDATED: Get task server name - prioritize API response over UI config mapping
   * Priority 1: If API response includes ServerName, use it directly
   * Priority 2: Fall back to UI config mapping (existing behavior)
   */
  getTaskServerName(task: TaskScheduler): string {
    if (!task) {
      return '';
    }

    // Priority 1: If API response includes ServerName, use it directly
    if (task?.ServerName) {
      return task.ServerName;
    }

    // Priority 2: Fall back to UI config mapping
    return this.taskServerMapping.get(task.TaskName) || '';
  }

  private buildTaskServerMapping(mappingConfig: any): void {
    this.taskServerMapping.clear();

    if (!mappingConfig) {
      return;
    }

    if (typeof mappingConfig === 'object' && !Array.isArray(mappingConfig)) {
      Object.keys(mappingConfig).forEach(taskName => {
        if (taskName !== 'roles' && typeof mappingConfig[taskName] === 'string') {
          this.taskServerMapping.set(taskName, mappingConfig[taskName]);
        }
      });
      return;
    }

    if (Array.isArray(mappingConfig)) {
      mappingConfig.forEach((item: any) => {
        if (item.taskName && item.serverName) {
          this.taskServerMapping.set(item.taskName, item.serverName);
        } else if (typeof item === 'string') {
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
            let config: any = JSON.parse(response.Response);
            this.applyControlConfiguration(config);
            this.parseTaskSchedulerPollingConfig(config);
          } catch (error) {
            console.error('Error parsing control config:', error);
          }
        }
        this.configLoaded = true;
        this.loadAllServices();
        this.startAllPolling();
        this.loadSavedPreferences();
      },
      error: (error) => {
        console.error('Error loading control config:', error);
        this.configLoaded = true;
        this.loadAllServices();
        this.startAllPolling();
        this.loadSavedPreferences();
      }
    });
  }

  private parseTaskSchedulerPollingConfig(config: any): void {
    if (config.taskSchedulerPolling) {
      const pollingConfig = config.taskSchedulerPolling;

      if (pollingConfig.enabled !== undefined) {
        this.taskSchedulerPollingEnabled = pollingConfig.enabled === true;
      }

      if (pollingConfig.timeLimit !== undefined && pollingConfig.timeLimit > 0) {
        this.taskSchedulerPollingInterval = pollingConfig.timeLimit * 1000;
      } else if (config.serviceTaskTimer !== undefined && config.serviceTaskTimer > 0) {
        this.taskSchedulerPollingInterval = config.serviceTaskTimer;
      }
    } else {
      if (config.serviceTaskTimer !== undefined && config.serviceTaskTimer > 0) {
        this.taskSchedulerPollingEnabled = true;
        this.taskSchedulerPollingInterval = config.serviceTaskTimer;
      } else {
        this.taskSchedulerPollingEnabled = false;
      }
    }
  }

  private handleDbJobsConfiguration(dbJobTab: any): void {
    if (dbJobTab.column && Array.isArray(dbJobTab.column)) {
      this.hideControls.controlProperties.dbJobTabColumns = dbJobTab.column;
    }
  }

  private applyControlConfiguration(config: any): void {
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

    if (config.canTaskSchedulerShow !== undefined) {
      this.hideControls.controlProperties.canTaskSchedulerShow = config.canTaskSchedulerShow.Show;
    }

    if (config.taskScheduler) {
      if (!this.hideControls.controlProperties.taskScheduler) {
        this.hideControls.controlProperties.taskScheduler = {};
      }

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

      if (config.taskScheduler.lastRunTimeShow !== undefined) {
        this.hideControls.controlProperties.taskScheduler.lastRunTimeShow = config.taskScheduler.lastRunTimeShow;
      }

      if (config.taskScheduler.taskServerName !== undefined) {
        this.hideControls.controlProperties.taskScheduler.taskServerName = config.taskScheduler.taskServerName;
        this.buildTaskServerMapping(config.taskScheduler.taskServerName);
      }
    }

    if (config.dbJobTab) {
      this.handleDbJobsConfiguration(config.dbJobTab);
    }

    if (config.gridDataOrder && config.gridDataOrder.length > 0) {
      this.dbJobsDisplayColumns = this.getDbJobsColumns(config.gridDataOrder, config.gridReqCols || config.gridDataOrder);
    } else {
      this.dbJobsDisplayColumns = ['Id', 'Name', 'Schema', 'Broken', 'LastRun', 'NextRun', 'Schedule', 'Failures'];
    }

    localStorage.setItem('controlConfig', JSON.stringify(this.hideControls));
  }

  private getDbJobsColumns(gridDataOrder: string[], gridReqCols: string[]): string[] {
    const columns: string[] = [];
    const excludedColumns = ['ClientId', 'SiteId'];

    gridDataOrder.forEach(col => {
      if (excludedColumns.includes(col)) {
        return;
      }

      if (gridReqCols.includes(col)) {
        if (this.checkDbJobColumnPermission(col)) {
          columns.push(col);
        }
      }
    });

    if (columns.length === 0) {
      return ['Id', 'Name', 'Schema', 'Broken', 'Active', 'LastRun', 'NextRun', 'Schedule', 'Failures'];
    }

    return columns;
  }

  private checkDbJobColumnPermission(column: string): boolean {
    const dbJobTabColumns = this.hideControls.controlProperties.dbJobTabColumns;

    if (!dbJobTabColumns || dbJobTabColumns.length === 0) {
      return true;
    }

    if (column === 'Broken' || column === 'Active') {
      return dbJobTabColumns.includes(column);
    }

    return true;
  }

  shouldShowDbJobColumn(columnName: string): boolean {
    return this.dbJobsDisplayColumns.includes(columnName);
  }

  ngOnDestroy(): void {
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
    this.destroy$.next();
    this.destroy$.complete()
  }

  private initializeComponent(): void {
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

  setViewMode(mode: string): void {
    this.viewMode = mode;
    localStorage.setItem('viewMode', mode);
  }

  onTabChange(index: number): void {
    this.selectedTab = index;
    localStorage.setItem('selectedTab', index.toString());
    this.searchKey = '';
    this.statusFilter = 'all';
  }

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

  private startAllPolling(): void {
    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowWindowsTab)) {
      timer(0, this.hideControls.controlProperties?.servicePollTimer || 2000)
        .pipe(takeUntil(this.windowsPolling$))
        .subscribe(() => this.checkStatus());
    }

    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowTaskScheTab)) {
      if (this.taskSchedulerPollingEnabled) {
        timer(0, this.taskSchedulerPollingInterval)
          .pipe(takeUntil(this.taskPolling$))
          .subscribe(() => this.getTasksList());
      } else {
        this.getTasksList();
      }
    }

    if (!this.checkTabMatch(this.hideControls.controlProperties?.allowApiTab)) {
      timer(0, this.hideControls.controlProperties?.apiStatusAlertPollTimer || 60000)
        .pipe(takeUntil(this.apiPolling$))
        .subscribe(() => this.checkApiServiceStatus());
    }

    if (this.checkTabMatch(this.hideControls.controlProperties?.allowQueueTab)) {
      timer(0, this.hideControls.controlProperties?.queueAlertPollTimer || 2000)
        .pipe(takeUntil(this.queuePolling$))
        .subscribe(() => this.checkQueAlertStatus());
    }

    if (this.checkTabMatch(this.hideControls.controlProperties?.dbJobs)) {
      timer(0, this.hideControls.controlProperties?.dbJobsPollTimer || 60000)
        .pipe(takeUntil(this.dbJobsPolling$))
        .subscribe(() => this.checkDbJobsStatus());
    }
  }

  getServicesList(serviceName?: any): void {
    this.commonService.post<WindowsService[]>(
      '/utilities/getServicesList',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (serviceName) {
          this.loadingServices.delete(serviceName);
        }
        if (response.Status === 'PASS' && response.Response) {
          this.services = response.Response;
          this.serviceError = response.Response.some(s => s.Status !== 'Running');
          this.updateStatistics();

          this.apiErrors.windowsServices = false;
          this.errorMessages.windowsServices = '';
          this.dataLoadedOnce.windowsServices = true;
        } else {
          this.handleApiError('windowsServices', 'Failed to load Windows Services data');
        }
      },
      error: (error) => {
        console.error('Error loading Windows services:', error);
        this.serviceError = true;

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

  checkStatus(): void {
    this.getServicesList();
  }

  getTasksList(taskName?: any): void {
    this.commonService.post<TaskScheduler[]>(
      '/utilities/getTasksList',
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response) => {
        if (taskName) {
          this.loadingTasks.delete(taskName);
        }
        if (response.Status === 'PASS' && response.Response) {
          this.tasks = response.Response;
          this.serviceErrorTaskList = response.Response.some(t => t.Status !== 'Running');

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
   * ✅ UPDATED: Group API services by server name
   * Priority 1: If API response includes ServerName, use it directly (no splitting)
   * Priority 2: Fall back to splitting WebAPIName format "APIName:ServerName" (existing behavior)
   */
  private groupApiServicesByServer(apiServices: ApiService[]): GroupedApiService[] {
    const serverMap = new Map<string, GroupedApiService>();

    apiServices.forEach(api => {
      let apiName: string;
      let serverName: string;

      // Priority 1: If API response includes ServerName, use it directly
      if (api.ServerName) {
        apiName = api.WebAPIName;  // Use full WebAPIName as-is
        serverName = api.ServerName;
      } else {
        // Priority 2: Fall back to splitting WebAPIName (existing behavior)
        // Format: "CommonAPI:tsgvm04133" or "ReceivingAPI:tsgvm04155"
        const parts = api.WebAPIName.split(':');
        apiName = parts[0] || api.WebAPIName;
        serverName = parts[1] || 'Unknown';
      }

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

    const groupedServices = Array.from(serverMap.values());

    groupedServices.forEach(serverGroup => {
      serverGroup.services.sort((a, b) => {
        const aIsRunning = a.status === 'Running' ? 1 : 0;
        const bIsRunning = b.status === 'Running' ? 1 : 0;

        if (aIsRunning !== bIsRunning) {
          return aIsRunning - bIsRunning;
        }

        return a.name.localeCompare(b.name);
      });
    });

    return groupedServices.sort((a, b) => {
      const aHasError = a.hasError ? 0 : 1;
      const bHasError = b.hasError ? 0 : 1;

      if (aHasError !== bHasError) {
        return aHasError - bHasError;
      }

      return a.serverName.localeCompare(b.serverName);
    });
  }

  checkApiServiceStatus(): void {
    this.getApiList();
  }

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

  checkQueAlertStatus(): void {
    this.getQueueAlerts();
  }

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

          const schemas = [...new Set(response.Response.map(job => job.Schema))];

          this.schemaList = [{ Id: "All", Text: "All" }];
          schemas.forEach(schema => {
            this.schemaList.push({
              Id: schema as string,
              Text: schema as string
            });
          });

          if (!this.selectedSchema || this.selectedSchema === '') {
            this.selectedSchema = 'All';
          }

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

  checkDbJobsStatus(): void {
    this.getdbJobs();
  }

  onSchima(schema: string): void {
    if (schema === 'All') {
      this.dbJobsData = [...this.originalDbJobsData];
      this.dbJobsList = [...this.originalDbJobsData];
    } else {
      this.dbJobsData = this.originalDbJobsData.filter(job => job.Schema === schema);
      this.dbJobsList = this.dbJobsData;
    }
    this.dbJoblist = this.dbJobsList.some(job => job.Broken === 'Y');
  }

  startOrStop(serviceName: string): void {
    if (this.patchStatus.isPatching) {
      this.commonService.showWarning('System maintenance in progress. Please wait.');
      return;
    }
    if (!this.checkStatusAccessMatch(this.hideControls.controlProperties?.statusAccess, serviceName)) {
      this.commonService.showWarning('You do not have permission to modify this service');
      return;
    }

    const service = this.services.find(s => s.ServiceName === serviceName);
    const currentStatus = service?.Status;
    const action = currentStatus === this.commonEnum.Running ? 'stop' : 'start';

    this.loadingServices.add(serviceName);

    this.commonService.post(
      `/utilities/startstop/${serviceName}`,
      { UIData: this.uiData },
      { showLoader: false, showError: true }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS') {
          const actionPastTense = action === 'start' ? 'started' : 'stopped';
          this.commonService.showSuccess(`Service '${serviceName}' ${actionPastTense} successfully`);
          this.getServicesList(serviceName);
        }
      },
      error: (error) => {
        console.error('Error toggling service:', error);
        const actionPresentTense = action === 'start' ? 'starting' : 'stopping';
        this.commonService.showError(`Failed ${actionPresentTense} service '${serviceName}'`);
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

  startOrStopTask(taskName: string): void {
    const task = this.tasks.find(t => t.TaskName === taskName);
    const currentStatus = task?.Status;
    const action = currentStatus === this.commonEnum.Running ? 'stop' : 'start';

    this.loadingTasks.add(taskName);

    this.commonService.post(
      `/utilities/taskstartstop/${taskName}`,
      { UIData: this.uiData },
      { showLoader: false, showError: true }
    ).subscribe({
      next: (response) => {
        if (response.Status === 'PASS') {
          const actionPastTense = action === 'start' ? 'started' : 'stopped';
          this.commonService.showSuccess(`Task '${taskName}' ${actionPastTense} successfully`);
          this.getTasksList(taskName);
        }
      },
      error: (error) => {
        console.error('Error toggling task:', error);
        const actionPresentTense = action === 'start' ? 'starting' : 'stopping';
        this.commonService.showError(`Failed ${actionPresentTense} task '${taskName}'`);
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

  changeInput(): void {
    this.isClearBtnDisabled = false;
  }

  private updateStatistics(): void {
    this.statistics.totalServices = this.services.length;
    this.statistics.runningServices = this.services.filter(s => s.Status === 'Running').length;
    this.statistics.stoppedServices = this.services.filter(s => s.Status === 'Stopped').length;
    this.statistics.warningServices = this.services.filter(s =>
      s.Status !== 'Running' && s.Status !== 'Stopped'
    ).length;
  }

  getStatusClass(status: string): string {
    if (status === 'Running') return 'status-running';
    if (status === 'Stopped') return 'status-stopped';
    return 'status-warning';
  }

  getCpuClass(cpu: number): string {
    if (cpu > 70) return 'cpu-high';
    if (cpu > 35) return 'cpu-medium';
    return 'cpu-low';
  }

  getQueueColorClass(color: string): string {
    return color === 'GREEN' ? 'queue-success' : 'queue-error';
  }

  getFilteredServices(): WindowsService[] {
    let filtered = this.services;

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(s =>
        (s.ServiceName && s.ServiceName.toLowerCase().includes(search)) ||
        (s.Description && s.Description.toLowerCase().includes(search)) ||
        (s.ServerName && s.ServerName.toLowerCase().includes(search))
      );
    }

    if (this.statusFilter !== 'all') {
      if (this.statusFilter === 'running') {
        filtered = filtered.filter(s => s.Status === 'Running');
      } else if (this.statusFilter === 'stopped') {
        filtered = filtered.filter(s => s.Status !== 'Running');
      }
    }

    return filtered.sort((a, b) => {
      const aIsStopped = a.Status !== 'Running' ? 0 : 1;
      const bIsStopped = b.Status !== 'Running' ? 0 : 1;

      if (aIsStopped !== bIsStopped) {
        return aIsStopped - bIsStopped;
      }

      const serverCompare = (a.ServerName || '').localeCompare(b.ServerName || '');
      if (serverCompare !== 0) {
        return serverCompare;
      }

      if (a.Status !== b.Status) {
        return a.Status === 'Running' ? 1 : -1;
      }

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

    const tasksWithIndex = filtered.map((task, index) => ({
      task,
      originalIndex: index
    }));

    const sorted = tasksWithIndex.sort((a, b) => {
      const aIsRunning = a.task.Status === 'Running' ? 1 : 0;
      const bIsRunning = b.task.Status === 'Running' ? 1 : 0;

      if (aIsRunning !== bIsRunning) {
        return aIsRunning - bIsRunning;
      }

      return a.originalIndex - b.originalIndex;
    });

    return sorted.map(item => item.task);
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

  getFilteredQueueAlerts(): QueueAlert[] {
    let filtered = this.queService;

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(q =>
        (q.QueueName && q.QueueName.toLowerCase().includes(search)) ||
        (q.QueueDesc && q.QueueDesc.toLowerCase().includes(search))
      );
    }

    return filtered.sort((a, b) => {
      const aIsError = a.Color !== this.commonEnum.GREEN ? 0 : 1;
      const bIsError = b.Color !== this.commonEnum.GREEN ? 0 : 1;

      if (aIsError !== bIsError) {
        return aIsError - bIsError;
      }

      return (a.QueueName || '').localeCompare(b.QueueName || '');
    });
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

    return filtered.sort((a, b) => {
      const aIsError = a.Color !== this.commonEnum.GREEN ? 0 : 1;
      const bIsError = b.Color !== this.commonEnum.GREEN ? 0 : 1;

      if (aIsError !== bIsError) {
        return aIsError - bIsError;
      }

      return (a.QueueName || '').localeCompare(b.QueueName || '');
    });
  }

  getFilteredQueuePropagators(): QueueAlert[] {
    let filtered = this.PropService;

    if (this.searchKey) {
      const search = this.searchKey.toLowerCase();
      filtered = filtered.filter(q =>
        (q.QueueName && q.QueueName.toLowerCase().includes(search)) ||
        (q.QueueDesc && q.QueueDesc.toLowerCase().includes(search))
      );
    }

    return filtered.sort((a, b) => {
      const aIsError = a.Color !== this.commonEnum.GREEN ? 0 : 1;
      const bIsError = b.Color !== this.commonEnum.GREEN ? 0 : 1;

      if (aIsError !== bIsError) {
        return aIsError - bIsError;
      }

      return (a.QueueName || '').localeCompare(b.QueueName || '');
    });
  }

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
    if (roles && roles.length) {
      const clientData = this.authService.getUpdatedClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return false;
  }

  checkStatusAccessMatch(roles: string[], serviceName?: string): boolean {
    if (roles && roles.length) {
      const clientData = this.authService.getUpdatedClientData();
      return roles.some(role => clientData.Roles?.includes(role));
    }
    return true;
  }

  refreshAll(): void {
    this.searchKey = '';
    this.statusFilter = 'all';
    this.loadAllServices();
    this.commonService.showSuccess('Data refreshed');
  }
}

// Interfaces
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
  ServerName?: string;  // ✅ Optional: comes from API response
}

interface ApiService {
  WebAPIName: string;
  Status: string;
  Url?: string;
  ServerName?: string;  // ✅ Optional: comes from API response
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
