// electron-configs/main.dev.js - FOR LOCAL DEVELOPMENT (localhost)
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ============================================
// DEV ENVIRONMENT CONFIGURATION
// ============================================
const ENV = 'DEV';
const isDevelopment = true;

// ============================================
// VENDOR DATABASE
// ============================================
const VENDOR_DATABASE = {
  0x04E8: 'Samsung Electronics',
  0x18D1: 'Google Inc.',
  0x05AC: 'Apple Inc.',
  0x045E: 'Microsoft Corporation',
  0x046D: 'Logitech',
  0x413C: 'Dell Computer Corp.',
  0x0424: 'Microchip Technology',
  0x8087: 'Intel Corp.',
  0x8086: 'Intel Corp.',
  0x1532: 'Razer USA',
  0x046A: 'Cherry GmbH',
  0x0951: 'Kingston Technology',
  0x0781: 'SanDisk Corp.',
  0x058F: 'Alcor Micro Corp.',
  0x1D6B: 'Linux Foundation',
  0x0BDA: 'Realtek Semiconductor'
};

// ============================================
// USB DEVICE DETECTION VARIABLES
// ============================================
let usbDevices = [];
let adbAvailable = false;

// ============================================
// LOGGING SYSTEM
// ============================================
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `dev-${Date.now()}.log`);

function log(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [${ENV}] [${level}] ${args.join(' ')}`;
  console.log(message);
  try {
    fs.appendFileSync(logFile, message + '\n');
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

function logInfo(...args) { log('INFO', ...args); }
function logError(...args) { log('ERROR', ...args); }

// ============================================
// IPHONE SERIAL NUMBER DETECTION
// ============================================

async function getIPhoneInfoFromRegistry(vendorId, productId) {
  if (process.platform !== 'win32') return null;

  try {
    const vid = vendorId.toString(16).toUpperCase().padStart(4, '0');
    const pid = productId.toString(16).toUpperCase().padStart(4, '0');

    logInfo(`🔍 Searching for iPhone serial (VID: ${vid}, PID: ${pid})`);

    const psCommand = `
      $devices = Get-ChildItem -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\USB\\VID_${vid}&PID_${pid}" -ErrorAction SilentlyContinue
      foreach ($device in $devices) {
        $props = Get-ItemProperty -Path $device.PSPath -ErrorAction SilentlyContinue
        [PSCustomObject]@{
          SerialNumber = $device.PSChildName
          FriendlyName = $props.FriendlyName
          Mfg = $props.Mfg
        }
      } | ConvertTo-Json
    `;

    const { stdout } = await execPromise(
      `powershell -Command "${psCommand.replace(/\n/g, ' ')}"`,
      { timeout: 5000 }
    );

    if (stdout && stdout.trim() && stdout.trim() !== 'null') {
      let deviceData = JSON.parse(stdout);
      if (!Array.isArray(deviceData)) deviceData = [deviceData];

      for (const device of deviceData) {
        if (device.SerialNumber && device.SerialNumber.length >= 10) {
          logInfo('✅ iPhone serial found:', device.SerialNumber);
          return {
            serialNumber: device.SerialNumber,
            friendlyName: device.FriendlyName || 'Apple iPhone',
            manufacturer: device.Mfg || 'Apple Inc.'
          };
        }
      }
    }

    return null;
  } catch (error) {
    logError('Error getting iPhone info:', error.message);
    return null;
  }
}

async function getAllConnectedIPhones() {
  if (process.platform !== 'win32') return [];

  try {
    const psCommand = `
      Get-PnpDevice |
      Where-Object {
        ($_.FriendlyName -like "*iPhone*" -or $_.FriendlyName -like "*Apple Mobile*") -and
        $_.Status -eq 'OK'
      } |
      Select-Object FriendlyName, InstanceId, Manufacturer |
      ConvertTo-Json
    `;

    const { stdout } = await execPromise(
      `powershell -Command "${psCommand.replace(/\n/g, ' ')}"`,
      { timeout: 5000 }
    );

    if (!stdout || stdout.trim() === '' || stdout.trim() === 'null') return [];

    let devices = JSON.parse(stdout);
    if (!Array.isArray(devices)) devices = [devices];

    const iphones = [];
    for (const device of devices) {
      if (device.InstanceId) {
        const match = device.InstanceId.match(/USB\\VID_([0-9A-F]{4})&PID_([0-9A-F]{4})\\([A-Z0-9]+)/i);
        if (match && match[3] && match[3].length >= 10) {
          iphones.push({
            vendorId: parseInt(match[1], 16),
            productId: parseInt(match[2], 16),
            serialNumber: match[3],
            friendlyName: device.FriendlyName,
            manufacturer: device.Manufacturer || 'Apple Inc.',
            isIPhone: true
          });
        }
      }
    }

    return iphones;
  } catch (error) {
    return [];
  }
}

// ============================================
// ADB HELPER FUNCTIONS
// ============================================

async function isADBAvailable() {
  try {
    await execPromise('adb version', { timeout: 3000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function getADBDevices() {
  try {
    const { stdout } = await execPromise('adb devices', { timeout: 5000 });
    const lines = stdout.split('\n').slice(1);

    return lines
      .filter(line => line.trim() && line.includes('\t'))
      .map(line => {
        const [serial, status] = line.trim().split('\t');
        return { serial, status };
      })
      .filter(device => device.status === 'device');
  } catch (error) {
    return [];
  }
}

async function getAndroidDeviceInfo(deviceSerial) {
  try {
    const info = {
      serialNumber: deviceSerial,
      imei: null,
      model: null,
      manufacturer: null
    };

    try {
      const { stdout: model } = await execPromise(
        `adb -s ${deviceSerial} shell getprop ro.product.model`,
        { timeout: 3000 }
      );
      info.model = model.trim();
    } catch (e) {}

    try {
      const { stdout: manufacturer } = await execPromise(
        `adb -s ${deviceSerial} shell getprop ro.product.manufacturer`,
        { timeout: 3000 }
      );
      info.manufacturer = manufacturer.trim();
    } catch (e) {}

    try {
      const { stdout: imei } = await execPromise(
        `adb -s ${deviceSerial} shell "service call iphonesubinfo 1 | cut -c 52-66 | tr -d '.[:space:]'"`,
        { timeout: 3000 }
      );
      const imeiClean = imei.trim().replace(/[^0-9]/g, '');
      if (imeiClean && imeiClean.length >= 15) {
        info.imei = imeiClean.substring(0, 15);
      }
    } catch (e) {}

    return info;
  } catch (error) {
    return null;
  }
}

// ============================================
// USB DEVICE DETECTION
// ============================================

async function getDeviceStrings(device) {
  return new Promise((resolve) => {
    try {
      device.open();
      const descriptor = device.deviceDescriptor;
      const strings = { manufacturer: null, product: null, serialNumber: null };

      let completed = 0;
      const total = 3;

      const checkComplete = () => {
        completed++;
        if (completed === total) {
          try { device.close(); } catch (e) {}
          resolve(strings);
        }
      };

      if (descriptor.iManufacturer > 0) {
        device.getStringDescriptor(descriptor.iManufacturer, (error, data) => {
          if (!error && data) strings.manufacturer = data.toString('utf-8').trim();
          checkComplete();
        });
      } else {
        checkComplete();
      }

      if (descriptor.iProduct > 0) {
        device.getStringDescriptor(descriptor.iProduct, (error, data) => {
          if (!error && data) strings.product = data.toString('utf-8').trim();
          checkComplete();
        });
      } else {
        checkComplete();
      }

      if (descriptor.iSerialNumber > 0) {
        device.getStringDescriptor(descriptor.iSerialNumber, (error, data) => {
          if (!error && data) strings.serialNumber = data.toString('utf-8').trim();
          checkComplete();
        });
      } else {
        checkComplete();
      }
    } catch (error) {
      resolve({ manufacturer: null, product: null, serialNumber: null });
    }
  });
}

async function getUSBDevicesDetailed() {
  try {
    const { usb } = require('usb');
    const devices = usb.getDeviceList();

    const devicePromises = devices.map(async (device) => {
      const descriptor = device.deviceDescriptor;
      const strings = await getDeviceStrings(device);
      const vendorName = VENDOR_DATABASE[descriptor.idVendor] || null;

      const deviceInfo = {
        vendorId: descriptor.idVendor,
        productId: descriptor.idProduct,
        deviceClass: descriptor.bDeviceClass,
        busNumber: device.busNumber,
        deviceAddress: device.deviceAddress,
        manufacturer: strings.manufacturer || vendorName,
        product: strings.product,
        serialNumber: strings.serialNumber,
        source: 'native-usb',
        isAndroid: false,
        isIPhone: false,
        androidInfo: null
      };

      // iPhone detection
      if (descriptor.idVendor === 0x05AC) {
        const iphoneInfo = await getIPhoneInfoFromRegistry(descriptor.idVendor, descriptor.idProduct);
        if (iphoneInfo && iphoneInfo.serialNumber) {
          deviceInfo.isIPhone = true;
          deviceInfo.serialNumber = iphoneInfo.serialNumber;
          deviceInfo.product = iphoneInfo.friendlyName || 'Apple iPhone';
          deviceInfo.manufacturer = 'Apple Inc.';
        } else {
          deviceInfo.isIPhone = true;
          deviceInfo.product = 'Apple iPhone';
        }
      }

      // Android detection
      const androidVendors = [0x04E8, 0x18D1];
      if (androidVendors.includes(descriptor.idVendor) && adbAvailable) {
        deviceInfo.isAndroid = true;
      }

      return deviceInfo;
    });

    let deviceInfo = await Promise.all(devicePromises);

    // Enhance with ADB
    if (adbAvailable) {
      const adbDevices = await getADBDevices();
      for (const adbDevice of adbDevices) {
        const androidInfo = await getAndroidDeviceInfo(adbDevice.serial);
        if (androidInfo) {
          const match = deviceInfo.find(d => d.isAndroid && (!d.serialNumber || d.serialNumber === androidInfo.serialNumber));
          if (match) {
            match.androidInfo = androidInfo;
            match.serialNumber = androidInfo.serialNumber;
            match.product = androidInfo.model || match.product;
          }
        }
      }
    }

    // Add registry iPhones
    const registryIPhones = await getAllConnectedIPhones();
    for (const regIPhone of registryIPhones) {
      if (!deviceInfo.find(d => d.vendorId === regIPhone.vendorId && d.productId === regIPhone.productId)) {
        deviceInfo.push({ ...regIPhone, deviceClass: 'iPhone', source: 'windows-registry' });
      }
    }

    return deviceInfo;
  } catch (error) {
    logError('Error getting USB devices:', error.message);
    return [];
  }
}

async function getAllUSBDevices() {
  try {
    adbAvailable = await isADBAvailable();
    const devices = await getUSBDevicesDetailed();
    logInfo('📊 USB devices detected:', devices.length);
    return devices;
  } catch (error) {
    logError('Error in getAllUSBDevices:', error.message);
    return [];
  }
}

function setupUSBListeners() {
  try {
    const { usb } = require('usb');

    usb.on('attach', async () => {
      logInfo('🔌 USB device attached');
      usbDevices = await getAllUSBDevices();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usb-devices-updated', usbDevices);
      }
    });

    usb.on('detach', async () => {
      logInfo('🔌 USB device detached');
      usbDevices = await getAllUSBDevices();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usb-devices-updated', usbDevices);
      }
    });

    logInfo('✅ USB listeners activated');
  } catch (error) {
    logError('Error setting up USB listeners:', error.message);
  }
}

// ============================================
// IPC HANDLERS FOR USB
// ============================================
function setupIPCHandlers() {
  logInfo('🔧 Setting up IPC handlers...');

  ipcMain.handle('get-usb-devices', async (event) => {
    logInfo('📡 IPC: get-usb-devices called');
    try {
      const devices = await getAllUSBDevices();
      logInfo(`📡 IPC: Returning ${devices.length} devices`);
      return devices;
    } catch (error) {
      logError('Error in get-usb-devices handler:', error.message);
      return [];
    }
  });

  ipcMain.handle('refresh-usb-devices', async (event) => {
    logInfo('📡 IPC: refresh-usb-devices called');
    try {
      const devices = await getAllUSBDevices();
      usbDevices = devices;
      logInfo(`📡 IPC: Refreshed ${devices.length} devices`);
      return devices;
    } catch (error) {
      logError('Error in refresh-usb-devices handler:', error.message);
      return [];
    }
  });

  ipcMain.handle('check-adb-status', async (event) => {
    logInfo('📡 IPC: check-adb-status called');
    try {
      const available = await isADBAvailable();
      return { available, message: available ? 'ADB available' : 'ADB not found' };
    } catch (error) {
      logError('Error in check-adb-status handler:', error.message);
      return { available: false, message: 'Error checking ADB' };
    }
  });

  ipcMain.handle('get-iphone-serial', async (event, vendorId, productId) => {
    logInfo('📡 IPC: get-iphone-serial called');
    try {
      return await getIPhoneInfoFromRegistry(vendorId, productId);
    } catch (error) {
      logError('Error in get-iphone-serial handler:', error.message);
      return null;
    }
  });

  logInfo('✅ IPC handlers registered successfully');
}

// ============================================
// APPLICATION MENU
// ============================================
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.reload();
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3.0));
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomFactor();
              mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
            }
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) mainWindow.webContents.setZoomFactor(1.0);
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          }
        }
      ]
    },
    {
      label: 'Environment',
      submenu: [
        {
          label: 'DEV Environment (localhost)',
          enabled: false
        },
        {
          label: 'Loading from: http://localhost:4200',
          enabled: false
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'View Logs',
          click: () => {
            require('electron').shell.openPath(logsDir);
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ============================================
// WINDOW CREATION
// ============================================
let mainWindow = null;

function createWindow() {
  logInfo('Creating DEV window...');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    title: 'RMX Desktop (DEV)',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: true,
      zoomFactor: 1.0
    },
    show: false,
    backgroundColor: '#ff9800'
  });

  mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    mainWindow.webContents.openDevTools();
    logInfo('DEV window shown');

    // Initial USB scan
    logInfo('🔍 Performing initial USB device scan...');
    try {
      usbDevices = await getAllUSBDevices();
      logInfo(`✅ Initial scan complete: ${usbDevices.length} devices found`);
    } catch (error) {
      logError('❌ Initial USB scan failed:', error.message);
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    logInfo(`[RENDERER] ${message}`);
  });

  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:4200';
  logInfo('========================================');
  logInfo('Loading from:', startUrl);
  logInfo('Make sure Angular dev server is running!');
  logInfo('========================================');

  mainWindow.loadURL(startUrl)
    .then(() => {
      logInfo('✅ App loaded from:', startUrl);
    })
    .catch(err => {
      logError('❌ Failed to load:', startUrl);
      logError('Error:', err.message);
    });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logError('Failed to load:', validatedURL);
    logError('Error:', errorCode, errorDescription);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================
// APP LIFECYCLE
// ============================================
app.whenReady().then(() => {
  logInfo('========================================');
  logInfo('RMX Desktop DEV with USB Detection');
  logInfo('Environment: DEV (localhost)');
  logInfo('Version:', app.getVersion());
  logInfo('Electron:', process.versions.electron);
  logInfo('Platform:', process.platform);
  logInfo('Log file:', logFile);
  logInfo('========================================');

  // CRITICAL: Setup IPC handlers BEFORE creating window
  setupIPCHandlers();

  // Setup USB listeners
  setupUSBListeners();

  // Create menu and window
  createAppMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', (error) => {
  logError('Uncaught Exception:', error.message);
  console.error(error);
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled Rejection:', reason);
  console.error(reason);
});

logInfo('✅ main.dev.js loaded with USB detection');
