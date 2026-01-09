// @REVIEW: Login Component
// Uses custom auth via Edge Function (NO Supabase Auth)
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthStore } from '../../../core/store/auth.store';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-login',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    CheckboxModule,
    DividerModule,
    MessageModule,
  ],
  template: `
    <div class="login-page">
      <div class="login-container">
        <!-- Logo -->
        <div class="login-logo">
          <a routerLink="/" class="logo-link">
            <span class="logo-icon">
              <i class="pi pi-book"></i>
            </span>
            <span class="logo-text">Tutor Desk</span>
          </a>
        </div>

        <!-- Login Card -->
        <p-card styleClass="login-card">
          <ng-template pTemplate="header">
            <div class="login-header">
              <h1>Welcome Back</h1>
              <p>Sign in to continue to your dashboard</p>
            </div>
          </ng-template>

          @if (authStore.error()) {
            <p-message severity="error" [text]="authStore.error()!" styleClass="w-full mb-4" />
          }

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <div class="form-field">
              <label for="email">Email</label>
              <input
                pInputText
                id="email"
                type="email"
                formControlName="email"
                placeholder="Enter your email"
                class="w-full"
              />
              @if (loginForm.get('email')?.touched && loginForm.get('email')?.errors?.['required']) {
                <small class="p-error">Email is required</small>
              }
              @if (loginForm.get('email')?.touched && loginForm.get('email')?.errors?.['email']) {
                <small class="p-error">Please enter a valid email</small>
              }
            </div>

            <div class="form-field">
              <label for="password">Password</label>
              <p-password
                id="password"
                formControlName="password"
                placeholder="Enter your password"
                [toggleMask]="true"
                [feedback]="false"
                styleClass="w-full"
                inputStyleClass="w-full"
              />
              @if (loginForm.get('password')?.touched && loginForm.get('password')?.errors?.['required']) {
                <small class="p-error">Password is required</small>
              }
            </div>

            <div class="form-options">
              <p-checkbox
                formControlName="rememberMe"
                [binary]="true"
                inputId="rememberMe"
                label="Remember me"
              />
              <a routerLink="/auth/forgot-password" class="forgot-link">Forgot password?</a>
            </div>

            <button
              pButton
              type="submit"
              label="Sign In"
              [loading]="authStore.isLoading()"
              [disabled]="loginForm.invalid || authStore.isLoading()"
              class="w-full p-button-lg"
            ></button>
          </form>

          <p-divider align="center">
            <span class="divider-text">New teacher?</span>
          </p-divider>

          <div class="login-footer">
            <p>
              <a routerLink="/auth/register" class="register-link">Register as a teacher</a>
            </p>
            <p class="student-note">
              <i class="pi pi-info-circle"></i>
              Students are created by their teachers
            </p>
          </div>
        </p-card>

        <p class="login-terms">
          By signing in, you agree to our
          <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
        </p>
      </div>
    </div>
  `,
  styles: `
    .login-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--surface-ground) 0%, var(--surface-section) 100%);
      padding: 2rem;
    }

    .login-container {
      width: 100%;
      max-width: 420px;
    }

    .login-logo {
      text-align: center;
      margin-bottom: 2rem;
    }

    .logo-link {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--text-color);
    }

    .logo-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: var(--primary-color);
      color: white;
      border-radius: 12px;
      font-size: 1.5rem;
    }

    .logo-text {
      font-size: 1.5rem;
      font-weight: 700;
    }

    :host ::ng-deep .login-card {
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }

    .login-header {
      text-align: center;
      padding: 1.5rem 1.5rem 0;
    }

    .login-header h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .login-header p {
      margin: 0;
      color: var(--text-color-secondary);
    }

    .form-field {
      margin-bottom: 1.25rem;
    }

    .form-field label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .form-options {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }

    .forgot-link {
      color: var(--primary-color);
      text-decoration: none;
      font-size: 0.875rem;
    }

    .forgot-link:hover {
      text-decoration: underline;
    }

    .divider-text {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }

    .login-footer {
      text-align: center;
    }

    .login-footer p {
      margin: 0;
      color: var(--text-color-secondary);
    }

    .register-link {
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 500;
    }

    .register-link:hover {
      text-decoration: underline;
    }

    .student-note {
      margin-top: 0.75rem !important;
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
    }

    .login-terms {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .login-terms a {
      color: var(--primary-color);
      text-decoration: none;
    }

    .login-terms a:hover {
      text-decoration: underline;
    }

    .p-error {
      display: block;
      margin-top: 0.25rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  // @REVIEW: Inject AuthStore for authentication
  readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;

    // Clear any previous errors
    this.authStore.clearError();

    const { email, password } = this.loginForm.getRawValue();
    const result = await this.authStore.login(email, password);

    if (result.success) {
      // Navigate to appropriate dashboard based on role
      this.authStore.navigateToDashboard();
    }
    // Error is handled by authStore.error() signal
  }
}
