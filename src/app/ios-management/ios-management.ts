import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog';
import { Subject, takeUntil, interval } from 'rxjs';
import { ElectronUsbService, USBDeviceDetailed } from '../services/electron-usb.service';

@Component({
  selector: 'app-ios-management',
  imports: [CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCheckboxModule,
    MatSelectModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatBadgeModule,
    MatTableModule,
    MatDialogModule],
  templateUrl: './ios-management.html',
  styleUrl: './ios-management.scss',
})
export class IosManagement implements OnInit, OnDestroy {
  testForm: FormGroup;
  connectedDevices: USBDeviceDetailed[] = [];
  selectedDevice: USBDeviceDetailed | null = null;
  testHistory: TestRecord[] = [];
  isSubmitting = false;
  autoFilled = {
    deviceSerial: false,
    deviceType: false,
    deviceModel: false,
    imei: false
  };

  statistics = {
    passed: 0,
    failed: 0,
    total: 0,
    passRate: 0
  };

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private electronUsbService: ElectronUsbService,
    private snackBar: MatSnackBar
  ) {
    this.testForm = this.createForm();
  }

  ngOnInit(): void {
    console.log('🎯 Device Testing Component initialized');

    // Subscribe to phone devices (iPhone and Android)
    this.electronUsbService.usbDevices$
      .pipe(takeUntil(this.destroy$))
      .subscribe(devices => {
        this.connectedDevices = devices.filter(d => d.isIPhone || d.isAndroid);

        console.log('📱 Phones detected:', this.connectedDevices.length);

        // Auto-select first device if none selected
        if (this.connectedDevices.length > 0 && !this.selectedDevice) {
          this.selectDevice(this.connectedDevices[0]);
        }

        // FIXED: Check if selected device is still connected using unique identifiers
        // instead of object reference comparison
        if (this.selectedDevice) {
          const stillConnected = this.connectedDevices.find(d =>
            this.isSameDevice(d, this.selectedDevice!)
          );

          if (stillConnected) {
            // Update the reference to the new object with same device
            this.selectedDevice = stillConnected;
            console.log('✅ Selected device still connected:', this.getDeviceName(stillConnected));
          } else {
            // Device actually disconnected
            const deviceName = this.getDeviceName(this.selectedDevice);
            this.selectedDevice = null;
            this.showNotification(`Device disconnected: ${deviceName}`, 'warning');
            console.log('❌ Device disconnected');
          }
        }
      });

    // Initial device scan
    this.refreshDevices();

    // Load test history from localStorage
    this.loadTestHistory();
    this.updateStatistics();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Compare two devices by their unique identifiers
   * This prevents false "disconnected" notifications when device objects are recreated
   */
  private isSameDevice(device1: USBDeviceDetailed, device2: USBDeviceDetailed): boolean {
    // Compare by vendorId and productId
    if (device1.vendorId !== device2.vendorId || device1.productId !== device2.productId) {
      return false;
    }

    // Compare by serial number if available
    const serial1 = device1.serialNumber || device1.androidInfo?.serialNumber;
    const serial2 = device2.serialNumber || device2.androidInfo?.serialNumber;

    if (serial1 && serial2) {
      return serial1 === serial2;
    }

    // If no serial, compare by bus number and device address (for same USB port)
    if (device1.busNumber && device2.busNumber &&
        device1.deviceAddress && device2.deviceAddress) {
      return device1.busNumber === device2.busNumber &&
             device1.deviceAddress === device2.deviceAddress;
    }

    // Fallback: same vendor and product is probably same device
    return true;
  }

  createForm(): FormGroup {
    return this.fb.group({
      deviceSerial: ['', [Validators.required, Validators.minLength(8)]],
      deviceType: ['', Validators.required],
      meid: ['', [Validators.pattern(/^[0-9A-Fa-f]{14,18}$/)]],
      imei: ['', [Validators.pattern(/^[0-9]{15}$/)]],
      deviceModel: ['', Validators.required],
      grade: ['', Validators.required],
      gsxCall: [false],
      fmiCall: [false],
      autoPrintLabel: [true],
      operator: ['']
    });
  }

  refreshDevices(): void {
    console.log('🔄 Refreshing devices...');
    this.electronUsbService.refreshUSBDevices();
  }

  selectDevice(device: USBDeviceDetailed): void {
    this.selectedDevice = device;
    const deviceName = this.getDeviceName(device);
    console.log('✅ Device selected:', deviceName);
    this.showNotification(`Selected: ${deviceName}`, 'info');
  }

  populateFormFromDevice(device: USBDeviceDetailed): void {
    const serialNumber = this.getSerialNumber(device);

    if (serialNumber === 'Not Available') {
      this.showNotification('Cannot populate: Serial number not available', 'warning');
      return;
    }

    const deviceType = device.isIPhone ? 'iPhone' : device.isAndroid ? 'Android' : 'Other';
    const deviceModel = this.getDeviceName(device);
    const imei = device.androidInfo?.imei;

    this.testForm.patchValue({
      deviceSerial: serialNumber,
      deviceType: deviceType,
      deviceModel: deviceModel,
      imei: imei || '',
      gsxCall: device.isIPhone,
      fmiCall: device.isIPhone
    });

    this.autoFilled.deviceSerial = true;
    this.autoFilled.deviceType = true;
    this.autoFilled.deviceModel = true;
    if (imei) {
      this.autoFilled.imei = true;
    }

    this.showNotification('Form populated from device!', 'success');

    // Reset auto-fill indicators after animation
    setTimeout(() => {
      this.autoFilled.deviceSerial = false;
      this.autoFilled.deviceType = false;
      this.autoFilled.deviceModel = false;
      this.autoFilled.imei = false;
    }, 2000);
  }

  async submitTest(): Promise<void> {
    if (!this.testForm.valid) {
      this.showNotification('Please fill in all required fields', 'error');
      return;
    }

    this.isSubmitting = true;

    try {
      // Simulate API call for GSX/FMI checks
      await this.performDeviceChecks();

      const testRecord: TestRecord = {
        id: this.generateId(),
        timestamp: new Date(),
        deviceSerial: this.testForm.value.deviceSerial,
        deviceType: this.testForm.value.deviceType,
        meid: this.testForm.value.meid,
        imei: this.testForm.value.imei,
        grade: this.testForm.value.grade,
        deviceModel: this.testForm.value.deviceModel,
        gsxCall: this.testForm.value.gsxCall,
        fmiCall: this.testForm.value.fmiCall,
        autoPrintLabel: this.testForm.value.autoPrintLabel,
        testResult: 'PASS',
        operator: this.testForm.value.operator
      };

      // Add to history
      this.testHistory.unshift(testRecord);
      this.saveTestHistory();
      this.updateStatistics();

      // Handle auto-print
      if (testRecord.autoPrintLabel) {
        await this.printLabel(testRecord);
      }

      this.showNotification(`Test completed successfully! Grade: ${testRecord.grade}`, 'success');
      this.resetForm();

    } catch (error) {
      console.error('Test submission error:', error);
      this.showNotification('Test failed. Please try again.', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  private async performDeviceChecks(): Promise<void> {
    if (this.testForm.value.gsxCall) {
      await this.delay(1000);
      console.log('✅ GSX check completed');
    }

    if (this.testForm.value.fmiCall) {
      await this.delay(800);
      console.log('✅ FMI check completed');
    }
  }

  private async printLabel(testRecord: TestRecord): Promise<void> {
    await this.delay(500);
    console.log('🖨️ Label printed for:', testRecord.deviceSerial);
    this.showNotification('Label printed successfully', 'info');
  }

  resetForm(): void {
    this.testForm.reset({
      gsxCall: false,
      fmiCall: false,
      autoPrintLabel: true
    });
    this.autoFilled.deviceSerial = false;
    this.autoFilled.deviceType = false;
    this.autoFilled.deviceModel = false;
    this.autoFilled.imei = false;
  }

  clearHistory(): void {
    if (confirm('Are you sure you want to clear all test history?')) {
      this.testHistory = [];
      localStorage.removeItem('device_test_history');
      this.updateStatistics();
      this.showNotification('Test history cleared', 'info');
    }
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.showNotification('Copied to clipboard!', 'success');
    });
  }

  getDeviceName(device: USBDeviceDetailed): string {
    return this.electronUsbService.getDeviceName(device);
  }

  getSerialNumber(device: USBDeviceDetailed): string {
    return this.electronUsbService.getSerialNumber(device);
  }

  getDeviceIcon(device: USBDeviceDetailed): string {
    if (device.isIPhone) return 'phone_iphone';
    if (device.isAndroid) return 'smartphone';
    return 'phone_android';
  }

  getDeviceTypeBadge(device: USBDeviceDetailed): string {
    if (device.isIPhone) return 'iPhone';
    if (device.isAndroid) {
      const badge = this.electronUsbService.getPhoneTypeBadge(device);
      return badge || 'Android';
    }
    return 'Mobile Device';
  }

  hasValidSerial(device: USBDeviceDetailed): boolean {
    const serial = this.getSerialNumber(device);
    return serial !== 'Not Available' && serial.length >= 8;
  }

  getDeviceWarning(device: USBDeviceDetailed): string {
    if (device.isIPhone) {
      return 'Serial not available - Device needs to be trusted on iPhone';
    }
    if (device.isAndroid) {
      return 'Serial not available - Enable USB debugging on Android device';
    }
    return 'Serial number not available for this device';
  }

  formatVendorId(vendorId: number): string {
    return '0x' + vendorId.toString(16).toUpperCase().padStart(4, '0');
  }

  formatProductId(productId: number): string {
    return '0x' + productId.toString(16).toUpperCase().padStart(4, '0');
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return new Date(date).toLocaleDateString();
  }

  private loadTestHistory(): void {
    const stored = localStorage.getItem('device_test_history');
    if (stored) {
      try {
        this.testHistory = JSON.parse(stored);
      } catch (e) {
        console.error('Error loading test history:', e);
        this.testHistory = [];
      }
    }
  }

  private saveTestHistory(): void {
    try {
      const historyToSave = this.testHistory.slice(0, 50);
      localStorage.setItem('device_test_history', JSON.stringify(historyToSave));
    } catch (e) {
      console.error('Error saving test history:', e);
    }
  }

  private updateStatistics(): void {
    this.statistics.total = this.testHistory.length;
    this.statistics.passed = this.testHistory.filter(t => t.testResult === 'PASS').length;
    this.statistics.failed = this.testHistory.filter(t => t.testResult === 'FAIL').length;
    this.statistics.passRate = this.statistics.total > 0
      ? Math.round((this.statistics.passed / this.statistics.total) * 100)
      : 0;
  }

  private showNotification(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`]
    });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface TestRecord {
  id: string;
  timestamp: Date;
  deviceSerial: string;
  meid?: string;
  imei?: string;
  grade: string;
  deviceModel: string;
  deviceType: 'iPhone' | 'Android' | 'Other';
  gsxCall: boolean;
  fmiCall: boolean;
  autoPrintLabel: boolean;
  testResult: 'PASS' | 'FAIL' | 'PENDING';
  operator?: string;
}
