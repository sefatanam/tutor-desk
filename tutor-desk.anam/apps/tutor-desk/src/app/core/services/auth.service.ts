// @REVIEW: Authentication Service
// Handles all authentication operations via custom Edge Function (NO Supabase Auth)
// Supports: login, signup, refresh, logout, createStudent, resetPassword

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, timer, of } from 'rxjs';
import { catchError, map, retry, timeout, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import type { UserRole, UserStatus } from '../types/database.types';

// =============================================
// INTERFACES
// =============================================

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly avatarUrl: string | null;
  readonly phone: string | null;
  // Role-specific IDs
  readonly teacherId?: string;
  readonly studentId?: string;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number; // seconds
  readonly expiresAt: number; // timestamp
}

export interface AuthResponse {
  readonly success: boolean;
  readonly user?: AuthUser;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly expiresIn?: number;
  readonly error?: string;
  readonly waitSeconds?: number; // For rate limiting
}

export interface LoginRequest {
  readonly action: 'login';
  readonly email: string;
  readonly password: string;
}

export interface SignupRequest {
  readonly action: 'signup';
  readonly email: string;
  readonly password: string;
  readonly full_name: string;
}

export interface RefreshRequest {
  readonly action: 'refresh';
  readonly refresh_token: string;
}

export interface LogoutRequest {
  readonly action: 'logout';
  readonly refresh_token: string;
}

export interface ResetPasswordRequest {
  readonly action: 'reset_password';
  readonly user_id: string;
  readonly new_password: string;
}

export interface CreateStudentData {
  readonly full_name: string;
  readonly email: string;
  readonly password: string;
  readonly roll_number?: string;
  readonly class_name?: string;
  readonly section?: string;
}

export interface CreateStudentRequest {
  readonly action: 'create_student';
  readonly student_data: CreateStudentData;
}

type AuthRequest = 
  | LoginRequest 
  | SignupRequest 
  | RefreshRequest 
  | LogoutRequest 
  | ResetPasswordRequest 
  | CreateStudentRequest;

// =============================================
// STORAGE KEYS
// =============================================

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'td_access_token',
  REFRESH_TOKEN: 'td_refresh_token',
  TOKEN_EXPIRES_AT: 'td_token_expires_at',
  USER: 'td_user',
} as const;

// =============================================
// SERVICE
// =============================================

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authUrl = environment.supabase.authFunctionUrl;

  // =============================================
  // PUBLIC METHODS
  // =============================================

  /**
   * Login with email and password
   * Returns user data and tokens on success
   */
  login(email: string, password: string): Observable<AuthResponse> {
    const request: LoginRequest = {
      action: 'login',
      email: email.toLowerCase().trim(),
      password,
    };

    return this.sendAuthRequest(request).pipe(
      map((response) => {
        if (response.success && response.accessToken && response.refreshToken && response.user) {
          this.storeAuthData(response);
        }
        return response;
      })
    );
  }

  /**
   * Signup for teachers only
   * Students cannot self-register
   * Teacher status will be 'pending' until approved by SuperAdmin
   */
  signup(email: string, password: string, fullName: string): Observable<AuthResponse> {
    const request: SignupRequest = {
      action: 'signup',
      email: email.toLowerCase().trim(),
      password,
      full_name: fullName.trim(),
    };

    return this.sendAuthRequest(request);
  }

  /**
   * Refresh access token using refresh token
   * Should be called before access token expires
   */
  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getStoredRefreshToken();
    
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const request: RefreshRequest = {
      action: 'refresh',
      refresh_token: refreshToken,
    };

    return this.sendAuthRequest(request).pipe(
      map((response) => {
        if (response.success && response.accessToken && response.refreshToken) {
          this.storeAuthData(response);
        } else {
          // Refresh failed, clear stored data
          this.clearAuthData();
        }
        return response;
      }),
      catchError((error) => {
        this.clearAuthData();
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout and revoke refresh token
   */
  logout(): Observable<AuthResponse> {
    const refreshToken = this.getStoredRefreshToken();
    
    // Clear local data regardless of API result
    const clearAndReturn = (): Observable<AuthResponse> => {
      this.clearAuthData();
      return of({ success: true });
    };

    if (!refreshToken) {
      return clearAndReturn();
    }

    const request: LogoutRequest = {
      action: 'logout',
      refresh_token: refreshToken,
    };

    return this.sendAuthRequest(request, false).pipe(
      switchMap(() => clearAndReturn()),
      catchError(() => clearAndReturn())
    );
  }

  /**
   * Create a student account (Teacher only)
   * Requires valid access token from a teacher
   */
  createStudent(studentData: CreateStudentData): Observable<AuthResponse> {
    const request: CreateStudentRequest = {
      action: 'create_student',
      student_data: {
        ...studentData,
        email: studentData.email.toLowerCase().trim(),
        full_name: studentData.full_name.trim(),
      },
    };

    return this.sendAuthRequest(request, true);
  }

  /**
   * Reset user password (SuperAdmin only)
   * Requires valid access token from a super_admin
   */
  resetPassword(userId: string, newPassword: string): Observable<AuthResponse> {
    const request: ResetPasswordRequest = {
      action: 'reset_password',
      user_id: userId,
      new_password: newPassword,
    };

    return this.sendAuthRequest(request, true);
  }

  // =============================================
  // TOKEN MANAGEMENT
  // =============================================

  /**
   * Get stored access token
   */
  getStoredAccessToken(): string | null {
    return this.getFromStorage(STORAGE_KEYS.ACCESS_TOKEN);
  }

  /**
   * Get stored refresh token
   */
  getStoredRefreshToken(): string | null {
    return this.getFromStorage(STORAGE_KEYS.REFRESH_TOKEN);
  }

  /**
   * Get stored user data
   */
  getStoredUser(): AuthUser | null {
    const userJson = this.getFromStorage(STORAGE_KEYS.USER);
    if (!userJson) return null;

    try {
      return JSON.parse(userJson) as AuthUser;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is expired or about to expire (within 60 seconds)
   */
  isTokenExpired(): boolean {
    const expiresAt = this.getFromStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    if (!expiresAt) return true;

    const expiresAtMs = parseInt(expiresAt, 10);
    const bufferMs = 60 * 1000; // 60 seconds buffer
    return Date.now() >= expiresAtMs - bufferMs;
  }

  /**
   * Check if user has valid authentication data stored
   */
  hasStoredAuth(): boolean {
    return !!(this.getStoredAccessToken() && this.getStoredRefreshToken() && this.getStoredUser());
  }

  // =============================================
  // DEVICE FINGERPRINT
  // =============================================

  /**
   * Generate a simple device fingerprint for token binding
   * This helps prevent token theft
   */
  generateDeviceFingerprint(): string {
    if (typeof window === 'undefined') return 'server';

    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      screen.colorDepth,
      new Date().getTimezoneOffset(),
    ];

    // Simple hash function
    const hash = components.join('|');
    let hashCode = 0;
    for (let i = 0; i < hash.length; i++) {
      const char = hash.charCodeAt(i);
      hashCode = ((hashCode << 5) - hashCode) + char;
      hashCode = hashCode & hashCode;
    }

    return Math.abs(hashCode).toString(36);
  }

  // =============================================
  // PRIVATE METHODS
  // =============================================

  /**
   * Send request to auth Edge Function
   * @REVIEW: Added response transformation from snake_case to camelCase
   */
  private sendAuthRequest(
    request: AuthRequest,
    requiresAuth: boolean = false
  ): Observable<AuthResponse> {
    const headers = this.buildHeaders(requiresAuth);

    return this.http.post<Record<string, unknown>>(this.authUrl, request, { headers }).pipe(
      timeout(environment.api.timeout),
      // @REVIEW: Transform snake_case response to camelCase AuthResponse
      map((response) => this.transformResponse(response)),
      retry({
        count: 1,
        delay: (error, retryCount) => {
          // Only retry on network errors, not auth errors
          if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
            return throwError(() => error);
          }
          return timer(1000 * retryCount);
        },
      }),
      catchError((error) => this.handleError(error))
    );
  }

  /**
   * Transform API response from snake_case to camelCase
   * @REVIEW: Handles the mismatch between Edge Function response and TypeScript interfaces
   */
  private transformResponse(response: Record<string, unknown>): AuthResponse {
    // Check for error response
    if (response['error']) {
      return {
        success: false,
        error: response['error'] as string,
        waitSeconds: response['wait_seconds'] as number | undefined,
      };
    }

    // Success response with tokens and user
    const user = response['user'] as Record<string, unknown> | undefined;
    
    return {
      success: true,
      accessToken: response['access_token'] as string | undefined,
      refreshToken: response['refresh_token'] as string | undefined,
      expiresIn: response['expires_in'] as number | undefined,
      user: user ? {
        id: user['id'] as string,
        email: user['email'] as string,
        fullName: user['full_name'] as string,
        role: user['role'] as UserRole,
        status: user['status'] as UserStatus,
        avatarUrl: user['avatar_url'] as string | null,
        phone: user['phone'] as string | null ?? null,
        teacherId: user['teacher_id'] as string | undefined,
        studentId: user['student_id'] as string | undefined,
      } : undefined,
    };
  }

  /**
   * Build HTTP headers for request
   * @REVIEW: Basic headers - apikey/Authorization are handled by interceptor
   */
  private buildHeaders(requiresAuth: boolean): HttpHeaders {
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-device-fingerprint': this.generateDeviceFingerprint(),
    });

    // If requiresAuth, we need to send the user's access token
    // This overrides the interceptor's default anon key
    if (requiresAuth) {
      const accessToken = this.getStoredAccessToken();
      if (accessToken) {
        headers = headers.set('Authorization', `Bearer ${accessToken}`);
      }
    }

    return headers;
  }

  /**
   * Store authentication data in localStorage
   */
  private storeAuthData(response: AuthResponse): void {
    if (response.accessToken) {
      this.setToStorage(STORAGE_KEYS.ACCESS_TOKEN, response.accessToken);
    }

    if (response.refreshToken) {
      this.setToStorage(STORAGE_KEYS.REFRESH_TOKEN, response.refreshToken);
    }

    if (response.expiresIn) {
      const expiresAt = Date.now() + response.expiresIn * 1000;
      this.setToStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString());
    }

    if (response.user) {
      this.setToStorage(STORAGE_KEYS.USER, JSON.stringify(response.user));
    }
  }

  /**
   * Clear all authentication data from localStorage
   */
  private clearAuthData(): void {
    this.removeFromStorage(STORAGE_KEYS.ACCESS_TOKEN);
    this.removeFromStorage(STORAGE_KEYS.REFRESH_TOKEN);
    this.removeFromStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    this.removeFromStorage(STORAGE_KEYS.USER);
  }

  /**
   * Handle HTTP errors
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unexpected error occurred';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else if (error.error && typeof error.error === 'object') {
      // Server-side error with response body
      errorMessage = error.error.error || error.error.message || errorMessage;
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.status === 429) {
      const waitSeconds = error.error?.waitSeconds || 60;
      errorMessage = `Too many attempts. Please wait ${waitSeconds} seconds before trying again.`;
    } else if (error.status === 401) {
      errorMessage = 'Invalid credentials or session expired.';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to perform this action.';
    }

    return throwError(() => new Error(errorMessage));
  }

  // =============================================
  // STORAGE HELPERS (SSR-safe)
  // =============================================

  private getFromStorage(key: string): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  }

  private setToStorage(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, value);
  }

  private removeFromStorage(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }
}
