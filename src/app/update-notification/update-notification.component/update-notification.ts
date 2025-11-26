import { Component } from '@angular/core';
import { UpdateService } from '../../services/update';
import { Subject, takeUntil } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-update-notification',
  imports: [CommonModule,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatIconModule],
  templateUrl: './update-notification.html',
  styleUrl: './update-notification.scss',
})
export class UpdateNotificationComponent {
private destroy$ = new Subject<void>();

  showUpdateNotification = false;
  updateInfo: any = null;
  downloading = false;
  updateReady = false;
  progress: any = null;

  constructor(private updateService: UpdateService) {}

  ngOnInit() {
    this.updateService.updateAvailable$
      .pipe(takeUntil(this.destroy$))
      .subscribe(info => {
        if (info) {
          this.updateInfo = info;
          this.showUpdateNotification = true;
          this.downloading = false;
          this.updateReady = false;
        }
      });

    this.updateService.downloadProgress$
      .pipe(takeUntil(this.destroy$))
      .subscribe(progress => {
        if (progress) {
          this.progress = progress;
          this.downloading = true;
        }
      });

    this.updateService.updateDownloaded$
      .pipe(takeUntil(this.destroy$))
      .subscribe(ready => {
        if (ready) {
          this.downloading = false;
          this.updateReady = true;
        }
      });
  }

  downloadUpdate() {
    this.updateService.downloadUpdate();
    this.downloading = true;
  }

  installUpdate() {
    this.updateService.quitAndInstall();
  }

  dismissUpdate() {
    this.showUpdateNotification = false;
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
