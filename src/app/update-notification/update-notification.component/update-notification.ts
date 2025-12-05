import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { Subject, takeUntil } from 'rxjs';
import { UpdateService } from '../../services/update';
import { UpdateDialog } from '../../update-dialog/update-dialog';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-update-notification',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatIconModule
  ],
  template: ``,
  styles: []
})
export class UpdateNotificationComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private dialogRef: any = null;

  constructor(
    private updateService: UpdateService,
    private dialog: MatDialog
  ) {
    console.log('🔧 UpdateNotificationComponent: Constructor called');
  }

  ngOnInit() {
    console.log('🔧 UpdateNotificationComponent: ngOnInit called');

    this.updateService.updateAvailable$
      .pipe(takeUntil(this.destroy$))
      .subscribe(info => {
        console.log('🔧 UpdateNotificationComponent: updateAvailable$ received:', info);
        if (info && !this.dialogRef) {
          console.log('🔧 UpdateNotificationComponent: OPENING DIALOG NOW!');
          this.showUpdateDialog(info);
        }
      });

    this.updateService.downloadProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        if (progress && this.dialogRef) {
          console.log('🔧 UpdateNotificationComponent: Updating progress:', progress.percent);
          // CRITICAL FIX: Check if dialog still exists before calling updateProgress
          if (this.dialogRef.componentInstance) {
            this.dialogRef.componentInstance.updateProgress(progress.percent);
          }
        }
      });

    this.updateService.updateDownloaded$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ready => {
        if (ready && this.dialogRef) {
          console.log('🔧 UpdateNotificationComponent: Download complete!');
          // CRITICAL FIX: Check if dialog still exists before calling setDownloaded
          if (this.dialogRef.componentInstance) {
            this.dialogRef.componentInstance.setDownloaded();
          }
        }
      });
  }

  private showUpdateDialog(updateInfo: any) {
    this.dialogRef = this.dialog.open(UpdateDialog, {
      width: '500px',
      disableClose: false,
      data: updateInfo,
      panelClass: 'update-dialog'
    });

    // Subscribe to download action from dialog
    this.dialogRef.componentInstance.downloadClicked.subscribe(() => {
      console.log('🔧 UpdateNotificationComponent: Download clicked, starting download');
      this.updateService.downloadUpdate();
    });

    this.dialogRef.afterClosed().subscribe((result: string) => {
      console.log('🔧 UpdateNotificationComponent: Dialog closed with:', result);

      if (result === 'install') {
        console.log('🔧 UpdateNotificationComponent: Installing update and quitting');
        this.updateService.quitAndInstall();
      } else {
        // Clear dialog ref when closed
        console.log('🔧 UpdateNotificationComponent: Clearing dialog reference');
        this.dialogRef = null;
      }
    });
  }

  ngOnDestroy() {
    console.log('🔧 UpdateNotificationComponent: ngOnDestroy called');
    this.destroy$.next();
    this.destroy$.complete();
    if (this.dialogRef) {
      this.dialogRef.close();
    }
  }
}
