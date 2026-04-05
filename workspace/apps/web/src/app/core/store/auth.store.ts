// @REVIEW: Authentication Store
// Signal-based state management for authentication
// Handles: user state, initialization, auto-refresh, navigation

import {
  Injectable,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { interval, Subscription, firstValueFrom } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  AuthService,
  AuthUser,
  CreateStudentData,
} from '../services/auth.service';
import type { UserRole, UserStatus } from '../types/database.types';

// =============================================
// STATE INTERFACES
// =============================================

export interface AuthState {
  readonly user: AuthUser | null;
  readonly isInitialized: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
}

// =============================================
// CONSTANTS
// =============================================

const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes
const MAX_INIT_WAIT_MS = 5000; // 5 seconds max wait for initialization

// =============================================
// STORE
// =============================================

@Injectable({
  providedIn: 'root',
})
export class AuthStore {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // Private state signals
  private readonly _user = signal<AuthUser | null>(null);
  private readonly _isInitialized = signal(false);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Refresh token subscription
  private refreshSubscription: Subscription | null = null;

  // =============================================
  // PUBLIC SELECTORS (Computed Signals)
  // =============================================

  readonly user = this._user.asReadonly();
  readonly isInitialized = this._isInitialized.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly isAuthenticated = computed(() => this._user() !== null);

  readonly userRole = computed(() => this._user()?.role ?? null);

  readonly userStatus = computed(() => this._user()?.status ?? null);

  readonly isTeacher = computed(() => this._user()?.role === 'teacher');

  readonly isStudent = computed(() => this._user()?.role === 'student');

  readonly isSuperAdmin = computed(() => this._user()?.role === 'super_admin');

  readonly isPendingApproval = computed(
    () => this._user()?.role === 'teacher' && this._user()?.status === 'pending'
  );

  readonly canAccess = computed(() => {
    const user = this._user();
    if (!user) return false;

    // Disabled or suspended users cannot access
    if (user.status === 'disabled' || user.status === 'suspended') return false;

    // Pending teachers have limited access
    if (user.role === 'teacher' && user.status === 'pending') return false;

    return true;
  });

  readonly teacherId = computed(() => this._user()?.teacherId ?? null);

  readonly studentId = computed(() => this._user()?.studentId ?? null);

  // Full state snapshot (for debugging)
  readonly state = computed<AuthState>(() => ({
    user: this._user(),
    isInitialized: this._isInitialized(),
    isLoading: this._isLoading(),
    error: this._error(),
  }));

  // =============================================
  // CONSTRUCTOR
  // =============================================

  constructor() {
    // Initialize auth state on construction
    this.initialize();

    // Setup token refresh check
    this.setupTokenRefresh();
  }

  // =============================================
  // PUBLIC ACTIONS
  // =============================================

  /**
   * Initialize authentication state from stored data
   * Should be called on app startup
   */
  async initialize(): Promise<void> {
    if (this._isInitialized()) return;

    this._isLoading.set(true);

    try {
      // Check for stored authentication
      if (this.authService.hasStoredAuth()) {
        const storedUser = this.authService.getStoredUser();

        // If token is expired or about to expire, try to refresh
        if (this.authService.isTokenExpired()) {
          await this.refreshSession();
        } else if (storedUser) {
          this._user.set(storedUser);
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      this.clearState();
    } finally {
      this._isInitialized.set(true);
      this._isLoading.set(false);
    }
  }

  /**
   * Wait for initialization to complete
   * Useful in guards that need to wait for auth state
   */
  async waitForInitialization(): Promise<boolean> {
    if (this._isInitialized()) return true;

    return new Promise<boolean>((resolve) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        if (this._isInitialized()) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > MAX_INIT_WAIT_MS) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 50);
    });
  }

  /**
   * Login with email and password
   */
  async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.authService.login(email, password)
      );

      if (response.success && response.user) {
        this._user.set(response.user);
        return { success: true };
      } else {
        const error = response.error || 'Login failed';
        this._error.set(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed';
      this._error.set(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Signup for teachers
   */
  async signup(
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> {
    this._isLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.authService.signup(email, password, fullName)
      );

      if (response.success) {
        // Signup successful but teacher is pending approval
        // Don't set user - they need to login after approval
        return { success: true };
      } else {
        const error = response.error || 'Signup failed';
        this._error.set(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Signup failed';
      this._error.set(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Logout and clear state
   */
  async logout(): Promise<void> {
    this._isLoading.set(true);

    try {
      await firstValueFrom(this.authService.logout());
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearState();
      this._isLoading.set(false);
      this.router.navigate(['/auth/login']);
    }
  }

  /**
   * Create a student (Teacher only)
   */
  async createStudent(
    studentData: CreateStudentData
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isTeacher()) {
      return { success: false, error: 'Only teachers can create students' };
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.authService.createStudent(studentData)
      );

      if (response.success) {
        return { success: true };
      } else {
        const error = response.error || 'Failed to create student';
        this._error.set(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create student';
      this._error.set(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Reset user password (SuperAdmin only)
   */
  async resetUserPassword(
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isSuperAdmin()) {
      return { success: false, error: 'Only super admins can reset passwords' };
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const response = await firstValueFrom(
        this.authService.resetPassword(userId, newPassword)
      );

      if (response.success) {
        return { success: true };
      } else {
        const error = response.error || 'Failed to reset password';
        this._error.set(error);
        return { success: false, error };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to reset password';
      this._error.set(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Clear error state
   */
  clearError(): void {
    this._error.set(null);
  }

  /**
   * Get the dashboard route for current user role
   */
  getDashboardRoute(): string {
    const role = this._user()?.role;

    switch (role) {
      case 'super_admin':
        return '/admin/dashboard';
      case 'teacher':
        return this.isPendingApproval()
          ? '/auth/pending'
          : '/teacher/dashboard';
      case 'student':
        return '/student/dashboard';
      default:
        return '/auth/login';
    }
  }

  /**
   * Navigate to appropriate dashboard based on role
   */
  navigateToDashboard(): void {
    const route = this.getDashboardRoute();
    this.router.navigate([route]);
  }

  // =============================================
  // PRIVATE METHODS
  // =============================================

  /**
   * Refresh the session using refresh token
   */
  private async refreshSession(): Promise<void> {
    try {
      const response = await firstValueFrom(this.authService.refreshToken());

      if (response.success && response.user) {
        this._user.set(response.user);
      } else {
        this.clearState();
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.clearState();
    }
  }

  /**
   * Setup automatic token refresh
   */
  private setupTokenRefresh(): void {
    // Check token expiry periodically
    interval(TOKEN_REFRESH_INTERVAL_MS)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        filter(
          () => this.isAuthenticated() && this.authService.isTokenExpired()
        )
      )
      .subscribe(() => {
        this.refreshSession();
      });
  }

  /**
   * Clear authentication state
   */
  private clearState(): void {
    this._user.set(null);
    this._error.set(null);
  }
}
