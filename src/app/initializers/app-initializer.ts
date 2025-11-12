import { ConfigService } from "../services/config-service";

/**
 * Factory function for APP_INITIALIZER
 * This loads the application configuration before the app starts
 *
 * IMPORTANT: This must return a function that returns a Promise
 */
export function initializeApp(configService: ConfigService) {
  return (): Promise<any> => {
    console.log('🚀 APP_INITIALIZER: Starting configuration load...');

    return new Promise((resolve, reject) => {
      configService.loadConfig().subscribe({
        next: (config) => {
          console.log('✅ APP_INITIALIZER: Configuration loaded successfully', config);
          resolve(config);
        },
        error: (error) => {
          console.error('❌ APP_INITIALIZER: Failed to load configuration', error);
          console.log('⚠️ APP_INITIALIZER: Continuing with default configuration');
          // Resolve anyway to allow app to start with default config
          resolve(null);
        }
      });
    });
  };
}
