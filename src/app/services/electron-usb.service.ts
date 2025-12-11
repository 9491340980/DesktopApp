import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, interval } from 'rxjs';

export interface USBDeviceDetailed {
  vendorId: number;
  productId: number;
  manufacturer?: string | null;
  product?: string | null;
  serialNumber?: string | null;
  friendlyName?: string | null;
  vendorName?: string | null;
  deviceClass?: number | string;
  deviceSubClass?: number;
  busNumber?: number;
  deviceAddress?: number;
  instanceId?: string;
  source: 'native-usb' | 'windows-pnp' | 'adb';
  isAndroid?: boolean;
  isIPhone?: boolean;
  isSystemDevice?: boolean;
  deviceType?: 'phone' | 'storage' | 'input' | 'hub' | 'bluetooth' | 'camera' | 'printer' | 'audio' | 'other';
  androidInfo?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ElectronUsbService {
  private usbDevicesSubject = new BehaviorSubject<USBDeviceDetailed[]>([]);
  public usbDevices$: Observable<USBDeviceDetailed[]> = this.usbDevicesSubject.asObservable();

  private allDevicesSubject = new BehaviorSubject<USBDeviceDetailed[]>([]);
  public allDevices$: Observable<USBDeviceDetailed[]> = this.allDevicesSubject.asObservable();

  private filterSystemDevices = true;
  private autoRefreshEnabled = true;
  private autoRefreshInterval = 5000;

  // System/Built-in vendor IDs (devices to filter out)
  private readonly SYSTEM_VENDORS = [
    0x8086, // Intel (USB controllers, hubs)
    0x8087, // Intel (Bluetooth, wireless)
    0x1D6B, // Linux Foundation (USB hubs)
    0x0BDA, // Realtek (built-in card readers)
    0x0424, // Microchip (built-in USB hubs)
  ];

  // Phone vendor IDs
  private readonly PHONE_VENDORS = {
    SAMSUNG: [0x04E8],
    APPLE: [0x05AC],
    GOOGLE: [0x18D1],
    HUAWEI: [0x12D1],
    XIAOMI: [0x2717],
    OPPO: [0x22D9],
    VIVO: [0x2D95],
    ONEPLUS: [0x2A70],
    LG: [0x1004],
    MOTOROLA: [0x22B8],
    HTC: [0x0BB4],
    SONY: [0x0FCE]
  };

  // System device class codes
  private readonly SYSTEM_DEVICE_CLASSES = [
    9,   // Hub
    224, // Diagnostic Device
    239, // Miscellaneous
  ];

  constructor(private ngZone: NgZone) {
    if (this.isElectron()) {
      console.log('✅ Electron environment detected');
      console.log('🔄 Setting up automatic USB detection...');

      this.setupUSBListener();
      this.refreshUSBDevices();
      this.setupAutoRefresh();
    } else {
      console.warn('❌ Not running in Electron environment. USB features disabled.');
    }
  }

  private isElectron(): boolean {
    return !!(window && (window as any).require);
  }

  private setupUSBListener(): void {
    if (!this.isElectron()) return;

    const ipcRenderer = (window as any).require('electron').ipcRenderer;

    ipcRenderer.on('usb-devices-updated', (event: any, devices: USBDeviceDetailed[]) => {
      this.ngZone.run(() => {
        console.log('🔔 USB devices updated automatically:', devices.length, 'devices');
        this.processDevices(devices);
      });
    });

    console.log('✅ Real-time USB event listeners activated');
  }

  private setupAutoRefresh(): void {
    if (!this.autoRefreshEnabled) return;

    interval(this.autoRefreshInterval).subscribe(() => {
      this.silentRefresh();
    });

    console.log(`✅ Automatic polling enabled (every ${this.autoRefreshInterval / 1000}s)`);
  }

  private async silentRefresh(): Promise<void> {
    if (!this.isElectron()) return;

    try {
      const ipcRenderer = (window as any).require('electron').ipcRenderer;
      const devices = await ipcRenderer.invoke('refresh-usb-devices');

      const currentCount = this.usbDevicesSubject.value.length;
      const filteredDevices = this.applyFilters(devices);

      if (filteredDevices.length !== currentCount) {
        console.log('🔄 Device count changed:', currentCount, '→', filteredDevices.length);
        this.ngZone.run(() => {
          this.processDevices(devices);
        });
      }
    } catch (error) {
      // Silent failure
    }
  }

  /**
   * Process and classify all devices
   */
  private processDevices(devices: USBDeviceDetailed[]): void {
    // Classify each device
    const classifiedDevices = devices.map(device => this.classifyDevice(device));

    // Store all devices (unfiltered)
    this.allDevicesSubject.next(classifiedDevices);

    // Store filtered devices
    const filtered = this.applyFilters(classifiedDevices);
    this.usbDevicesSubject.next(filtered);

    console.log('📊 Total devices:', classifiedDevices.length);
    console.log('📊 External devices:', filtered.length);
    console.log('📊 System devices filtered:', classifiedDevices.length - filtered.length);
  }

  /**
   * Classify device type and identify phones
   */
  private classifyDevice(device: USBDeviceDetailed): USBDeviceDetailed {
    const classified:any = { ...device };

    // Check if it's a phone
    const phoneType = this.identifyPhoneType(device);
    if (phoneType) {
      classified.isAndroid = phoneType === 'Android';
      classified.isIPhone = phoneType === 'iPhone';
      classified.deviceType = 'phone';
    }

    // Check if it's a system device
    classified.isSystemDevice = this.isSystemDevice(device);

    // Determine device type if not already set
    if (!classified.deviceType) {
      classified.deviceType = this.determineDeviceType(device);
    }

    return classified;
  }

  /**
   * Identify if device is Samsung or iPhone
   */
  private identifyPhoneType(device: USBDeviceDetailed): 'Android' | 'iPhone' | null {
    const vendorId = device.vendorId;
    const name = (device.friendlyName || device.product || '').toLowerCase();

    // Check vendor IDs
    if (this.PHONE_VENDORS.SAMSUNG.includes(vendorId)) {
      return 'Android'; // Samsung
    }

    if (this.PHONE_VENDORS.APPLE.includes(vendorId)) {
      return 'iPhone';
    }

    if (this.PHONE_VENDORS.GOOGLE.includes(vendorId) ||
        this.PHONE_VENDORS.HUAWEI.includes(vendorId) ||
        this.PHONE_VENDORS.XIAOMI.includes(vendorId) ||
        this.PHONE_VENDORS.OPPO.includes(vendorId) ||
        this.PHONE_VENDORS.VIVO.includes(vendorId) ||
        this.PHONE_VENDORS.ONEPLUS.includes(vendorId) ||
        this.PHONE_VENDORS.LG.includes(vendorId) ||
        this.PHONE_VENDORS.MOTOROLA.includes(vendorId) ||
        this.PHONE_VENDORS.HTC.includes(vendorId) ||
        this.PHONE_VENDORS.SONY.includes(vendorId)) {
      return 'Android';
    }

    // Check by name
    if (name.includes('iphone') || name.includes('ipad')) {
      return 'iPhone';
    }

    if (name.includes('android') ||
        name.includes('galaxy') ||
        name.includes('pixel') ||
        name.includes('oneplus') ||
        name.includes('xiaomi')) {
      return 'Android';
    }

    return null;
  }

  /**
   * Check if device is a system/built-in device
   */
  private isSystemDevice(device: USBDeviceDetailed): boolean {
    const vendorId = device.vendorId;
    const deviceClass = device.deviceClass;
    const name = (device.friendlyName || device.product || '').toLowerCase();

    // Check vendor ID
    if (this.SYSTEM_VENDORS.includes(vendorId)) {
      return true;
    }

    // Check device class
    if (typeof deviceClass === 'number' && this.SYSTEM_DEVICE_CLASSES.includes(deviceClass)) {
      return true;
    }

    // Check by name patterns
    const systemPatterns = [
      'hub',
      'root hub',
      'usb hub',
      'bluetooth',
      'wireless',
      'controller',
      'host controller',
      'composite device',
      'generic usb',
      'standard usb'
    ];

    for (const pattern of systemPatterns) {
      if (name.includes(pattern)) {
        return true;
      }
    }

    // Check device class strings
    if (typeof deviceClass === 'string') {
      const classLower = deviceClass.toLowerCase();
      if (classLower.includes('hub') ||
          classLower.includes('bluetooth') ||
          classLower.includes('diagnostic')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determine device type
   */
  private determineDeviceType(device: USBDeviceDetailed): string {
    const name = (device.friendlyName || device.product || '').toLowerCase();
    const deviceClass = device.deviceClass;

    // By name
    if (name.includes('mouse')) return 'input';
    if (name.includes('keyboard')) return 'input';
    if (name.includes('storage') || name.includes('drive') || name.includes('disk')) return 'storage';
    if (name.includes('camera') || name.includes('webcam')) return 'camera';
    if (name.includes('printer')) return 'printer';
    if (name.includes('audio') || name.includes('speaker') || name.includes('headset')) return 'audio';
    if (name.includes('hub')) return 'hub';
    if (name.includes('bluetooth')) return 'bluetooth';

    // By device class
    if (typeof deviceClass === 'number') {
      switch (deviceClass) {
        case 1: return 'audio';
        case 3: return 'input';
        case 6: return 'camera';
        case 7: return 'printer';
        case 8: return 'storage';
        case 9: return 'hub';
        case 14: return 'camera';
        default: return 'other';
      }
    }

    return 'other';
  }

  /**
   * Apply filtering
   */
  private applyFilters(devices: USBDeviceDetailed[]): USBDeviceDetailed[] {
    if (!this.filterSystemDevices) {
      return devices;
    }

    return devices.filter(device => !device.isSystemDevice);
  }

  /**
   * Toggle system device filtering
   */
  setFilterSystemDevices(enabled: boolean): void {
    this.filterSystemDevices = enabled;
    console.log(this.filterSystemDevices ? '✅ Filtering system devices' : '⚠️ Showing all devices');

    // Reprocess current devices
    const allDevices = this.allDevicesSubject.value;
    const filtered = this.applyFilters(allDevices);
    this.usbDevicesSubject.next(filtered);
  }

  /**
   * Get only phones
   */
  getPhones(): USBDeviceDetailed[] {
    return this.usbDevicesSubject.value.filter(d => d.isAndroid || d.isIPhone);
  }

  /**
   * Get Samsung devices
   */
  getSamsungDevices(): USBDeviceDetailed[] {
    return this.usbDevicesSubject.value.filter(d =>
      d.isAndroid && this.PHONE_VENDORS.SAMSUNG.includes(d.vendorId)
    );
  }

  /**
   * Get iPhones
   */
  getIPhones(): USBDeviceDetailed[] {
    return this.usbDevicesSubject.value.filter(d => d.isIPhone);
  }

  /**
   * Manual refresh
   */
  async refreshUSBDevices(): Promise<USBDeviceDetailed[]> {
    if (!this.isElectron()) {
      console.warn('IPC Renderer not available');
      return [];
    }

    try {
      const ipcRenderer = (window as any).require('electron').ipcRenderer;
      console.log('🔄 Manually refreshing USB devices...');
      const devices = await ipcRenderer.invoke('refresh-usb-devices');
      console.log('✅ USB devices fetched:', devices.length);
      this.processDevices(devices);
      return this.usbDevicesSubject.value;
    } catch (error) {
      console.error('❌ Error fetching USB devices:', error);
      return [];
    }
  }

  getCurrentDevices(): USBDeviceDetailed[] {
    return this.usbDevicesSubject.value;
  }

  getAllDevices(): USBDeviceDetailed[] {
    return this.allDevicesSubject.value;
  }

  getDeviceCount(): number {
    return this.usbDevicesSubject.value.length;
  }

  getAllDeviceCount(): number {
    return this.allDevicesSubject.value.length;
  }

  getDeviceName(device: USBDeviceDetailed): string {
    if (device.friendlyName) return device.friendlyName;
    if (device.product) return device.product;
    if (device.manufacturer) return device.manufacturer;
    if (device.vendorName) return `${device.vendorName} Device`;
    return `USB Device (${this.formatVendorId(device.vendorId)}:${this.formatProductId(device.productId)})`;
  }

  getManufacturerName(device: USBDeviceDetailed): string {
    return device.manufacturer || device.vendorName || 'Unknown Manufacturer';
  }

  getProductName(device: USBDeviceDetailed): string {
    return device.product || device.friendlyName || 'Unknown Product';
  }

  getSerialNumber(device: USBDeviceDetailed): string {
    if (device.androidInfo?.serialNumber) {
      return device.androidInfo.serialNumber;
    }
    return device.serialNumber || 'Not Available';
  }

  getIMEI(device: USBDeviceDetailed): string {
    if (device.androidInfo?.imei) {
      return device.androidInfo.imei;
    }
    return 'Not Available';
  }

  formatVendorId(vendorId: number): string {
    if (!vendorId || vendorId === 0) return 'N/A';
    return '0x' + vendorId.toString(16).toUpperCase().padStart(4, '0');
  }

  formatProductId(productId: number): string {
    if (!productId || productId === 0) return 'N/A';
    return '0x' + productId.toString(16).toUpperCase().padStart(4, '0');
  }

  getDeviceClassName(deviceClass: number | string | undefined): string {
    if (typeof deviceClass === 'string') {
      return deviceClass;
    }

    if (typeof deviceClass !== 'number') {
      return 'Unknown';
    }

    const classNames: { [key: number]: string } = {
      0: 'Defined at Interface',
      1: 'Audio',
      2: 'Communications',
      3: 'HID (Human Interface Device)',
      5: 'Physical',
      6: 'Image',
      7: 'Printer',
      8: 'Mass Storage',
      9: 'Hub',
      10: 'CDC-Data',
      11: 'Smart Card',
      13: 'Content Security',
      14: 'Video',
      15: 'Personal Healthcare',
      16: 'Audio/Video',
      224: 'Diagnostic Device',
      239: 'Miscellaneous',
      240: 'Wireless Controller',
      254: 'Application Specific',
      255: 'Vendor Specific'
    };

    return classNames[deviceClass] || `Unknown (${deviceClass})`;
  }

  getDeviceIcon(device: USBDeviceDetailed): string {
    if (device.isIPhone) return 'phone_iphone';
    if (device.isAndroid) return 'smartphone';

    const name = (device.friendlyName || device.product || '').toLowerCase();

    if (name.includes('mouse')) return 'mouse';
    if (name.includes('keyboard')) return 'keyboard';
    if (name.includes('camera') || name.includes('webcam')) return 'videocam';
    if (name.includes('printer')) return 'print';
    if (name.includes('storage') || name.includes('drive') || name.includes('disk')) return 'storage';
    if (name.includes('audio') || name.includes('speaker') || name.includes('headset')) return 'headset';
    if (name.includes('hub')) return 'hub';
    if (name.includes('card')) return 'credit_card';

    if (typeof device.deviceClass === 'number') {
      const iconMap: { [key: number]: string } = {
        1: 'headset',
        2: 'wifi',
        3: 'mouse',
        6: 'camera',
        7: 'print',
        8: 'storage',
        9: 'hub',
        11: 'credit_card',
        14: 'videocam'
      };
      return iconMap[device.deviceClass] || 'usb';
    }

    return 'usb';
  }

  hasDetailedInfo(device: USBDeviceDetailed): boolean {
    return !!(device.manufacturer || device.product || device.friendlyName);
  }

  getInfoCompleteness(device: USBDeviceDetailed): number {
    let score = 0;
    let total = 5;

    if (device.manufacturer || device.vendorName) score++;
    if (device.product || device.friendlyName) score++;
    if (device.serialNumber) score++;
    if (device.deviceClass) score++;
    if (device.busNumber !== undefined) score++;

    return Math.round((score / total) * 100);
  }

  getPhoneTypeBadge(device: USBDeviceDetailed): string {
    if (device.isIPhone) return 'iPhone';
    if (device.isAndroid) {
      // Check specific Android brands
      if (this.PHONE_VENDORS.SAMSUNG.includes(device.vendorId)) return 'Samsung';
      if (this.PHONE_VENDORS.GOOGLE.includes(device.vendorId)) return 'Google Pixel';
      if (this.PHONE_VENDORS.XIAOMI.includes(device.vendorId)) return 'Xiaomi';
      if (this.PHONE_VENDORS.ONEPLUS.includes(device.vendorId)) return 'OnePlus';
      return 'Android';
    }
    return '';
  }
}
