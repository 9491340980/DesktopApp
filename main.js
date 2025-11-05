const { app, BrowserWindow } = require('electron');
const path = require('path');

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================
const isDevelopment = process.env.NODE_ENV !== 'production';

// Fix for ICU data error in production
if (!isDevelopment) {
  // Set ICU data path for production
  const icuDataPath = path.join(process.resourcesPath, 'icudtl.dat');
  if (require('fs').existsSync(icuDataPath)) {
    app.commandLine.appendSwitch('icu-data-dir', process.resourcesPath);
  }
}

// Development only configurations
if (isDevelopment) {
  console.log('🔧 Running in DEVELOPMENT mode');
  console.log('⚠️  Ignoring SSL certificate errors');

  // Ignore certificate errors in development
  app.commandLine.appendSwitch('ignore-certificate-errors');

  // Disable security warnings
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// ============================================
// WINDOW CREATION
// ============================================
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // Disable web security in development for CORS and SSL
      webSecurity: !isDevelopment,
      devTools: isDevelopment
    },
    icon: path.join(__dirname, 'src/assets/icon.ico'),
    show: false, // Don't show until ready
    backgroundColor: '#ffffff'
  });

  // Show window when ready to prevent flickering
  win.once('ready-to-show', () => {
    win.show();
  });

  // Development mode
  if (isDevelopment || process.env.ELECTRON_START_URL) {
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:4200';
    console.log('📱 Loading from:', devUrl);
    win.loadURL(devUrl);
    win.webContents.openDevTools();
  } else {
    // Production mode - load built Angular app
    console.log('🚀 Loading production build');
    const indexPath = path.join(__dirname, 'dist/DesktopApp/browser/index.html');
    console.log('📂 Loading from:', indexPath);

    win.loadFile(indexPath).catch(err => {
      console.error('❌ Failed to load app:', err);
      // Try alternative path
      const altPath = path.join(process.resourcesPath, 'app/dist/DesktopApp/browser/index.html');
      console.log('🔄 Trying alternative path:', altPath);
      win.loadFile(altPath);
    });
  }

  // Handle certificate errors (development only)
  if (isDevelopment) {
    win.webContents.on('certificate-error', (event, url, error, certificate, callback) => {
      event.preventDefault();
      callback(true);
      console.log('⚠️  Certificate error bypassed for:', url);
    });
  }

  // Handle external links
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Open external links in default browser
    if (url.startsWith('http://') || url.startsWith('https://')) {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Log errors
  win.webContents.on('crashed', (event, killed) => {
    console.error('❌ WebContents crashed:', { killed });
  });

  win.on('unresponsive', () => {
    console.error('❌ Window became unresponsive');
  });
}

// ============================================
// APP LIFECYCLE
// ============================================
app.whenReady().then(() => {
  console.log('✅ App is ready');
  console.log('📍 App path:', app.getAppPath());
  console.log('📍 Resources path:', process.resourcesPath);
  console.log('📍 User data:', app.getPath('userData'));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================
// GLOBAL CERTIFICATE ERROR HANDLING
// ============================================
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDevelopment) {
    // In development, allow self-signed certificates
    event.preventDefault();
    callback(true);
    console.log('⚠️  Certificate error bypassed (global)');
  } else {
    // In production, use default behavior (reject invalid certs)
    callback(false);
  }
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Log Electron version
console.log('⚡ Electron version:', process.versions.electron);
console.log('🌐 Chrome version:', process.versions.chrome);
console.log('📦 Node version:', process.versions.node);
