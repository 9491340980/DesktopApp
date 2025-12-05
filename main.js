const { app, BrowserWindow, dialog, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

// ============================================
// CRITICAL: DISABLE DEVELOPMENT MODE
// ============================================
const isDevelopment = false;

// ============================================
// AUTO-UPDATER CONFIGURATION
// ============================================
autoUpdater.autoDownload = false; // Ask user before downloading
autoUpdater.autoInstallOnAppQuit = true; // Install when app closes

// Only check for updates in production (not during development)
const isProduction = app.isPackaged;

// CRITICAL FIX: Set feed URL explicitly for both portable and installed
if (isProduction) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: '9491340980',
    repo: 'rmx-desktop-releases'
  });

  logInfo('Auto-updater feed URL configured for GitHub');
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
  const message = `[${timestamp}] [${level}] ${args.join(' ')}`;

  console.log(message);

  try {
    fs.appendFileSync(logFile, message + '\n');
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

function logInfo(...args) {
  log('INFO', ...args);
}

function logError(...args) {
  log('ERROR', ...args);
}

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
      icon: path.join(__dirname, 'build', 'icon.ico')
    }).show();
  }
}

// ============================================
// AUTO-UPDATER EVENT HANDLERS
// ============================================
let updateCheckInterval;
let updateDownloadedInfo = null;

function sendStatusToWindow(event, data) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('update-status', { event, data });
    logInfo('Sent update status to window:', event, data ? JSON.stringify(data) : '');
  }
}

autoUpdater.on('checking-for-update', () => {
  logInfo('Checking for updates...');
  sendStatusToWindow('checking-for-update');
});

autoUpdater.on('update-available', (info) => {
  logInfo('Update available:', info.version);
  logInfo('Current version:', app.getVersion());
  logInfo('Release date:', info.releaseDate);
  sendStatusToWindow('update-available', info);

  // Show system notification
  showNotification(
    'Update Available',
    `Version ${info.version} is available for download.`
  );
});

autoUpdater.on('update-not-available', (info) => {
  logInfo('Update not available. Current version is latest:', app.getVersion());
  sendStatusToWindow('update-not-available', info);
});

autoUpdater.on('error', (err) => {
  logError('Error in auto-updater:', err.message);
  logError('Error stack:', err.stack);
  sendStatusToWindow('update-error', err.message);
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(2)}%`;
  log_message += ` (${progressObj.transferred}/${progressObj.total})`;
  logInfo(log_message);
  sendStatusToWindow('download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
  logInfo('Update downloaded:', info.version);
  logInfo('Update will be installed on quit');
  updateDownloadedInfo = info;
  sendStatusToWindow('update-downloaded', info);

  // Show system notification
  showNotification(
    'Update Ready',
    'The update has been downloaded and will be installed when you restart the app.'
  );
});

// Function to check for updates
function checkForUpdates() {
  if (!isProduction) {
    logInfo('Skipping update check - running in development mode');
    return;
  }

  if (!mainWindow) {
    logInfo('Skipping update check - window not ready');
    return;
  }

  logInfo('==========================================');
  logInfo('Initiating update check...');
  logInfo('App version:', app.getVersion());
  logInfo('App path:', app.getAppPath());
  logInfo('Is packaged:', app.isPackaged);
  logInfo('Update feed: github.com/9491340980/rmx-desktop-releases');
  logInfo('==========================================');

  autoUpdater.checkForUpdates()
    .then(result => {
      logInfo('Update check initiated successfully');
      if (result) {
        logInfo('Update check result:', JSON.stringify(result));
      }
    })
    .catch(err => {
      logError('Failed to check for updates:', err.message);
      logError('Error details:', err.stack);
    });
}

// IPC handlers for renderer process to trigger update actions
ipcMain.on('check-for-updates', () => {
  logInfo('Manual update check requested from renderer');
  checkForUpdates();
});

ipcMain.on('download-update', () => {
  logInfo('Download update requested from renderer');
  autoUpdater.downloadUpdate()
    .then(() => {
      logInfo('Update download started');
    })
    .catch(err => {
      logError('Failed to start download:', err.message);
    });
});

ipcMain.on('quit-and-install', () => {
  logInfo('Quit and install requested from renderer');

  // Close the window first to show user that action is happening
  if (mainWindow) {
    mainWindow.close();
  }

  // Small delay to ensure window closes gracefully
  setTimeout(() => {
    logInfo('Executing quitAndInstall...');
    autoUpdater.quitAndInstall(false, true); // false = don't force, true = relaunch after install
  }, 500);
});

// ============================================
// APPLICATION MENU WITH ZOOM
// ============================================
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            logInfo('Manual update check triggered from menu');
            checkForUpdates();
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => {
            app.quit();
          }
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
              const newZoom = Math.min(currentZoom + 0.1, 3.0);
              mainWindow.webContents.setZoomFactor(newZoom);
              logInfo('Zoom In:', newZoom.toFixed(1));
            }
          }
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            if (mainWindow) {
              const currentZoom = mainWindow.webContents.getZoomFactor();
              const newZoom = Math.max(currentZoom - 0.1, 0.5);
              mainWindow.webContents.setZoomFactor(newZoom);
              logInfo('Zoom Out:', newZoom.toFixed(1));
            }
          }
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.setZoomFactor(1.0);
              logInfo('Zoom Reset: 1.0');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            const updateInfo = updateDownloadedInfo
              ? `\n\nUpdate ${updateDownloadedInfo.version} is ready to install!`
              : '';

            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About RMX Desktop',
              message: 'RMX Desktop Application',
              detail: `Version: ${app.getVersion()}${updateInfo}\n\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}`
            });
          }
        },
        { type: 'separator' },
        {
          label: 'View Logs',
          click: () => {
            require('electron').shell.openPath(logsDir);
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ============================================
// WINDOW CREATION
// ============================================
let mainWindow = null;

function createWindow() {
  logInfo('Creating window...');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 600,
    title: 'RMX Desktop',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: true,
      zoomFactor: 1.0
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logInfo('Window shown');

    // Check for updates 3 seconds after window is shown
    if (isProduction) {
      setTimeout(() => {
        logInfo('Starting initial update check (3 seconds after window shown)...');
        checkForUpdates();
      }, 3000);

      // Check for updates every 6 hours
      updateCheckInterval = setInterval(() => {
        logInfo('Running periodic update check (6 hour interval)...');
        checkForUpdates();
      }, 6 * 60 * 60 * 1000);
    } else {
      logInfo('Auto-update disabled in development mode');
    }
  });

  // Log renderer console messages
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logInfo(`[RENDERER] ${message}`);
  });

  // Load production app
  loadProductionApp(mainWindow);

  // Error handlers
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logError('Failed to load:', validatedURL);
    logError('Error:', errorCode, errorDescription);
    showErrorDialog('Load Failed', `URL: ${validatedURL}\nError: ${errorDescription}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logInfo('✓ Page loaded successfully!');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (updateCheckInterval) {
      clearInterval(updateCheckInterval);
    }
  });
}

// ============================================
// LOAD PRODUCTION APP
// ============================================
function loadProductionApp(window) {
  logInfo('========================================');
  logInfo('Loading Production Build');
  logInfo('========================================');
  logInfo('__dirname:', __dirname);
  logInfo('resourcesPath:', process.resourcesPath);

  const paths = [
    path.join(__dirname, 'dist', 'DesktopApp', 'browser', 'index.html'),
    path.join(__dirname, 'dist', 'DesktopApp', 'browser', 'index.html'),
    path.join(process.resourcesPath, 'app.asar', 'dist', 'DesktopApp', 'browser', 'index.html'),
    path.join(process.resourcesPath, 'dist', 'DesktopApp', 'browser', 'index.html'),
    path.join(__dirname, '..', 'dist', 'DesktopApp', 'browser', 'index.html')
  ];

  logInfo('Checking paths:');
  let foundPath = null;

  for (let i = 0; i < paths.length; i++) {
    const testPath = paths[i];
    const exists = fs.existsSync(testPath);
    const status = exists ? '✓ FOUND' : '✗ not found';
    logInfo(`  [${i + 1}] ${status}: ${testPath}`);

    if (exists && !foundPath) {
      foundPath = testPath;
    }
  }

  if (foundPath) {
    logInfo('========================================');
    logInfo('✓ Using:', foundPath);
    logInfo('Loading file...');
    logInfo('========================================');

    window.loadFile(foundPath)
      .then(() => {
        logInfo('✓✓✓ SUCCESS! App loaded from:', foundPath);
      })
      .catch(err => {
        logError('✗✗✗ FAILED to load:', foundPath);
        logError('Error:', err.message);
        showErrorDialog('Load Error', `Path: ${foundPath}\nError: ${err.message}`);
      });
  } else {
    logError('========================================');
    logError('✗✗✗ CRITICAL ERROR: index.html NOT FOUND!');
    logError('========================================');
    logError('Searched in:');
    paths.forEach((p, i) => logError(`  ${i + 1}. ${p}`));

    showErrorDialog(
      'App Files Not Found',
      'Could not find index.html!\n\nThe dist folder is missing from the package.\n\nPaths checked:\n' +
      paths.map((p, i) => `${i + 1}. ${p}`).join('\n')
    );
  }
}

// ============================================
// APP LIFECYCLE
// ============================================
app.whenReady().then(() => {
  logInfo('========================================');
  logInfo('App Ready');
  logInfo('Version:', app.getVersion());
  logInfo('Is Packaged:', isProduction);
  logInfo('Is Portable:', !app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR !== undefined);
  logInfo('Electron:', process.versions.electron);
  logInfo('Chrome:', process.versions.chrome);
  logInfo('Node:', process.versions.node);
  logInfo('Platform:', process.platform);
  logInfo('App Path:', app.getAppPath());
  logInfo('User Data Path:', app.getPath('userData'));
  logInfo('Log file:', logFile);
  logInfo('========================================');

  createAppMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit - if update is downloaded, install it
app.on('before-quit', (event) => {
  if (updateDownloadedInfo) {
    logInfo('App closing with update ready - will install update');
  }
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('uncaughtException', (error) => {
  logError('Uncaught Exception:', error.message);
  console.error(error);
  showErrorDialog('Uncaught Exception', error.message);
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled Rejection:', reason);
  console.error(reason);
});

logInfo('main.js loaded');
