/**
 * AuthService
 * Handles all authentication against the Go REST API.
 * Endpoints:
 *   POST /api/v1/auth/login
 *   POST /api/v1/auth/signup
 *   POST /api/v1/auth/refresh
 *   POST /api/v1/auth/logout
 *   POST /api/v1/auth/reset-password
 *   POST /api/v1/auth/create-student
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, switchMap, timeout } from 'rxjs/operators';
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
  readonly teacherId?: string;
  readonly studentId?: string;
}

export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly expiresAt: number;
}

export interface AuthResponse {
  readonly success: boolean;
  readonly user?: AuthUser;
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly expiresIn?: number;
  readonly error?: string;
  readonly waitSeconds?: number;
}

export interface CreateStudentData {
  readonly full_name: string;
  readonly email: string;
  readonly password: string;
  readonly roll_number?: string;
  readonly class_name?: string;
  readonly section?: string;
  readonly guardian_name?: string;
  readonly guardian_phone?: string;
  readonly address?: string;
  readonly date_of_birth?: string;
}

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // ── Public auth methods ──────────────────────────────────────────────────

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<Record<string, unknown>>(`${this.base}/auth/login`, {
        email: email.toLowerCase().trim(),
        password,
      })
      .pipe(
        timeout(environment.api.timeout),
        map((r) => this.transformSuccess(r)),
        map((r) => { if (r.success) this.storeAuthData(r); return r; }),
        catchError((e) => of(this.transformError(e)))
      );
  }

  signup(email: string, password: string, fullName: string): Observable<AuthResponse> {
    return this.http
      .post<Record<string, unknown>>(`${this.base}/auth/signup`, {
        email: email.toLowerCase().trim(),
        password,
        full_name: fullName.trim(),
      })
      .pipe(
        timeout(environment.api.timeout),
        map((r) => this.transformSuccess(r)),
        catchError((e) => of(this.transformError(e)))
      );
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http
      .post<Record<string, unknown>>(
        `${this.base}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: new HttpHeaders({ Authorization: `Bearer ${refreshToken}` }) }
      )
      .pipe(
        timeout(environment.api.timeout),
        map((r) => this.transformSuccess(r)),
        map((r) => {
          if (r.success) { this.storeAuthData(r); } else { this.clearAuthData(); }
          return r;
        }),
        catchError((e) => {
          this.clearAuthData();
          return of(this.transformError(e));
        })
      );
  }

  logout(): Observable<AuthResponse> {
    const refreshToken = this.getStoredRefreshToken();

    const clearAndReturn = (): Observable<AuthResponse> => {
      this.clearAuthData();
      return of({ success: true });
    };

    if (!refreshToken) return clearAndReturn();

    return this.http
      .post<Record<string, unknown>>(`${this.base}/auth/logout`, { refresh_token: refreshToken })
      .pipe(
        timeout(environment.api.timeout),
        switchMap(() => clearAndReturn()),
        catchError(() => clearAndReturn())
      );
  }

  /** Teacher-only: create a student account. Requires valid access token. */
  createStudent(studentData: CreateStudentData): Observable<AuthResponse> {
    return this.withFreshToken(() =>
      this.http
        .post<Record<string, unknown>>(`${this.base}/auth/create-student`, {
          ...studentData,
          email: studentData.email.toLowerCase().trim(),
          full_name: studentData.full_name.trim(),
        })
        .pipe(
          timeout(environment.api.timeout),
          map((r) => this.transformSuccess(r)),
          catchError((e) => of(this.transformError(e)))
        )
    );
  }

  /** SuperAdmin-only: reset a user's password. */
  resetPassword(userId: string, newPassword: string): Observable<AuthResponse> {
    return this.withFreshToken(() =>
      this.http
        .post<Record<string, unknown>>(`${this.base}/auth/reset-password`, {
          user_id: userId,
          new_password: newPassword,
        })
        .pipe(
          timeout(environment.api.timeout),
          map((r) => this.transformSuccess(r)),
          catchError((e) => of(this.transformError(e)))
        )
    );
  }

  // ── Token management ─────────────────────────────────────────────────────

  getStoredAccessToken(): string | null {
    return this.getFromStorage(STORAGE_KEYS.ACCESS_TOKEN);
  }

  getStoredRefreshToken(): string | null {
    return this.getFromStorage(STORAGE_KEYS.REFRESH_TOKEN);
  }

  getStoredUser(): AuthUser | null {
    const raw = this.getFromStorage(STORAGE_KEYS.USER);
    if (!raw) return null;
    try { return JSON.parse(raw) as AuthUser; } catch { return null; }
  }

  isTokenExpired(): boolean {
    const expiresAt = this.getFromStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    if (!expiresAt) return true;
    return Date.now() >= parseInt(expiresAt, 10) - 60_000;
  }

  hasStoredAuth(): boolean {
    return !!(this.getStoredAccessToken() && this.getStoredRefreshToken() && this.getStoredUser());
  }

  generateDeviceFingerprint(): string {
    if (typeof window === 'undefined') return 'server';
    const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, screen.colorDepth, new Date().getTimezoneOffset()].join('|');
    let h = 0;
    for (let i = 0; i < raw.length; i++) { h = Math.imul(31, h) + raw.charCodeAt(i) | 0; }
    return Math.abs(h).toString(36);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** If token expired, refresh first then execute fn. */
  private withFreshToken<T>(fn: () => Observable<T>): Observable<T> {
    if (this.isTokenExpired() && this.getStoredRefreshToken()) {
      return this.refreshToken().pipe(
        switchMap((r) => {
          if (!r.success) return throwError(() => new Error('Session expired. Please log in again.'));
          return fn();
        }),
        catchError(() => throwError(() => new Error('Session expired. Please log in again.')))
      );
    }
    return fn();
  }

  /**
   * Transform a successful snake_case Go API response into AuthResponse.
   * The Go API returns { access_token, refresh_token, expires_in, user: { ... } }
   * on success, or { error: "..." } on failure.
   */
  private transformSuccess(r: Record<string, unknown>): AuthResponse {
    if (r['error']) {
      return { success: false, error: r['error'] as string, waitSeconds: r['wait_seconds'] as number | undefined };
    }

    const u = r['user'] as Record<string, unknown> | undefined;
    return {
      success: true,
      accessToken: r['access_token'] as string | undefined,
      refreshToken: r['refresh_token'] as string | undefined,
      expiresIn: r['expires_in'] as number | undefined,
      user: u ? {
        id: u['id'] as string,
        email: u['email'] as string,
        fullName: (u['full_name'] as string) ?? '',
        role: u['role'] as UserRole,
        status: u['status'] as UserStatus,
        avatarUrl: (u['avatar_url'] as string | null) ?? null,
        phone: (u['phone'] as string | null) ?? null,
        teacherId: u['teacher_id'] as string | undefined,
        studentId: u['student_id'] as string | undefined,
      } : undefined,
    };
  }

  private transformError(error: unknown): AuthResponse {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as Record<string, unknown> | null;
      const msg = (body?.['error'] as string) || this.httpStatusMessage(error.status);
      return { success: false, error: msg, waitSeconds: body?.['wait_seconds'] as number | undefined };
    }
    if (error instanceof Error) return { success: false, error: error.message };
    return { success: false, error: 'An unexpected error occurred' };
  }

  private httpStatusMessage(status: number): string {
    switch (status) {
      case 0:   return 'Unable to connect to server. Please check your internet connection.';
      case 401: return 'Invalid credentials or session expired.';
      case 403: return 'You do not have permission to perform this action.';
      case 429: return 'Too many attempts. Please wait before trying again.';
      default:  return 'An unexpected error occurred';
    }
  }

  private storeAuthData(r: AuthResponse): void {
    if (r.accessToken)  this.setToStorage(STORAGE_KEYS.ACCESS_TOKEN, r.accessToken);
    if (r.refreshToken) this.setToStorage(STORAGE_KEYS.REFRESH_TOKEN, r.refreshToken);
    if (r.expiresIn)    this.setToStorage(STORAGE_KEYS.TOKEN_EXPIRES_AT, (Date.now() + r.expiresIn * 1000).toString());
    if (r.user)         this.setToStorage(STORAGE_KEYS.USER, JSON.stringify(r.user));
  }

  clearAuthData(): void {
    Object.values(STORAGE_KEYS).forEach((k) => this.removeFromStorage(k));
  }

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
