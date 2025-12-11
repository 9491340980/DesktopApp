// electron-configs/main.qa.js
const { app, BrowserWindow, dialog, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { autoUpdater } = require('electron-updater');

// ============================================
// QA ENVIRONMENT CONFIGURATION
// ============================================
const ENV = 'QA';
const isDevelopment = false;
// ============================================
// VENDOR DATABASE (USB DETECTION)
// ============================================
const VENDOR_DATABASE = {
  0x04E8: 'Samsung Electronics',
  0x18D1: 'Google Inc.',
  0x05AC: 'Apple Inc.'
};

let usbDevices = [];
let adbAvailable = false;


// ============================================
// AUTO-UPDATER CONFIGURATION
// ============================================
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.disableDifferentialDownload = true; // CRITICAL: Ensures progress events fire

const isProduction = app.isPackaged;

if (isProduction) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: '9491340980',
    repo: 'rmx-desktop-releases-qa' // QA repository
  });
  console.log('[QA] Auto-updater configured: rmx-desktop-releases-qa');
}

// ============================================
// LOGGING SYSTEM
// ============================================
const logsDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, `app-${Date.now()}.log`);

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

function showErrorDialog(title, message) {
  const fullMsg = message + `\n\nLog: ${logFile}`;
  dialog.showErrorBox(title, fullMsg);
}

// ============================================
// SYSTEM NOTIFICATIONS
// ============================================
function showNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, '..', 'build', 'icon.ico')
    }).show();
  }
}

// ============================================
// AUTO-UPDATER EVENT HANDLERS
// ============================================
let updateCheckInterval;
let updateDownloadedInfo = null;
let isDownloadingUpdate = false;

function sendStatusToWindow(event, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', { event, data });
    logInfo('Sent update status:', event);
  }
}

autoUpdater.on('checking-for-update', () => {
  logInfo('[QA] Checking for updates...');
  sendStatusToWindow('checking-for-update');
});

autoUpdater.on('update-available', (info) => {
  logInfo('[QA] Update available:', info.version);
  sendStatusToWindow('update-available', info);
  showNotification('Update Available', `Version ${info.version} is available. Download will start automatically.`);

  // Auto-start download after 1 second
  setTimeout(() => {
    logInfo('[QA] Auto-starting download...');
    isDownloadingUpdate = true;
    autoUpdater.downloadUpdate();
  }, 1000);
});

autoUpdater.on('update-not-available', (info) => {
  logInfo('[QA] No updates available');
  sendStatusToWindow('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  logError('[QA] Update error:', err.message);
  sendStatusToWindow('update-error', err.message);
  isDownloadingUpdate = false;
});

autoUpdater.on('download-progress', (progressObj) => {
  isDownloadingUpdate = true;
  logInfo(`[QA] Download progress: ${progressObj.percent.toFixed(2)}%`);
  sendStatusToWindow('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  logInfo('[QA] Update downloaded, auto-installing in 3 seconds');
  updateDownloadedInfo = info;
  isDownloadingUpdate = false;
  sendStatusToWindow('update-downloaded', info);

  showNotification('Update Downloaded', 'The update is ready. The application will restart in 3 seconds.');

  // MANDATORY UPDATE: Auto-install after 3 seconds
  setTimeout(() => {
    logInfo('[QA] Auto-installing update...');
    if (mainWindow) mainWindow.close();
    setTimeout(() => {
      autoUpdater.quitAndInstall(false, true);
    }, 500);
  }, 3000);
});

function checkForUpdates() {
  if (!isProduction) {
    logInfo('[QA] Update check skipped (not packaged)');
    return;
  }
  if (!mainWindow || isDownloadingUpdate) return;

  logInfo('[QA] Checking for updates from rmx-desktop-releases-qa...');
  autoUpdater.checkForUpdates()
    .then(() => logInfo('[QA] Update check initiated'))
    .catch(err => logError('[QA] Update check failed:', err.message));
}

ipcMain.on('check-for-updates', () => checkForUpdates());
ipcMain.on('download-update', () => {
  if (!isDownloadingUpdate) {
    isDownloadingUpdate = true;
    autoUpdater.downloadUpdate().catch(err => {
      logError('[QA] Download failed:', err.message);
      isDownloadingUpdate = false;
    });
  }
});
ipcMain.on('quit-and-install', () => {
  if (mainWindow) mainWindow.close();
  setTimeout(() => autoUpdater.quitAndInstall(false, true), 500);
});


// ============================================
// USB DETECTION FUNCTIONS
// ============================================

async function getIPhoneInfoFromRegistry(vendorId, productId) {
  if (process.platform !== 'win32') return null;
  try {
    const vid = vendorId.toString(16).toUpperCase().padStart(4, '0');
    const pid = productId.toString(16).toUpperCase().padStart(4, '0');
    const psCommand = `Get-PnpDevice | Where-Object { $_.InstanceId -like "*VID_${vid}&PID_${pid}*" } | ConvertTo-Json`;
    const { stdout } = await execPromise(`powershell -Command "${psCommand}"`, { timeout: 5000 });
    if (stdout && stdout.trim()) {
      const data = JSON.parse(stdout);
      return { serialNumber: 'DETECTED', friendlyName: data.FriendlyName || 'iPhone' };
    }
  } catch (error) {
    logError('iPhone detection error:', error.message);
  }
  return null;
}

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
    return stdout.split('\n').slice(1).filter(line => line.trim() && line.includes('\t'))
      .map(line => { const [serial, status] = line.trim().split('\t'); return { serial, status }; })
      .filter(device => device.status === 'device');
  } catch (error) {
    return [];
  }
}

async function getAllUSBDevices() {
  try {
    adbAvailable = await isADBAvailable();
    const { usb } = require('usb');
    const devices = usb.getDeviceList();
    const deviceInfo = devices.map(device => ({
      vendorId: device.deviceDescriptor.idVendor,
      productId: device.deviceDescriptor.idProduct,
      isIPhone: device.deviceDescriptor.idVendor === 0x05AC,
      isAndroid: [0x04E8, 0x18D1].includes(device.deviceDescriptor.idVendor)
    }));
    logInfo('📊 USB devices detected:', deviceInfo.length);
    return deviceInfo;
  } catch (error) {
    logError('USB detection error:', error.message);
    return [];
  }
}

function setupUSBListeners() {
  try {
    const { usb } = require('usb');
    usb.on('attach', async () => {
      logInfo('🔌 USB attached');
      usbDevices = await getAllUSBDevices();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usb-devices-updated', usbDevices);
      }
    });
    usb.on('detach', async () => {
      logInfo('🔌 USB detached');
      usbDevices = await getAllUSBDevices();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('usb-devices-updated', usbDevices);
      }
    });
    logInfo('✅ USB listeners activated');
  } catch (error) {
    logError('USB listeners error:', error.message);
  }
}

function setupIPCHandlers() {
  logInfo('🔧 Setting up USB IPC handlers...');

  ipcMain.handle('get-usb-devices', async () => {
    try {
      return await getAllUSBDevices();
    } catch (error) {
      logError('IPC get-usb-devices error:', error.message);
      return [];
    }
  });

  ipcMain.handle('refresh-usb-devices', async () => {
    try {
      usbDevices = await getAllUSBDevices();
      return usbDevices;
    } catch (error) {
      logError('IPC refresh-usb-devices error:', error.message);
      return [];
    }
  });

  ipcMain.handle('check-adb-status', async () => {
    const available = await isADBAvailable();
    return { available, message: available ? 'ADB available' : 'ADB not found' };
  });

  ipcMain.handle('get-iphone-serial', async (event, vendorId, productId) => {
    return await getIPhoneInfoFromRegistry(vendorId, productId);
  });

  logInfo('✅ USB IPC handlers registered');
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
          label: 'Check for Updates (QA)',
          click: () => checkForUpdates()
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => { if (mainWindow) mainWindow.reload(); }
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
          click: () => { if (mainWindow) mainWindow.webContents.setZoomFactor(1.0); }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => { if (mainWindow) mainWindow.webContents.toggleDevTools(); }
        }
      ]
    },
    {
      label: 'Environment',
      submenu: [
        {
          label: 'QA Environment',
          enabled: false
        },
        {
          label: 'Repository: rmx-desktop-releases-qa',
          enabled: false
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About RMX Desktop (QA)',
              message: 'RMX Desktop QA Environment',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}`
            });
          }
        },
        { type: 'separator' },
        {
          label: 'View Logs',
          click: () => require('electron').shell.openPath(logsDir)
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
  logInfo('Creating QA window...');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    title: 'RMX Desktop (QA)',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: true,
      zoomFactor: 1.0
    },
    show: false,
    backgroundColor: '#2196f3' // Blue for QA
  });

   mainWindow.once('ready-to-show', async () => {
    mainWindow.show();
    logInfo('QA window shown');

    // Initial USB scan
    logInfo('🔍 USB scan starting...');
    try {
      usbDevices = await getAllUSBDevices();
      logInfo(`✅ USB scan complete: ${usbDevices.length} devices`);
    } catch (error) {
      logError('❌ USB scan failed:', error.message);
    }

    if (isProduction) {
      setTimeout(() => {
        logInfo('[QA] Starting initial update check...');
        checkForUpdates();
      }, 3000);

      // Check every 12 hours
      updateCheckInterval = setInterval(() => {
        logInfo('[QA] Periodic update check...');
        checkForUpdates();
      }, 12 * 60 * 60 * 1000);
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message) => {
    logInfo(`[RENDERER] ${message}`);
  });

  loadProductionApp(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (updateCheckInterval) clearInterval(updateCheckInterval);
  });
}

// ============================================
// LOAD PRODUCTION APP
// ============================================
function loadProductionApp(window) {
  logInfo('========================================');
  logInfo('[QA] Loading Production Build');
  logInfo('========================================');

  const paths = [
    path.join(__dirname, '..', 'dist', 'DesktopApp', 'browser', 'index.html'),
    path.join(process.resourcesPath, 'app.asar', 'dist', 'DesktopApp', 'browser', 'index.html'),
    path.join(process.resourcesPath, 'dist', 'DesktopApp', 'browser', 'index.html')
  ];

  let foundPath = paths.find(p => fs.existsSync(p));

  if (foundPath) {
    logInfo('✓ Using:', foundPath);
    window.loadFile(foundPath)
      .then(() => logInfo('✓✓✓ SUCCESS! QA app loaded'))
      .catch(err => {
        logError('✗✗✗ FAILED to load:', err.message);
        showErrorDialog('Load Error', err.message);
      });
  } else {
    logError('✗✗✗ CRITICAL: index.html NOT FOUND!');
    showErrorDialog('App Files Not Found', 'Could not find index.html!');
  }
}

// ============================================
// APP LIFECYCLE
// ============================================
app.whenReady().then(() => {
  logInfo('========================================');
  logInfo('RMX Desktop QA');
  logInfo('Environment: QA');
  logInfo('Auto-update: ENABLED');
  logInfo('Repository: rmx-desktop-releases-qa');
  logInfo('Update check: Every 12 hours');
  logInfo('Version:', app.getVersion());
  logInfo('========================================');

  setupIPCHandlers();
  setupUSBListeners();

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
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled Rejection:', reason);
});

logInfo('main.qa.js loaded');
