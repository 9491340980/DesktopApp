import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, timer } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { CommonService } from './common-service';

export interface PatchStatus {
  isPatching: boolean;
  patchMessage?: string;
  estimatedCompletionTime?: string;
  patchStartTime?: string;
  patchType?: string; // 'WINDOWS_UPDATE' | 'APPLICATION_PATCH' | 'SYSTEM_MAINTENANCE'
}

@Injectable({
  providedIn: 'root'
})
export class PatchStatusService {
  private patchStatusSubject = new BehaviorSubject<PatchStatus>({
    isPatching: false
  });

  public patchStatus$: Observable<PatchStatus> = this.patchStatusSubject.asObservable();
  private stopPolling$ = new Subject<void>();
  private pollingInterval = 30000; // 30 seconds default

  // ✅ NEW: Manual override for testing (when API is not ready)
  private useManualOverride = true; // Set to false when API is ready
  private manualPatchStatus: PatchStatus = {
    isPatching: false, // ✅ Set to true for testing patching mode
    patchMessage: 'System maintenance in progress. Please wait...',
    estimatedCompletionTime: '3:45 PM',
    patchStartTime: new Date().toISOString(),
    patchType: 'SYSTEM_MAINTENANCE'
  };

  constructor(private commonService: CommonService) {}

  /**
   * Start polling for patch status
   * @param interval Polling interval in milliseconds (default: 30000)
   */
  startMonitoring(interval: number = 30000): void {
    this.pollingInterval = interval;
    this.stopPolling$.next(); // Stop any existing polling

    // ✅ MODIFIED: Check if using manual override
    if (this.useManualOverride) {
      console.log('⚠️ PATCH STATUS: Using manual override (API not implemented yet)');
      console.log('Manual patch status:', this.manualPatchStatus);
      this.patchStatusSubject.next(this.manualPatchStatus);
      return; // Don't start polling
    }

    // Initial check
    this.checkPatchStatus();

    // Start polling
    timer(this.pollingInterval, this.pollingInterval)
      .pipe(
        takeUntil(this.stopPolling$),
        switchMap(() => this.checkPatchStatus())
      )
      .subscribe();
  }

  /**
   * Stop polling for patch status
   */
  stopMonitoring(): void {
    this.stopPolling$.next();
  }

  /**
   * Check current patch status from API
   */
  private checkPatchStatus(): Observable<any> {
    return new Observable(observer => {
      this.commonService.post<PatchStatus>(
        '/utilities/getPatchStatus',
        {},
        { showLoader: false, showError: false }
      ).subscribe({
        next: (response) => {
          if (response.Status === 'PASS' && response.Response) {
            const patchStatus: PatchStatus = {
              isPatching: response.Response.isPatching || false,
              patchMessage: response.Response.patchMessage || 'System maintenance in progress',
              estimatedCompletionTime: response.Response.estimatedCompletionTime,
              patchStartTime: response.Response.patchStartTime,
              patchType: response.Response.patchType || 'SYSTEM_MAINTENANCE'
            };

            this.patchStatusSubject.next(patchStatus);
            console.log('Patch status updated:', patchStatus);
          } else {
            // No patching in progress
            this.patchStatusSubject.next({ isPatching: false });
          }
          observer.next(response);
          observer.complete();
        },
        error: (error) => {
          console.error('Error checking patch status:', error);
          // On error, assume no patching to avoid blocking users unnecessarily
          this.patchStatusSubject.next({ isPatching: false });
          observer.error(error);
        }
      });
    });
  }

  /**
   * Get current patch status (synchronous)
   */
  getCurrentStatus(): PatchStatus {
    return this.patchStatusSubject.getValue();
  }

  /**
   * Check if system is currently patching (synchronous)
   */
  isPatching(): boolean {
    return this.patchStatusSubject.getValue().isPatching;
  }

  /**
   * Manually trigger a patch status check
   */
  refreshStatus(): void {
    this.checkPatchStatus().subscribe();
  }

  // ✅ NEW: Manual control methods for testing

  /**
   * Manually set patch status (for testing without API)
   * @param status The patch status to set
   */
  setManualPatchStatus(status: PatchStatus): void {
    console.log('Setting manual patch status:', status);
    this.manualPatchStatus = status;
    this.patchStatusSubject.next(status);
  }

  /**
   * Enable/disable manual override mode
   * @param enabled True to use manual override, false to use API
   */
  setManualOverride(enabled: boolean): void {
    this.useManualOverride = enabled;
    console.log(`Manual override ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled) {
      this.patchStatusSubject.next(this.manualPatchStatus);
    } else {
      // When disabling manual mode, do an immediate API check
      this.checkPatchStatus().subscribe();
    }
  }

  /**
   * Quick method to simulate patching start
   */
  simulatePatchingStart(): void {
    console.log('🔧 Simulating patching start...');
    this.setManualPatchStatus({
      isPatching: true,
      patchMessage: 'Windows updates are being installed. Services will be temporarily unavailable.',
      estimatedCompletionTime: new Date(Date.now() + 30 * 60000).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      }),
      patchStartTime: new Date().toISOString(),
      patchType: 'WINDOWS_UPDATE'
    });
  }

  /**
   * Quick method to simulate patching end
   */
  simulatePatchingEnd(): void {
    console.log('✅ Simulating patching end...');
    this.setManualPatchStatus({
      isPatching: false
    });
  }
}
