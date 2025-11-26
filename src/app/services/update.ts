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
    if (this.isElectron()) {
      this.setupUpdateListeners();
    }
  }

  private isElectron(): boolean {
    return !!(window && window.require);
  }

  private setupUpdateListeners() {
    try {
      const { ipcRenderer } = window.require('electron');

      ipcRenderer.on('update-status', (event: any, { event: updateEvent, data }: any) => {
        console.log('Update event received:', updateEvent, data);

        switch (updateEvent) {
          case 'update-available':
            this.updateAvailable.next(data);
            break;
          case 'download-progress':
            this.downloadProgress.next(data);
            break;
          case 'update-downloaded':
            this.updateDownloaded.next(true);
            break;
          case 'update-not-available':
            console.log('App is up to date');
            break;
          case 'update-error':
            console.error('Update error:', data);
            break;
        }
      });
    } catch (error) {
      console.error('Error setting up update listeners:', error);
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
