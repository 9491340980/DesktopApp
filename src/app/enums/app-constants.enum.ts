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
 * Storage Keys
 */
export enum StorageKey {
  TOKEN = 'token',
  ROLES_LIST = 'rolesList',
  SITE_IDS = 'siteIds',
  USER_PROFILE = 'userProfile',
  CLIENT_ID = 'clientId',
  SITE_ID = 'siteId',
  LOCATION = 'location',
  USER_ID = 'userId',
  SESSION = 'session',
  CONTROL_CONFIG = 'controlConfig',
  SESSION_TIMEOUT = 'sessionTimeout',
  MENU = 'menu',
  MESSAGES = 'messages',
  USERNAME = 'username',
  DEVICE_ID = 'deviceId',
  REMEMBERED_USERNAME = 'rememberedUsername',
  RELEASE_VERSION = 'releaseVersion',
  APP_CONFIG = 'appConfig'
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
