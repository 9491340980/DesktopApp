import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';
import { ElectronUsbService, USBDeviceDetailed } from '../services/electron-usb.service';

@Component({
  selector: 'app-ios-management',
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  templateUrl: './ios-management.html',
  styleUrl: './ios-management.scss',
})
export class IosManagement implements OnInit, OnDestroy {
  testForm: FormGroup;
  connectedDevices: USBDeviceDetailed[] = [];
  selectedDevice: USBDeviceDetailed | null = null;
  isSubmitting = false;
  isLookingUp = false;
  lookupError: string | null = null;

  private destroy$ = new Subject<void>();
  private lookupAttempts = 0;
  private maxLookupAttempts = 4;

  constructor(
    private fb: FormBuilder,
    private electronUsbService: ElectronUsbService,
    private snackBar: MatSnackBar
  ) {
    this.testForm = this.createForm();
  }

  ngOnInit(): void {
    console.log('🎯 Apple Device Receiving / Label Printing initialized');

    // Subscribe to phone devices
    this.electronUsbService.usbDevices$
      .pipe(takeUntil(this.destroy$))
      .subscribe(devices => {
        this.connectedDevices = devices.filter(d => d.isIPhone || d.isAndroid);

        console.log('📱 Devices detected:', this.connectedDevices.length);

        // Auto-select first device if none selected
        if (this.connectedDevices.length > 0 && !this.selectedDevice) {
          this.selectDevice(this.connectedDevices[0]);
        }

        // Check if selected device is still connected
        if (this.selectedDevice) {
          const stillConnected = this.connectedDevices.find(d =>
            this.isSameDevice(d, this.selectedDevice!)
          );

          if (stillConnected) {
            this.selectedDevice = stillConnected;
          } else {
            const deviceName = this.getDeviceName(this.selectedDevice);
            this.selectedDevice = null;
            this.showNotification(`Device disconnected: ${deviceName}`, 'warning');
          }
        }
      });

    // Initial device scan
    this.refreshDevices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Compare two devices by their unique identifiers
   */
  private isSameDevice(device1: USBDeviceDetailed, device2: USBDeviceDetailed): boolean {
    if (device1.vendorId !== device2.vendorId || device1.productId !== device2.productId) {
      return false;
    }

    const serial1 = device1.serialNumber || device1.androidInfo?.serialNumber;
    const serial2 = device2.serialNumber || device2.androidInfo?.serialNumber;

    if (serial1 && serial2) {
      return serial1 === serial2;
    }

    if (device1.busNumber && device2.busNumber &&
        device1.deviceAddress && device2.deviceAddress) {
      return device1.busNumber === device2.busNumber &&
             device1.deviceAddress === device2.deviceAddress;
    }

    return true;
  }

  createForm(): FormGroup {
    return this.fb.group({
      manufacturerSerial: ['', [Validators.required, Validators.minLength(6)]],
      meid: [{ value: '', disabled: true }],
      grade: ['', Validators.required],
      gsxCall: [true],
      fmiCall: [true],
      autoPrintLabel: [true]
    });
  }

  refreshDevices(): void {
    console.log('🔄 Refreshing devices...');
    this.electronUsbService.refreshUSBDevices();
    this.showNotification('Refreshing device list...', 'info');
  }

  selectDevice(device: USBDeviceDetailed): void {
    this.selectedDevice = device;
    const deviceName = this.getDeviceName(device);
    console.log('✅ Device selected:', deviceName);

    // Auto-populate serial if available
    const serial = this.getSerialNumber(device);
    if (serial !== 'Not Available') {
      this.testForm.patchValue({
        manufacturerSerial: serial
      });
      // Trigger lookup automatically
      this.onSerialEntered();
    }
  }

  /**
   * Called when serial number is entered/scanned
   * Triggers automatic lookup
   */
  async onSerialEntered(): Promise<void> {
    const serial = this.testForm.get('manufacturerSerial')?.value?.trim();

    if (!serial || serial.length < 6) {
      return;
    }

    // Reset error state
    this.lookupError = null;
    this.lookupAttempts = 0;

    // Start lookup
    await this.performLookup(serial);
  }

  /**
   * Perform API lookup for device information
   */
  private async performLookup(serial: string): Promise<void> {
    this.isLookingUp = true;
    this.lookupAttempts++;

    console.log(`🔍 Lookup attempt ${this.lookupAttempts}/${this.maxLookupAttempts} for serial: ${serial}`);

    try {
      // Simulate API call for GSX lookup
      await this.delay(1500);

      // Simulate random success/failure for demo
      const success = Math.random() > 0.3; // 70% success rate

      if (success) {
        // Success - populate MEID
        const mockMEID = this.generateMockMEID();
        this.testForm.patchValue({
          meid: mockMEID
        });

        this.showNotification('Device information retrieved successfully', 'success');
        console.log('✅ Lookup successful, MEID:', mockMEID);

      } else {
        // Failure - retry logic
        if (this.lookupAttempts < this.maxLookupAttempts) {
          console.log(`⚠️ Lookup failed, retrying...`);
          await this.delay(500);
          await this.performLookup(serial);
          return;
        } else {
          // Max attempts reached
          this.lookupError = `GSX Lookup Error: GSX lookup failed over ${this.maxLookupAttempts} times. GSX lookup aborted.`;
          this.showNotification('GSX lookup failed', 'error');
          console.error('❌ GSX lookup aborted after max attempts');
        }
      }

    } catch (error) {
      console.error('Lookup error:', error);
      this.lookupError = 'An error occurred during lookup. Please try again.';
      this.showNotification('Lookup error', 'error');
    } finally {
      this.isLookingUp = false;
    }
  }

  /**
   * Generate mock MEID for demonstration
   */
  private generateMockMEID(): string {
    const chars = '0123456789ABCDEF';
    let meid = '';
    for (let i = 0; i < 14; i++) {
      meid += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return meid;
  }

  async submitTest(): Promise<void> {
    if (!this.testForm.valid) {
      this.showNotification('Please fill in all required fields', 'error');
      return;
    }

    if (this.lookupError) {
      this.showNotification('Cannot print label. Lookup failed.', 'error');
      return;
    }

    this.isSubmitting = true;

    try {
      console.log('🖨️ Printing label...');

      // Simulate print operation
      await this.delay(2000);

      this.showNotification(
        `Label printed successfully! Grade: ${this.testForm.value.grade}`,
        'success'
      );

      console.log('✅ Print completed:', {
        serial: this.testForm.value.manufacturerSerial,
        meid: this.testForm.value.meid,
        grade: this.testForm.value.grade
      });

      // Option to print again or reset
      // For now, we'll keep the form populated for "Print Again"

    } catch (error) {
      console.error('Print error:', error);
      this.showNotification('Print failed. Please try again.', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  resetForm(): void {
    this.testForm.reset({
      gsxCall: true,
      fmiCall: true,
      autoPrintLabel: true
    });
    this.lookupError = null;
    this.lookupAttempts = 0;
    this.isLookingUp = false;

    // Clear device selection in manual mode
    if (!this.selectedDevice) {
      console.log('🔄 Form reset');
    }
  }

  getDeviceName(device: USBDeviceDetailed): string {
    return this.electronUsbService.getDeviceName(device);
  }

  getSerialNumber(device: USBDeviceDetailed): string {
    return this.electronUsbService.getSerialNumber(device);
  }

  getDeviceTypeBadge(device: USBDeviceDetailed): string {
    if (device.isIPhone) return 'iPhone';
    if (device.isAndroid) {
      const badge = this.electronUsbService.getPhoneTypeBadge(device);
      return badge || 'Android';
    }
    return 'Mobile Device';
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`]
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
