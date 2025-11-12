/**
 * Application Configuration Models
 */

/**
 * Client Configuration
 */
export interface ClientConfig {
  clientName: string;
  siteIds: string[];
}

/**
 * Shared Security Configuration
 */
export interface SharedSecurityConfig {
  DataType: string;
  Application: string;
}

/**
 * URL Configuration
 */
export interface UrlConfig {
  comUrl: string;
  utlUrl: string;
  secUrl: string;
  recUrl: string;
  tstUrl: string;
  wtUrl: string;
  conUrl: string;
  mntUrl: string;
  trsUrl: string;
}

/**
 * Main Application Configuration
 */
export interface AppConfig extends UrlConfig {
  env: string;
  errorMsg: string;
  invalidUser: string;
  sharedSecurity: SharedSecurityConfig;
  clients: ClientConfig[];
}

/**
 * Device Information
 */
export interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
}
