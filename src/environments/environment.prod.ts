// src/environments/environment.prod.ts (PROD)
export const environment = {
  production: true,
  envName: 'PROD',

  // API URLs - PRODUCTION environment
  // TODO: Replace these with your actual PROD server URLs
  comUrl: 'http://prodapi-rmxt.am.gxo.com:8010/',
  utlUrl: 'http://prodapi-rmxt.am.gxo.com:8015/',
  secUrl: 'http://prodapi-rmxt.am.gxo.com:8020/',
  recUrl: 'http://prodapi-rmxt.am.gxo.com:8025/',
  tstUrl: 'http://prodapi-rmxt.am.gxo.com:8030/',
  wtUrl: 'https://prodapi-rmxt.am.gxo.com:8883/',
  conUrl: 'http://prodapi-rmxt.am.gxo.com:8017/',
  mntUrl: 'http://prodapi-rmxt.am.gxo.com:8013/',
  trsUrl: 'http://prodapi-rmxt.am.gxo.com:8055/',

  // Environment identifier
  env: 'PRODUCTION',

  // Error messages
  errorMsg: '7320011: Site configuration is missing in RMX',
  invalidUser: 'User is already logged in.',

  // Shared security
  sharedSecurity: {
    DataType: 'WAREHOUSE',
    Application: 'RMX'
  },

  // Clients configuration
  clients: [
    {
      clientName: 'VERIZON',
      siteIds: ['DFW004', 'DFW005', 'DFW009']
    }
    // Add more production clients here
  ],

  // Auto-update configuration
  autoUpdate: {
    enabled: true, // Enabled in PROD
    checkInterval: 6 * 60 * 60 * 1000, // 6 hours
    repository: {
      owner: '9491340980',
      repo: 'rmx-desktop-releases-prod'
    }
  },

  // Feature flags
  features: {
    debugMode: false,
    verboseLogging: false,
    showDevTools: false
  },

  // App branding
  appTitle: 'RMX Desktop',
  appColor: '#4caf50', // Green
  versionSuffix: ''
};
