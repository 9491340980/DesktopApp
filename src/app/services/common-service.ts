import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, finalize, Observable, retry, throwError, timeout, TimeoutError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiRequestConfig, ApiResponse, ClientData } from '../models/api.models';
import { Auth } from './auth';

@Injectable({
  providedIn: 'root',
})
export class CommonService {
  // private baseUrl: string = 'http://tsgvm04112:8020'; // Default base URL
  private baseUrl: string = 'https://qaapi-rmxt026.am.gxo.com:8553'; // Default base URL

  // private apiBaseUrl: string = 'http://tsgvm04112:8010/api'; // API base URL
  private apiBaseUrl: string = 'http://tsgvm04112:8010/api'; // API base URL

  private utlBaseURl:string='https://qaapi-rmxt026.am.gxo.com:8333/api'

  private defaultTimeout: number = 30000; // 30 seconds
  private isLoading: boolean = false;

  environment: string = 'QA026';

  // Inject services
  private authService = inject(Auth);
  private snackBar = inject(MatSnackBar);

  constructor(private http: HttpClient) {}

  /**
   * Generic API call method
   * @param config API request configuration
   * @returns Observable with typed response
   */
  public callApi<T = any>(config: ApiRequestConfig): Observable<ApiResponse<T>> {
    const {
      url,
      method,
      body = null,
      headers = {},
      showLoader = true,
      showError = true,
      timeout: requestTimeout = this.defaultTimeout
    } = config;

    // Show loader if enabled
    if (showLoader) {
      this.showLoader();
    }

    // Prepare headers (token is now handled by interceptor)
    const httpHeaders = this.prepareHeaders(headers);

    // Prepare HTTP request
    let request$: Observable<ApiResponse<T>>;

    switch (method.toUpperCase()) {
      case 'GET':
        request$ = this.http.get<ApiResponse<T>>(url, { headers: httpHeaders });
        break;
      case 'POST':
        request$ = this.http.post<ApiResponse<T>>(url, body, { headers: httpHeaders });
        break;
      case 'PUT':
        request$ = this.http.put<ApiResponse<T>>(url, body, { headers: httpHeaders });
        break;
      case 'DELETE':
        request$ = this.http.delete<ApiResponse<T>>(url, { headers: httpHeaders });
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    // Apply timeout and error handling
    return request$.pipe(
      timeout(requestTimeout),
      retry(1), // Retry once on failure
      catchError((error: any) => this.handleError(error, showError)),
      finalize(() => {
        if (showLoader) {
          this.hideLoader();
        }
      })
    );
  }

  /**
   * POST request with standard structure
   * Automatically uses ClientData from AuthService if not provided
   */
  public post<T = any>(
    endpoint: string,
    additionalData: any = {},
    options: Partial<ApiRequestConfig> = {},
    customClientData?: ClientData
  ): Observable<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);

    // Use custom ClientData or get from AuthService
    const clientData = customClientData || this.authService.getClientData();

    const body = {
      ClientData: clientData,
      ...additionalData
    };

    return this.callApi<T>({
      url,
      method: 'POST',
      body,
      ...options
    });
  }

  /**
   * POST request with explicit ClientData (for login, etc.)
   */
  public postWithClientData<T = any>(
    endpoint: string,
    clientData: ClientData,
    additionalData: any = {},
    options: Partial<ApiRequestConfig> = {}
  ): Observable<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const body = {
      ClientData: clientData,
      ...additionalData
    };

    return this.callApi<T>({
      url,
      method: 'POST',
      body,
      ...options
    });
  }

  /**
   * GET request (uses POST with ClientData)
   */
  public get<T = any>(
    endpoint: string,
    additionalData: any = {},
    options: Partial<ApiRequestConfig> = {}
  ): Observable<ApiResponse<T>> {
    return this.post<T>(endpoint, additionalData, options);
  }

  /**
   * Simple GET request (actual HTTP GET without ClientData)
   */
  public simpleGet<T = any>(
    endpoint: string,
    options: Partial<ApiRequestConfig> = {}
  ): Observable<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);

    return this.callApi<T>({
      url,
      method: 'GET',
      ...options
    });
  }

  /**
   * PUT request with standard structure
   */
  public put<T = any>(
    endpoint: string,
    additionalData: any = {},
    options: Partial<ApiRequestConfig> = {}
  ): Observable<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const clientData = this.authService.getClientData();

    const body = {
      ClientData: clientData,
      ...additionalData
    };

    return this.callApi<T>({
      url,
      method: 'PUT',
      body,
      ...options
    });
  }

  /**
   * DELETE request with standard structure
   */
  public delete<T = any>(
    endpoint: string,
    additionalData: any = {},
    options: Partial<ApiRequestConfig> = {}
  ): Observable<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const clientData = this.authService.getClientData();

    const body = {
      ClientData: clientData,
      ...additionalData
    };

    return this.callApi<T>({
      url,
      method: 'DELETE',
      body,
      ...options
    });
  }

  /**
   * Build full URL from endpoint
   */
  private buildUrl(endpoint: string): string {
    // If endpoint is already a full URL, return as-is
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }

    // If endpoint starts with /LogIn, use baseUrl, otherwise use apiBaseUrl
    if (endpoint.startsWith('/LogIn')) {
      return `${this.baseUrl}${endpoint}`;
    }

    if(endpoint.startsWith('/utilities')){
      return `${this.utlBaseURl}${endpoint}`;
    }

    return `${this.apiBaseUrl}${endpoint}`;
  }

  /**
   * Prepare HTTP headers
   * Note: Authorization token is now handled by HTTP interceptor
   */
  private prepareHeaders(customHeaders: { [key: string]: string } = {}): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });

    // Add custom headers
    Object.keys(customHeaders).forEach(key => {
      headers = headers.set(key, customHeaders[key]);
    });

    return headers;
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: any, showError: boolean): Observable<never> {
    let errorMessage: string;
    let errorDetails: any = {};

    if (error instanceof HttpErrorResponse) {
      // Server-side error
      if (error.error instanceof ErrorEvent) {
        // Client-side network error
        errorMessage = `Network Error: ${error.error.message}`;
        errorDetails = {
          type: 'CLIENT_ERROR',
          message: error.error.message
        };
      } else {
        // Backend returned an unsuccessful response code
        errorMessage = this.getServerErrorMessage(error);
        errorDetails = {
          type: 'SERVER_ERROR',
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          error: error.error
        };
      }
    } else if (error instanceof TimeoutError) {
      errorMessage = 'Request timeout. Please try again.';
      errorDetails = {
        type: 'TIMEOUT_ERROR',
        message: errorMessage
      };
    } else {
      errorMessage = `Unexpected Error: ${error.message || error}`;
      errorDetails = {
        type: 'UNKNOWN_ERROR',
        message: error.message || error
      };
    }

    // Log error to console (in production, send to logging service)
    this.logError(errorDetails);

    // Show error notification
    if (showError) {
      this.showError(errorMessage);
    }

    return throwError(() => ({
      message: errorMessage,
      details: errorDetails
    }));
  }

  /**
   * Get user-friendly error message from server response
   */
  private getServerErrorMessage(error: HttpErrorResponse): string {
    // Check if error response has our API structure
    if (error.error && error.error.Status === 'FAIL') {
      if (error.error.ErrorMessage && error.error.ErrorMessage.Message) {
        return error.error.ErrorMessage.Message;
      }
      return error.error.StatusMessage || 'Server error occurred';
    }

    // Default error messages based on status code
    switch (error.status) {
      case 0:
        return 'Unable to connect to server. Please check your network connection.';
      case 400:
        return 'Bad Request. Please check your input.';
      case 401:
        return 'Unauthorized. Please login again.';
      case 403:
        return 'Access Forbidden. You do not have permission.';
      case 404:
        return 'Resource not found.';
      case 500:
        return 'Internal Server Error. Please try again later.';
      case 503:
        return 'Service Unavailable. Please try again later.';
      default:
        return `Server Error: ${error.status} - ${error.statusText}`;
    }
  }

  /**
   * Log error (can be extended to send to logging service)
   */
  private logError(error: any): void {
    console.error('API Error:', {
      timestamp: new Date().toISOString(),
      ...error
    });

    // TODO: Send to logging service in production
    // this.loggingService.logError(error);
  }

  /**
   * Show error notification
   */
  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['error-snackbar']
    });
  }

  /**
   * Show success notification
   */
  public showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['success-snackbar']
    });
  }

  /**
   * Show info notification
   */
  public showInfo(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['info-snackbar']
    });
  }

  /**
   * Show warning notification
   */
  public showWarning(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'center',
      verticalPosition: 'top',
      panelClass: ['warning-snackbar']
    });
  }

  /**
   * Show loader (can be integrated with a global loader service)
   */
  private showLoader(): void {
    this.isLoading = true;
    // TODO: Integrate with global loader service
    // this.loaderService.show();
  }

  /**
   * Hide loader
   */
  private hideLoader(): void {
    this.isLoading = false;
    // TODO: Integrate with global loader service
    // this.loaderService.hide();
  }

  /**
   * Get loading state
   */
  public getLoadingState(): boolean {
    return this.isLoading;
  }

  /**
   * Set base URLs
   */
  public setBaseUrls(baseUrl: string, apiBaseUrl: string): void {
    this.baseUrl = baseUrl;
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Set default timeout
   */
  public setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Get base URL
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Get API base URL
   */
  public getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }
}
