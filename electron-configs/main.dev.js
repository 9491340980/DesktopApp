// electron-configs/main.dev.js - FOR LOCAL DEVELOPMENT (localhost)
const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================
// DEV ENVIRONMENT CONFIGURATION
// ============================================
const ENV = 'DEV';
const isDevelopment = true;

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
    backgroundColor: '#ff9800' // Orange for DEV
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.webContents.openDevTools();
    logInfo('DEV window shown');
  });

  // Log renderer console messages
  mainWindow.webContents.on('console-message', (event, level, message) => {
    logInfo(`[RENDERER] ${message}`);
  });

  // Load from localhost (Angular dev server)
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:4200';
  logInfo('========================================');
  logInfo('Loading from:', startUrl);
  logInfo('Make sure Angular dev server is running!');
  logInfo('Run: npm run dev');
  logInfo('========================================');

  mainWindow.loadURL(startUrl)
    .then(() => {
      logInfo('✓✓✓ SUCCESS! App loaded from:', startUrl);
    })
    .catch(err => {
      logError('✗✗✗ FAILED to load from:', startUrl);
      logError('Error:', err.message);
      logError('');
      logError('SOLUTION:');
      logError('1. Make sure Angular dev server is running');
      logError('2. Open another terminal and run: npm run dev');
      logError('3. Wait for "Compiled successfully" message');
      logError('4. Then restart Electron');
    });

  // Error handlers
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logError('Failed to load:', validatedURL);
    logError('Error:', errorCode, errorDescription);
    logError('');
    logError('This usually means Angular dev server is not running.');
    logError('Open another terminal and run: npm run dev');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logInfo('✓ Page loaded successfully!');
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
  logInfo('RMX Desktop DEV');
  logInfo('Environment: DEV (localhost mode)');
  logInfo('Version:', app.getVersion());
  logInfo('Electron:', process.versions.electron);
  logInfo('Platform:', process.platform);
  logInfo('Log file:', logFile);
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

// ============================================
// ERROR HANDLING
// ============================================
process.on('uncaughtException', (error) => {
  logError('Uncaught Exception:', error.message);
  console.error(error);
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled Rejection:', reason);
  console.error(reason);
});

logInfo('main.dev.js loaded (localhost mode)');
