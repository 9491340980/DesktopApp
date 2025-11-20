import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap, catchError, throwError } from 'rxjs';
import { AppConfig, ClientConfig } from '../models/app-config.models';
import { ApiModule, StorageKey } from '../enums/app-constants.enum';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private config: AppConfig | null = null;
  private readonly CONFIG_FILE_PATH = '/config/app-config.json';
  private isLoading = false;

  constructor(private http: HttpClient) {
    console.log('🔧 ConfigService: Initialized');
  }

  /**
   * Load application configuration
   * This should be called during app initialization
   */
  loadConfig(): Observable<AppConfig> {
    console.log('📥 ConfigService.loadConfig: Starting...');

    // Check if config is already loaded
    if (this.config) {
      console.log('✅ ConfigService.loadConfig: Config already loaded, returning cached config');
      return of(this.config);
    }

    // Check if already loading
    if (this.isLoading) {
      console.log('⏳ ConfigService.loadConfig: Already loading, waiting...');
      return throwError(() => new Error('Configuration is already being loaded'));
    }

    // Try to load from localStorage first (for offline support)
    const cachedConfig = this.getConfigFromStorage();
    if (cachedConfig) {
      console.log('💾 ConfigService.loadConfig: Loaded from localStorage cache');
      this.config = cachedConfig;
      return of(cachedConfig);
    }

    // Load from file
    console.log(`📂 ConfigService.loadConfig: Loading from ${this.CONFIG_FILE_PATH}`);
    this.isLoading = true;

    return this.http.get<AppConfig>(this.CONFIG_FILE_PATH).pipe(
      tap(config => {
        console.log('✅ ConfigService.loadConfig: Loaded successfully from file', config);
        this.config = config;
        this.saveConfigToStorage(config);
        this.isLoading = false;
      }),
      catchError(error => {
        console.error('❌ ConfigService.loadConfig: Failed to load from file', error);
        console.log('🔄 ConfigService.loadConfig: Using default configuration');
        this.isLoading = false;

        const defaultConfig = this.getDefaultConfig();
        this.config = defaultConfig;
        this.saveConfigToStorage(defaultConfig);

        return of(defaultConfig);
      })
    );
  }

  /**
   * Get current configuration
   * If config is not loaded, it will try to load from storage or use default
   */
  getConfig(): AppConfig {
    if (!this.config) {
      console.warn('⚠️ ConfigService.getConfig: Config not loaded yet, trying to load from storage...');

      // Try to get from storage
      const cachedConfig = this.getConfigFromStorage();
      if (cachedConfig) {
        console.log('💾 ConfigService.getConfig: Loaded from localStorage');
        this.config = cachedConfig;
        return cachedConfig;
      }

      // Use default config
      console.log('🔄 ConfigService.getConfig: Using default configuration');
      this.config = this.getDefaultConfig();
      return this.config;
    }

    return this.config;
  }

  /**
   * Get URL for specific module
   */
  getModuleUrl(module: ApiModule): string {
    const config = this.getConfig();
    const url = config[module] || '';
    console.log(`🔗 ConfigService.getModuleUrl: ${module} = ${url}`);
    return url;
  }

  /**
   * Get environment name
   */
  getEnvironment(): string {
    const env = this.getConfig().env;
    console.log(`🌍 ConfigService.getEnvironment: ${env}`);
    return env;
  }

  /**
   * Get shared security configuration
   */
  getSharedSecurity(): { DataType: string; Application: string } {
    return this.getConfig().sharedSecurity;
  }

  /**
   * Get client configuration by name
   */
  getClientConfig(clientName: string): ClientConfig | undefined {
    return this.getConfig().clients.find(
      client => client.clientName.toLowerCase() === clientName.toLowerCase()
    );
  }

  /**
   * Get all clients
   */
  getAllClients(): ClientConfig[] {
    return this.getConfig().clients;
  }

  /**
   * Get site IDs for a client
   */
  getSiteIdsForClient(clientName: string): string[] {
    const client = this.getClientConfig(clientName);
    return client?.siteIds || [];
  }

  /**
   * Get error message by key
   */
  getErrorMessage(key: 'errorMsg' | 'invalidUser'): string {
    return this.getConfig()[key] || '';
  }

  /**
   * Check if configuration is loaded
   */
  isConfigLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfigToStorage(config: AppConfig): void {
    try {
      localStorage.setItem(StorageKey.APP_CONFIG, JSON.stringify(config));
      console.log('💾 ConfigService: Saved config to localStorage');
    } catch (error) {
      console.error('❌ ConfigService: Failed to save config to localStorage:', error);
    }
  }

  /**
   * Get configuration from localStorage
   */
  private getConfigFromStorage(): AppConfig | null {
    try {
      const configStr = localStorage.getItem(StorageKey.APP_CONFIG);
      if (configStr) {
        const config = JSON.parse(configStr);
        console.log('💾 ConfigService: Found config in localStorage');
        return config;
      }
    } catch (error) {
      console.error('❌ ConfigService: Failed to load config from localStorage:', error);
    }
    return null;
  }

  /**
   * Get default configuration (fallback)
   */
  private getDefaultConfig(): AppConfig {
    console.log('🔄 ConfigService: Creating default configuration');
    return {
      "comUrl": "http://qaapi-rmxt026.am.gxo.com:8010/",
      "utlUrl": "http://qaapi-rmxt026.am.gxo.com:8015/",
      "secUrl": "http://qaapi-rmxt026.am.gxo.com:8020/",
      "recUrl": "https://qaapi-rmxt026.am.gxo.com:8663/",
      "tstUrl": "https://qaapi-rmxt026.am.gxo.com:8773/",
      "wtUrl": "https://qaapi-rmxt026.am.gxo.com:8883/",
      "conUrl": "https://qaapi-rmxt026.am.gxo.com:8227/",
      "mntUrl": "https://qaapi-rmxt026.am.gxo.com:8225/",
      "trsUrl": "https://qaapi-rmxt026.am.gxo.com:8555/",
      "env": "QA026",
      "errorMsg": "7320011: Site configuration is missing in RMX",
      "invalidUser": "User is already logged in.",
      "sharedSecurity": {
        "DataType": "WAREHOUSE",
        "Application": "RMX"
      },
      "clients": [
        {
          "clientName": "VERIZON",
          "siteIds": ["DFW004", "DFW005", "DFW009"]
        }
      ]
    }
  }

  /**
   * Reload configuration
   */
  reloadConfig(): Observable<AppConfig> {
    console.log('🔄 ConfigService: Reloading configuration...');
    this.config = null;
    localStorage.removeItem(StorageKey.APP_CONFIG);
    return this.loadConfig();
  }
}
