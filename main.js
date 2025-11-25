const { app, BrowserWindow, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================
// CRITICAL: DISABLE DEVELOPMENT MODE
// ============================================
// This MUST be false so the app loads from dist, not localhost:4200
const isDevelopment = false;



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


  try {
    fs.appendFileSync(logFile, message + '\n');
  } catch (err) {
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
// APPLICATION MENU WITH ZOOM
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
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About RMX Desktop',
              message: 'RMX Desktop Application',
              detail: `Version: 1.0.0\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}`
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
      devTools: true, // Keep enabled for F12, but don't open by default
      zoomFactor: 1.0
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  // Dev tools are available via F12 but not opened by default
  // mainWindow.webContents.openDevTools(); // REMOVED - no auto-open

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logInfo('Window shown');
  });

  // Log renderer console messages
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logInfo(`[RENDERER] ${message}`);
  });

  // ALWAYS load production app (never localhost)
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
  });

  // Disable zoom with mouse wheel + Ctrl (optional - remove if you want mouse wheel zoom)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && (input.key === '=' || input.key === '-' || input.key === '0')) {
      // Allow keyboard shortcuts for zoom
      return;
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

  // Possible paths where index.html might be
  const paths = [
    // When running: electron .
    path.join(__dirname, 'dist', 'DesktopApp', 'browser', 'index.html'),

    // When packaged (inside app.asar)
    path.join(__dirname, 'dist', 'DesktopApp', 'browser', 'index.html'),

    // When packaged (alternative locations)
    path.join(process.resourcesPath, 'app.asar', 'dist', 'DesktopApp', 'browser', 'index.html'),
    path.join(process.resourcesPath, 'dist', 'DesktopApp', 'browser', 'index.html'),

    // Fallback
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
  logInfo('Electron:', process.versions.electron);
  logInfo('Chrome:', process.versions.chrome);
  logInfo('Node:', process.versions.node);
  logInfo('Platform:', process.platform);
  logInfo('Log file:', logFile);
  logInfo('========================================');

  // Create application menu with zoom controls
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
