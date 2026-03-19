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
  templateUrl: './login.component.html',
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
