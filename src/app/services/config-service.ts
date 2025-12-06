// src/app/services/config-service.ts (SIMPLIFIED VERSION)
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { AppConfig, ClientConfig } from '../models/app-config.models';
import { ApiModule } from '../enums/app-constants.enum';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private config: AppConfig;

  constructor() {
    console.log(`🔧 ConfigService: Initialized for ${environment.envName} environment`);

    // Load configuration from environment file
    this.config = {
      comUrl: environment.comUrl,
      utlUrl: environment.utlUrl,
      secUrl: environment.secUrl,
      recUrl: environment.recUrl,
      tstUrl: environment.tstUrl,
      wtUrl: environment.wtUrl,
      conUrl: environment.conUrl,
      mntUrl: environment.mntUrl,
      trsUrl: environment.trsUrl,
      env: environment.env,
      errorMsg: environment.errorMsg,
      invalidUser: environment.invalidUser,
      sharedSecurity: environment.sharedSecurity,
      clients: environment.clients
    };

    console.log('✅ ConfigService: Configuration loaded from environment', this.config);
  }

  /**
   * Load application configuration
   * Now synchronous since config comes from environment file
   */
  loadConfig(): Observable<AppConfig> {
    console.log('📥 ConfigService.loadConfig: Returning environment-based config');
    return of(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Get URL for specific module
   */
  getModuleUrl(module: ApiModule): string {
    const url = this.config[module] || '';
    console.log(`🔗 ConfigService.getModuleUrl: ${module} = ${url}`);
    return url;
  }

  /**
   * Get environment name
   */
  getEnvironment(): string {
    const env = this.config.env;
    console.log(`🌍 ConfigService.getEnvironment: ${env}`);
    return env;
  }

  /**
   * Get shared security configuration
   */
  getSharedSecurity(): { DataType: string; Application: string } {
    return this.config.sharedSecurity;
  }

  /**
   * Get client configuration by name
   */
  getClientConfig(clientName: string): ClientConfig | undefined {
    return this.config.clients.find(
      client => client.clientName.toLowerCase() === clientName.toLowerCase()
    );
  }

  /**
   * Get all clients
   */
  getAllClients(): ClientConfig[] {
    return this.config.clients;
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
    return this.config[key] || '';
  }

  /**
   * Check if configuration is loaded
   */
  isConfigLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Reload configuration (not needed with environment files, but kept for compatibility)
   */
  reloadConfig(): Observable<AppConfig> {
    console.log('🔄 ConfigService: Reloading configuration from environment');
    return of(this.config);
  }
}
