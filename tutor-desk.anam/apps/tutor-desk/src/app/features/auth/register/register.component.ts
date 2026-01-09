// @REVIEW: Register Component - Teacher Only
// Students cannot self-register, they are created by teachers
// Teachers register with pending status until approved by SuperAdmin
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-register',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    DividerModule,
    MessageModule,
  ],
  template: `
    <div class="register-page">
      <div class="register-container">
        <!-- Logo -->
        <div class="register-logo">
          <a routerLink="/" class="logo-link">
            <span class="logo-icon">
              <i class="pi pi-book"></i>
            </span>
            <span class="logo-text">Tutor Desk</span>
          </a>
        </div>

        <!-- Register Card -->
        <p-card styleClass="register-card">
          <ng-template pTemplate="header">
            <div class="register-header">
              <h1>Teacher Registration</h1>
              <p>Create your teacher account</p>
            </div>
          </ng-template>

          @if (authStore.error()) {
            <p-message severity="error" [text]="authStore.error()!" styleClass="w-full mb-4" />
          }

          @if (successMessage()) {
            <p-message severity="success" [text]="successMessage()!" styleClass="w-full mb-4" />
          }

          @if (!isRegistered()) {
            <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
              <div class="form-field">
                <label for="fullName">Full Name</label>
                <input
                  pInputText
                  id="fullName"
                  type="text"
                  formControlName="fullName"
                  placeholder="John Doe"
                  class="w-full"
                />
                @if (registerForm.get('fullName')?.touched && registerForm.get('fullName')?.errors?.['required']) {
                  <small class="p-error">Full name is required</small>
                }
                @if (registerForm.get('fullName')?.touched && registerForm.get('fullName')?.errors?.['minlength']) {
                  <small class="p-error">Name must be at least 2 characters</small>
                }
              </div>

              <div class="form-field">
                <label for="email">Email</label>
                <input
                  pInputText
                  id="email"
                  type="email"
                  formControlName="email"
                  placeholder="john.doe@example.com"
                  class="w-full"
                />
                @if (registerForm.get('email')?.touched && registerForm.get('email')?.errors?.['required']) {
                  <small class="p-error">Email is required</small>
                }
                @if (registerForm.get('email')?.touched && registerForm.get('email')?.errors?.['email']) {
                  <small class="p-error">Please enter a valid email</small>
                }
              </div>

              <div class="form-field">
                <label for="password">Password</label>
                <p-password
                  id="password"
                  formControlName="password"
                  placeholder="Create a password"
                  [toggleMask]="true"
                  styleClass="w-full"
                  inputStyleClass="w-full"
                />
                @if (registerForm.get('password')?.touched && registerForm.get('password')?.errors?.['required']) {
                  <small class="p-error">Password is required</small>
                }
                @if (registerForm.get('password')?.touched && registerForm.get('password')?.errors?.['minlength']) {
                  <small class="p-error">Password must be at least 8 characters</small>
                }
              </div>

              <div class="form-field">
                <label for="confirmPassword">Confirm Password</label>
                <p-password
                  id="confirmPassword"
                  formControlName="confirmPassword"
                  placeholder="Confirm your password"
                  [toggleMask]="true"
                  [feedback]="false"
                  styleClass="w-full"
                  inputStyleClass="w-full"
                />
                @if (registerForm.get('confirmPassword')?.touched && registerForm.get('confirmPassword')?.errors?.['required']) {
                  <small class="p-error">Please confirm your password</small>
                }
                @if (registerForm.get('confirmPassword')?.touched && registerForm.errors?.['passwordMismatch']) {
                  <small class="p-error">Passwords do not match</small>
                }
              </div>

              <div class="info-box">
                <i class="pi pi-info-circle"></i>
                <span>Your account will be reviewed by an administrator before activation.</span>
              </div>

              <button
                pButton
                type="submit"
                label="Register as Teacher"
                [loading]="authStore.isLoading()"
                [disabled]="registerForm.invalid || authStore.isLoading()"
                class="w-full p-button-lg"
              ></button>
            </form>
          } @else {
            <!-- Success state -->
            <div class="success-state">
              <div class="success-icon">
                <i class="pi pi-check-circle"></i>
              </div>
              <h2>Registration Successful!</h2>
              <p>
                Your account has been created and is pending approval.
                You will receive an email once your account is activated.
              </p>
              <button
                pButton
                type="button"
                label="Go to Login"
                (click)="goToLogin()"
                class="w-full p-button-lg"
              ></button>
            </div>
          }

          @if (!isRegistered()) {
            <p-divider align="center">
              <span class="divider-text">or</span>
            </p-divider>

            <div class="register-footer">
              <p>
                Already have an account?
                <a routerLink="/auth/login" class="login-link">Sign in</a>
              </p>
            </div>
          }
        </p-card>

        <p class="register-terms">
          By creating an account, you agree to our
          <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
        </p>
      </div>
    </div>
  `,
  styles: `
    .register-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--surface-ground) 0%, var(--surface-section) 100%);
      padding: 2rem;
    }

    .register-container {
      width: 100%;
      max-width: 480px;
    }

    .register-logo {
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

    :host ::ng-deep .register-card {
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }

    .register-header {
      text-align: center;
      padding: 1.5rem 1.5rem 0;
    }

    .register-header h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .register-header p {
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

    .info-box {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--surface-100);
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .info-box i {
      color: var(--primary-color);
      margin-top: 2px;
    }

    .divider-text {
      color: var(--text-color-secondary);
      font-size: 0.875rem;
    }

    .register-footer {
      text-align: center;
    }

    .register-footer p {
      margin: 0;
      color: var(--text-color-secondary);
    }

    .login-link {
      color: var(--primary-color);
      text-decoration: none;
      font-weight: 500;
    }

    .login-link:hover {
      text-decoration: underline;
    }

    .register-terms {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.75rem;
      color: var(--text-color-secondary);
    }

    .register-terms a {
      color: var(--primary-color);
      text-decoration: none;
    }

    .register-terms a:hover {
      text-decoration: underline;
    }

    .p-error {
      display: block;
      margin-top: 0.25rem;
    }

    /* Success State */
    .success-state {
      text-align: center;
      padding: 1rem 0;
    }

    .success-icon {
      font-size: 4rem;
      color: var(--green-500);
      margin-bottom: 1rem;
    }

    .success-state h2 {
      margin: 0 0 0.75rem;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .success-state p {
      margin: 0 0 1.5rem;
      color: var(--text-color-secondary);
      line-height: 1.5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly isRegistered = signal(false);
  readonly successMessage = signal<string | null>(null);

  readonly registerForm = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: [this.passwordMatchValidator],
    }
  );

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');

    if (password && confirmPassword && password.value !== confirmPassword.value) {
      return { passwordMismatch: true };
    }
    return null;
  }

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) return;

    this.authStore.clearError();
    this.successMessage.set(null);

    const { fullName, email, password } = this.registerForm.getRawValue();
    const result = await this.authStore.signup(email, password, fullName);

    if (result.success) {
      this.isRegistered.set(true);
      this.successMessage.set('Your account has been created successfully!');
    }
    // Error is handled by authStore.error() signal
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}