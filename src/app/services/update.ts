import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

declare const window: any;

@Injectable({
  providedIn: 'root'
})
export class UpdateService {
  private updateAvailable = new BehaviorSubject<any>(null);
  private downloadProgress = new BehaviorSubject<any>(null);
  private updateDownloaded = new BehaviorSubject<boolean>(false);

  updateAvailable$ = this.updateAvailable.asObservable();
  downloadProgress$ = this.downloadProgress.asObservable();
  updateDownloaded$ = this.updateDownloaded.asObservable();

  constructor() {
    console.log('✅ UpdateService: Constructor called');
    if (this.isElectron()) {
      this.setupUpdateListeners();
    } else {
      console.log('⚠️ UpdateService: Not running in Electron');
    }
  }

  private isElectron(): boolean {
    return !!(window && window.require);
  }

  private setupUpdateListeners() {
    try {
      const { ipcRenderer } = window.require('electron');
      console.log('✅ UpdateService: IPC Renderer connected');

      ipcRenderer.on('update-status', (event: any, { event: updateEvent, data }: any) => {
        console.log('✅ UpdateService: Received event:', updateEvent, data);

        switch (updateEvent) {
          case 'update-available':
            console.log('✅ UpdateService: Emitting update-available');
            this.updateAvailable.next(data);
            break;
          case 'download-progress':
            console.log('✅ UpdateService: Emitting download-progress');
            this.downloadProgress.next(data);
            break;
          case 'update-downloaded':
            console.log('✅ UpdateService: Emitting update-downloaded');
            this.updateDownloaded.next(true);
            break;
          case 'update-not-available':
            console.log('✅ UpdateService: No update available');
            break;
          case 'update-error':
            console.error('❌ UpdateService: Update error:', data);
            break;
        }
      });
    } catch (error) {
      console.error('❌ UpdateService: Error setting up listeners:', error);
    }
  }

  checkForUpdates() {
    if (this.isElectron()) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('check-for-updates');
    }
  }

  downloadUpdate() {
    if (this.isElectron()) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('download-update');
    }
  }

  quitAndInstall() {
    if (this.isElectron()) {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('quit-and-install');
    }
  }
}
