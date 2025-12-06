// src/environments/environment.qa.ts (QA)
export const environment = {
  production: false,
  envName: 'QA',

  // API URLs - QA environment (your existing QA server)
  comUrl: 'http://qaapi-rmxt026.am.gxo.com:8010/',
  utlUrl: 'http://qaapi-rmxt026.am.gxo.com:8015/',
  secUrl: 'http://qaapi-rmxt026.am.gxo.com:8020/',
  recUrl: 'http://qaapi-rmxt026.am.gxo.com:8025/',
  tstUrl: 'http://qaapi-rmxt026.am.gxo.com:8030/',
  wtUrl: 'https://qaapi-rmxt026.am.gxo.com:8883/',
  conUrl: 'http://qaapi-rmxt026.am.gxo.com:8017/',
  mntUrl: 'http://qaapi-rmxt026.am.gxo.com:8013/',
  trsUrl: 'http://qaapi-rmxt026.am.gxo.com:8055/',

  // Environment identifier
  env: 'QA026',

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
  ],

  // Auto-update configuration
  autoUpdate: {
    enabled: true, // Enabled in QA
    checkInterval: 12 * 60 * 60 * 1000, // 12 hours
    repository: {
      owner: '9491340980',
      repo: 'rmx-desktop-releases-qa'
    }
  },

  // Feature flags
  features: {
    debugMode: true,
    verboseLogging: true,
    showDevTools: true
  },

  // App branding
  appTitle: 'RMX Desktop (QA)',
  appColor: '#2196f3', // Blue
  versionSuffix: '-qa'
};
