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
  templateUrl: './pending.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingComponent {
  readonly authStore = inject(AuthStore);

  async logout(): Promise<void> {
    await this.authStore.logout();
  }
}
