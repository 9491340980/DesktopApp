import { Component, Inject, EventEmitter, Output } from '@angular/core';
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
export class UpdateDialog {
  downloading = false;
  downloaded = false;
  progress = 0;

  @Output() downloadClicked = new EventEmitter<void>();

  constructor(
    public dialogRef: MatDialogRef<UpdateDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    console.log('🔧 UpdateDialog: Constructor called with data:', data);
  }

  onDownload() {
    console.log('🔧 UpdateDialog: Download button clicked');
    this.downloading = true;
    // CRITICAL FIX: Don't close dialog, just emit event and change state
    this.downloadClicked.emit();
  }

  onInstall() {
    console.log('🔧 UpdateDialog: Install button clicked');
    this.dialogRef.close('install');
  }

  onDismiss() {
    console.log('🔧 UpdateDialog: Dismiss button clicked');
    this.dialogRef.close('dismiss');
  }

  updateProgress(percent: number) {
    console.log('🔧 UpdateDialog: Progress update:', percent);
    this.progress = Math.round(percent);
    this.downloading = true;
  }

  setDownloaded() {
    console.log('🔧 UpdateDialog: Download complete, showing install prompt');
    this.downloading = false;
    this.downloaded = true;
  }
}
