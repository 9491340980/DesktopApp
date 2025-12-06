export const environment = {
  production: false,
  envName: 'DEV',

  "comUrl": "http://tsgvm04112:8010/",
  "utlUrl": "http://tsgvm04112:8015/",
  "secUrl": "http://tsgvm04112:8020/",
  "recUrl": "http://tsgvm04112:8025/",
  "tstUrl": "http://tsgvm04112:8030/",
  "wtUrl": "http://tsgvm04112:8035/",
  "rmcUrl": "http://tsgvm04112:8887/",
  "conUrl": "http://tsgvm04112:8017/",
  "mntUrl": "http://tsgvm04112:8013/",
  "trsUrl": "http://tsgvm04112:8055/",
  "asUrl": "http://tsgvm04112:8070/",

  env: 'DEV',

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
      "clientName": "VERIZON",
      "siteIds": [
        "DFW004",
        "DFW005",
        "DFW009"
      ]
    },
    {
      "clientName": "WHIRLPOOL",
      "siteIds": [
        "MDW001",
        "SEA002",
        "DFW001",
        "SJC001",
        "MDT001",
        "LAX001",
        "EWR003",
        "ATL002",
        "MEM005",
        "SLC001",
        "MCO001"
      ]
    }],

  // Auto-update configuration
  autoUpdate: {
    enabled: true, // Enabled in QA
    checkInterval: 12 * 60 * 60 * 1000, // 12 hours
    repository: {
      owner: '9491340980',
      repo: 'rmx-desktop-releases-dev'
    }
  },

  // Feature flags
  features: {
    debugMode: true,
    verboseLogging: true,
    showDevTools: true
  },

  // App branding
  appTitle: 'RMX Desktop (DEV)',
  appColor: '#2196f3', // Blue
  versionSuffix: '-dev'
};
