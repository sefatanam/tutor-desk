// @REVIEW: Pending Approval Component
// Shown to teachers whose accounts are pending approval by SuperAdmin
import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-pending',
  imports: [RouterLink, ButtonModule, CardModule],
  template: `
    <div class="pending-page">
      <div class="pending-container">
        <!-- Logo -->
        <div class="pending-logo">
          <a routerLink="/" class="logo-link">
            <span class="logo-icon">
              <i class="pi pi-book"></i>
            </span>
            <span class="logo-text">Tutor Desk</span>
          </a>
        </div>

        <p-card styleClass="pending-card">
          <div class="pending-content">
            <div class="pending-icon">
              <i class="pi pi-clock"></i>
            </div>

            <h1>Account Pending Approval</h1>

            <p class="pending-message">
              Thank you for registering! Your account is currently being
              reviewed by an administrator. You will receive an email
              notification once your account has been approved.
            </p>

            <div class="pending-info">
              <div class="info-item">
                <i class="pi pi-envelope"></i>
                <span>{{ authStore.user()?.email }}</span>
              </div>
              <div class="info-item">
                <i class="pi pi-user"></i>
                <span>{{ authStore.user()?.fullName }}</span>
              </div>
            </div>

            <div class="pending-actions">
              <button
                pButton
                type="button"
                label="Sign Out"
                severity="secondary"
                (click)="logout()"
                class="w-full"
              ></button>
            </div>
          </div>
        </p-card>

        <p class="pending-help">
          Need help? Contact us at
          <a href="mailto:support@tutordesk.app">support@tutordesk.app</a>
        </p>
      </div>
    </div>
  `,
  styles: `
    .pending-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, var(--surface-ground) 0%, var(--surface-section) 100%);
      padding: 2rem;
    }

    .pending-container {
      width: 100%;
      max-width: 480px;
    }

    .pending-logo {
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

    :host ::ng-deep .pending-card {
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
    }

    .pending-content {
      text-align: center;
      padding: 1rem;
    }

    .pending-icon {
      font-size: 4rem;
      color: var(--yellow-500);
      margin-bottom: 1.5rem;
    }

    .pending-content h1 {
      margin: 0 0 1rem;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-color);
    }

    .pending-message {
      color: var(--text-color-secondary);
      line-height: 1.6;
      margin: 0 0 1.5rem;
    }

    .pending-info {
      background: var(--surface-100);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1.5rem;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      color: var(--text-color);
    }

    .info-item i {
      color: var(--primary-color);
      width: 20px;
    }

    .pending-actions {
      margin-top: 1rem;
    }

    .pending-help {
      text-align: center;
      margin-top: 1.5rem;
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    .pending-help a {
      color: var(--primary-color);
      text-decoration: none;
    }

    .pending-help a:hover {
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingComponent {
  readonly authStore = inject(AuthStore);

  async logout(): Promise<void> {
    await this.authStore.logout();
  }
}
