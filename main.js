const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// ============================================
// CRITICAL: DISABLE DEVELOPMENT MODE
// ============================================
// This MUST be false so the app loads from dist, not localhost:4200
const isDevelopment = false;

console.log('========================================');
console.log('Electron App Starting');
console.log('Mode: PRODUCTION (forced)');
console.log('Will load from: dist folder (NOT localhost)');
console.log('========================================');

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
  console.error('ERROR:', title, fullMsg);
  dialog.showErrorBox(title, fullMsg);
}

// ============================================
// WINDOW CREATION
// ============================================
let mainWindow = null;

function createWindow() {
  logInfo('Creating window...');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    title: 'RMX Desktop',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: true
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  // Open DevTools to see any errors
  mainWindow.webContents.openDevTools();

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

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
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
