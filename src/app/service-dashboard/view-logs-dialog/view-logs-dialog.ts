import { Component, Inject } from '@angular/core';
import { CommonService } from '../../services/common-service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-view-logs-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule],
  templateUrl: './view-logs-dialog.html',
  styleUrl: './view-logs-dialog.scss',
})
export class ViewLogsDialog {
serviceName: string = '';
  serverName: string = '';
  uiData: any;

  selectedModule: string = '';
  moduleList: LogFile[] = [];

  txtContentArr: LogContent[] = [];

  selectedLogFile: string = '';
  logFileList: LogFile[] = [];

  mainLogData: LogFileData[] = [];
  selectedFilePath: string = '';
  expandedIndex: number = 0;
  loading: boolean = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    public dialogRef: MatDialogRef<ViewLogsDialog>,
    private commonService: CommonService,
    private sanitizer: DomSanitizer
  ) {
    this.serviceName = data.ServiceName;
    this.serverName = data.ServerName;
    this.uiData = data.uiData;
  }

  ngOnInit(): void {
    this.getLogFiles();
  }

  /**
   * Get available log files from server
   */
  getLogFiles(): void {
    this.loading = true;

    this.commonService.post(
      `/utilities/GetServiceLogFilesDates/${this.serviceName}/${this.serverName}`,
      { UIData: this.uiData },
      { showLoader: false }
    ).subscribe({
      next: (response:any) => {
        this.loading = false;
        if (response.Status === 'PASS' && response.Response) {
          this.mainLogData = response.Response;
          this.logFileList = [];

          const fileNames = response.Response.map((item: LogFileData) => item.FileName);

          fileNames.forEach((fileName: string) => {
            this.logFileList.push({
              Id: fileName,
              Text: fileName
            });
          });

          // Auto-select if only one file
          if (fileNames.length === 1) {
            this.selectedLogFile = fileNames[0];
            this.onLogFileChange(this.selectedLogFile);
          }
        }
      },
      error: (error:any) => {
        this.loading = false;
        console.error('Error loading log files:', error);
        this.commonService.showError('Failed to load log files');
      }
    });
  }

  /**
   * Handle log file selection change
   */
  onLogFileChange(fileName: string): void {
    this.selectedLogFile = fileName;
    this.moduleList = [];
    this.selectedModule = '';
    this.txtContentArr = [];

    const data = this.mainLogData.find(item => item.FileName === fileName);

    if (data) {
      this.selectedFilePath = data.FilePath;

      data.FileDates.forEach((date: string) => {
        this.moduleList.push({
          Id: date,
          Text: date
        });
      });

      // Auto-select if only one date
      if (data.FileDates.length === 1) {
        this.selectedModule = data.FileDates[0];
        this.getLogContent();
      }
    }
  }

  /**
   * Handle date selection change
   */
  onModuleChange(date: string): void {
    this.selectedModule = date;
    this.getLogContent();
  }

  /**
   * Get log content for selected file and date
   */
  getLogContent(): void {
    if (!this.selectedModule || !this.selectedFilePath) {
      return;
    }

    this.loading = true;

    this.commonService.post(
      `/utilities/GetLogContents/${this.selectedModule}`,
      {
        UIData: this.uiData,
        LogUtil: { FileName: this.selectedFilePath }
      },
      { showLoader: false }
    ).subscribe({
      next: (response:any) => {
        this.loading = false;
        if (response.Status === 'PASS' && response.Response) {
          this.txtContentArr = [];
          this.expandedIndex = 0;

          response.Response.forEach((element: string) => {
            // Extract timestamp
            const timestampRegex = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/;
            const timestampMatch = timestampRegex.exec(element);
            const timestamp = timestampMatch ? timestampMatch[0] : 'No timestamp';

            // Check if log contains FAIL
            const failRegex = /"FAIL"/i;
            const hasFail = failRegex.test(element);

            // Create log entry
            this.txtContentArr.push({
              id: timestamp,
              safeHtml: this.sanitizer.bypassSecurityTrustHtml(element),
              css: hasFail ? 'panel_Fail' : 'panel_Pass'
            });
          });
        }
      },
      error: (error:any) => {
        this.loading = false;
        console.error('Error loading log content:', error);
        this.commonService.showError('Failed to load log content');
      }
    });
  }

  /**
   * Check if panel is expanded
   */
  isExpanded(index: number): boolean {
    return index === this.expandedIndex;
  }

  /**
   * Set expanded panel index
   */
  setExpandedIndex(index: number): void {
    this.expandedIndex = index;
  }

  /**
   * Clear all selections
   */
  clear(): void {
    this.selectedModule = '';
    this.selectedLogFile = '';
    this.moduleList = [];
    this.txtContentArr = [];
  }

  /**
   * Close dialog
   */
  cancelPopup(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }
}
interface LogFile {
  Id: string;
  Text: string;
}

interface LogContent {
  id: string;
  safeHtml: SafeHtml;
  css: string;
}

interface LogFileData {
  FileName: string;
  FilePath: string;
  FileDates: string[];
}
