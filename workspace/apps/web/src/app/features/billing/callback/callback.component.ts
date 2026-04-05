import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { BillingService } from '../../../core/services/billing.service';

type CallbackState = 'processing' | 'success' | 'cancelled' | 'failed';

@Component({
  selector: 'app-payment-callback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ButtonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div class="bg-white rounded-2xl shadow-md p-10 max-w-md w-full text-center">

        @switch (state()) {
          @case ('processing') {
            <i class="pi pi-spin pi-spinner text-5xl text-primary mb-4"></i>
            <h2 class="text-xl font-semibold text-gray-700">Verifying your payment…</h2>
            <p class="text-gray-400 mt-2 text-sm">Please wait, do not close this page.</p>
          }

          @case ('success') {
            <i class="pi pi-check-circle text-5xl text-green-500 mb-4"></i>
            <h2 class="text-2xl font-bold text-gray-800">Payment Successful!</h2>
            <p class="text-gray-500 mt-2 mb-2">Your subscription has been activated.</p>
            @if (trxId()) {
              <p class="text-xs text-gray-400 font-mono">TrxID: {{ trxId() }}</p>
            }
            <p-button
              label="Go to Dashboard"
              severity="success"
              styleClass="mt-6 w-full"
              (onClick)="goToDashboard()"
            />
          }

          @case ('cancelled') {
            <i class="pi pi-times-circle text-5xl text-yellow-500 mb-4"></i>
            <h2 class="text-2xl font-bold text-gray-800">Payment Cancelled</h2>
            <p class="text-gray-500 mt-2">Your payment was cancelled. No charge was made.</p>
            <p-button
              label="View Plans"
              severity="secondary"
              styleClass="mt-6 w-full"
              (onClick)="goToPlans()"
            />
          }

          @case ('failed') {
            <i class="pi pi-exclamation-triangle text-5xl text-red-500 mb-4"></i>
            <h2 class="text-2xl font-bold text-gray-800">Payment Failed</h2>
            <p class="text-gray-500 mt-2">Something went wrong. Please try again or contact support.</p>
            <p-button
              label="Try Again"
              severity="danger"
              styleClass="mt-6 w-full"
              (onClick)="goToPlans()"
            />
          }
        }

      </div>
    </div>
  `,
})
export class PaymentCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly billing = inject(BillingService);

  readonly state = signal<CallbackState>('processing');
  readonly trxId = signal<string | null>(null);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const paymentId = params.get('paymentID') ?? params.get('payment_id') ?? '';
    const status = params.get('status') ?? 'success';

    if (!paymentId) {
      this.state.set('failed');
      return;
    }

    if (status === 'cancel' || status === 'failure') {
      // Notify API then show result
      this.billing.executePayment(paymentId, status).subscribe({
        complete: () => this.state.set(status === 'cancel' ? 'cancelled' : 'failed'),
        error: () => this.state.set(status === 'cancel' ? 'cancelled' : 'failed'),
      });
      return;
    }

    // Execute and confirm payment
    this.billing.executePayment(paymentId, 'success').subscribe({
      next: (res) => {
        this.trxId.set(res.trx_id ?? null);
        this.state.set('success');
      },
      error: () => this.state.set('failed'),
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/teacher/dashboard']);
  }

  goToPlans(): void {
    this.router.navigate(['/teacher/billing']);
  }
}
