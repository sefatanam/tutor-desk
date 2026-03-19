// @REVIEW: Forgot Password Component - Placeholder
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-forgot-password',
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    CardModule,
    MessageModule,
  ],
  templateUrl: './forgot-password.component.html',
  styles: `
    .forgot-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--surface-ground) 0%, var(--surface-section) 100%);
      padding: 2rem;
    }

    .forgot-container {
      width: 100%;
      max-width: 420px;
    }

    .forgot-logo {
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

    :host ::ng-deep .forgot-card {
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }

    .forgot-header {
      text-align: center;
      padding: 1.5rem 1.5rem 0;
    }

    .forgot-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      background: var(--surface-100);
      color: var(--primary-color);
      border-radius: 50%;
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }

    .forgot-header h1 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .forgot-header p {
      margin: 0;
      color: var(--text-color-secondary);
    }

    .form-field {
      margin-bottom: 1.5rem;
    }

    .form-field label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: var(--text-color);
    }

    .email-sent {
      text-align: center;
      padding: 1rem 0;
    }

    .email-sent i {
      font-size: 3rem;
      color: var(--primary-color);
      margin-bottom: 1rem;
    }

    .email-sent p {
      color: var(--text-color-secondary);
      margin-bottom: 1.5rem;
    }

    .forgot-footer {
      text-align: center;
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--surface-border);
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-color-secondary);
      text-decoration: none;
      font-size: 0.875rem;
    }

    .back-link:hover {
      color: var(--primary-color);
    }

    .p-error {
      display: block;
      margin-top: 0.25rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  private readonly fb = new FormBuilder();

  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly emailSent = signal(false);

  readonly forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.forgotForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    // @TODO: Implement actual password reset
    console.log('Password reset request:', this.forgotForm.value);

    // Simulate API call
    setTimeout(() => {
      this.isLoading.set(false);
      this.emailSent.set(true);
      this.successMessage.set(
        'If an account exists with this email, you will receive a reset link.'
      );
    }, 1000);
  }
}
