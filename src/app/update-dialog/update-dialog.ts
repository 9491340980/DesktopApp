import { Component, Inject, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon'

@Component({
  selector: 'app-update-dialog',
  imports: [CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatProgressBarModule,
    MatIconModule],
  templateUrl: './update-dialog.html',
  styleUrl: './update-dialog.scss',
})
export class UpdateDialog implements OnInit {
  downloading = false;
  downloaded = false;
  progress = 0;

  @Output() downloadClicked = new EventEmitter<void>();

  constructor(
    public dialogRef: MatDialogRef<UpdateDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    console.log('🔧 UpdateDialog: Constructor called with data:', data);
    // CRITICAL: Disable closing by clicking outside or pressing ESC
    this.dialogRef.disableClose = true;
  }

  ngOnInit() {
    console.log('🔧 UpdateDialog: Auto-starting download in 1 second...');
    // CRITICAL: Auto-start download after 1 second
    setTimeout(() => {
      this.onDownload();
    }, 1000);
  }

  onDownload() {
    console.log('🔧 UpdateDialog: Download starting (mandatory)');
    this.downloading = true;
    // Emit event to parent to trigger actual download
    this.downloadClicked.emit();
  }

  onInstall() {
    console.log('🔧 UpdateDialog: Install button clicked (auto-installs anyway)');
    this.dialogRef.close('install');
  }

  onDismiss() {
    // REMOVED: No longer allow dismissing - mandatory update
    console.log('🔧 UpdateDialog: Dismiss attempted but blocked (mandatory update)');
  }

  updateProgress(percent: number) {
    console.log('🔧 UpdateDialog: Progress update:', percent);
    this.progress = Math.round(percent);
    this.downloading = true;
  }

  setDownloaded() {
    console.log('🔧 UpdateDialog: Download complete! Auto-install will happen in 3 seconds');
    this.downloading = false;
    this.downloaded = true;

    // Dialog will close automatically from main.js after 3 seconds
    // No user action needed - automatic install
  }
}
