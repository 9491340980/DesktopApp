// electron-configs/main.qa.js
const { app, BrowserWindow, dialog, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// ============================================
// QA ENVIRONMENT CONFIGURATION
// ============================================
const ENV = 'QA';
const isDevelopment = false;

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

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logInfo('QA window shown');

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
