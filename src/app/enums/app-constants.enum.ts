/**
 * Application Constants and Enums
 */

/**
 * API Module Types - Maps to different base URLs
 */
export enum ApiModule {
  COMMON = 'comUrl',
  UTILITIES = 'utlUrl',
  SECURITY = 'secUrl',
  RECEIVING = 'recUrl',
  TESTING = 'tstUrl',
  WAREHOUSE = 'wtUrl',
  CONFIGURATION = 'conUrl',
  MAINTENANCE = 'mntUrl',
  TRANSPORTATION = 'trsUrl'
}

/**
 * API Status Types
 */
export enum ApiStatus {
  PASS = 'PASS',
  FAIL = 'FAIL'
}

/**
 * Data Types
 */
export enum DataType {
  WAREHOUSE = 'WAREHOUSE',
  TRANSPORTATION = 'TRANSPORTATION'
}

/**
 * Application Types
 */
export enum ApplicationType {
  RMX = 'RMX',
  TMS = 'TMS'
}

/**
 * Error Message Keys
 */
export enum ErrorMessageKey {
  SITE_CONFIG_MISSING = 'errorMsg',
  INVALID_USER = 'invalidUser'
}

/**
 * Storage Keys - Comprehensive list for compatibility with existing app
 */
export enum StorageKey {
  // Authentication & User
  TOKEN = 'token',
  USERNAME = 'username',
  USER_ID = 'userId',
  USER_PROFILE = 'userProfile',
  REMEMBERED_USERNAME = 'rememberedUsername',
  ADD_WHO = 'addWho',

  // Client & Site Data
  CLIENT_DATA = 'clientData',
  CLIENT_ID = 'clientId',
  SITE_ID = 'siteId',
  SITE_IDS = 'siteIds',
  LOCATION = 'location',

  // Roles & Permissions
  ROLES_LIST = 'rolesList',
  ROLES_SITE_IDS = 'rolesSiteIds',

  // Session & Configuration
  SESSION = 'Session',
  SESSION_TIMEOUT = 'sessionTimeout',
  CONTROL_CONFIG = 'controlConfig',
  APP_CONFIG = 'appConfig',

  // Menu & Messages
  MENU = 'menu',
  MESSAGES = 'messages',
  MODULE = 'module',

  // Device & Workstation
  DEVICE_ID = 'deviceId',
  WORKSTATION_NAME = 'WorkStationName',
  WORKSTATION_DETAILS = 'WorkStationDetails',

  // Version & Release
  RELEASE_VERSION = 'releaseVersion',

  // Other
  CURRENT_PROFILE = 'currentProfile'
}

/**
 * Notification Types
 */
export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * HTTP Methods
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE'
}

/**
 * Config Module Names
 */
export enum ConfigModule {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  COMMON = 'COM'
}

/**
 * Status Codes (for compatibility with existing StatusCodes enum)
 */
export enum StatusCode {
  PASS = 'PASS',
  FAIL = 'FAIL',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
