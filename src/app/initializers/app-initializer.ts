import { ConfigService } from "../services/config-service";

/**
 * Factory function for APP_INITIALIZER
 * This loads the application configuration before the app starts
 *
 * IMPORTANT: This must return a function that returns a Promise
 */
export function initializeApp(configService: ConfigService) {
  return (): Promise<any> => {

    return new Promise((resolve, reject) => {
      configService.loadConfig().subscribe({
        next: (config) => {
          resolve(config);
        },
        error: (error) => {
          // Resolve anyway to allow app to start with default config
          resolve(null);
        }
      });
    });
  };
}
