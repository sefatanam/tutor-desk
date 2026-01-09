// @REVIEW: Register Component - Placeholder
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { CardModule } from 'primeng/card';
import { SelectModule } from 'primeng/select';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-register',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    PasswordModule,
    CardModule,
    SelectModule,
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
              <h1>Create Account</h1>
              <p>Join Tutor Desk today</p>
            </div>
          </ng-template>

          @if (errorMessage()) {
            <p-message severity="error" [text]="errorMessage()" styleClass="w-full mb-4" />
          }

          @if (successMessage()) {
            <p-message severity="success" [text]="successMessage()" styleClass="w-full mb-4" />
          }

          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <div class="form-row">
              <div class="form-field">
                <label for="firstName">First Name</label>
                <input
                  pInputText
                  id="firstName"
                  type="text"
                  formControlName="firstName"
                  placeholder="John"
                  class="w-full"
                />
                @if (registerForm.get('firstName')?.touched && registerForm.get('firstName')?.errors?.['required']) {
                  <small class="p-error">First name is required</small>
                }
              </div>

              <div class="form-field">
                <label for="lastName">Last Name</label>
                <input
                  pInputText
                  id="lastName"
                  type="text"
                  formControlName="lastName"
                  placeholder="Doe"
                  class="w-full"
                />
                @if (registerForm.get('lastName')?.touched && registerForm.get('lastName')?.errors?.['required']) {
                  <small class="p-error">Last name is required</small>
                }
              </div>
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
              <label for="role">I am a</label>
              <p-select
                id="role"
                formControlName="role"
                [options]="roleOptions"
                placeholder="Select your role"
                styleClass="w-full"
              />
              @if (registerForm.get('role')?.touched && registerForm.get('role')?.errors?.['required']) {
                <small class="p-error">Please select a role</small>
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

            <button
              pButton
              type="submit"
              label="Create Account"
              [loading]="isLoading()"
              [disabled]="registerForm.invalid || isLoading()"
              class="w-full p-button-lg"
            ></button>
          </form>

          <p-divider align="center">
            <span class="divider-text">or</span>
          </p-divider>

          <div class="register-footer">
            <p>
              Already have an account?
              <a routerLink="/auth/login" class="login-link">Sign in</a>
            </p>
          </div>
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

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
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

    @media (max-width: 480px) {
      .form-row {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent {
  private readonly fb = new FormBuilder();

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly roleOptions = [
    { label: 'Teacher', value: 'teacher' },
    { label: 'Student', value: 'student' },
  ];

  readonly registerForm = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      role: ['', [Validators.required]],
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

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    // @TODO: Implement actual registration
    console.log('Register attempt:', this.registerForm.value);

    // Simulate API call
    setTimeout(() => {
      this.isLoading.set(false);
      // For now, just show a message
      this.errorMessage.set('Registration not implemented yet');
    }, 1000);
  }
}
