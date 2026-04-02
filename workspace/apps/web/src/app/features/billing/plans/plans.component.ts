import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { BillingService, BillingPlan } from '../../../core/services/billing.service';

@Component({
  selector: 'app-billing-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, CardModule, ButtonModule, TagModule, SkeletonModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="p-6 max-w-5xl mx-auto">
      <div class="text-center mb-10">
        <h1 class="text-3xl font-bold text-gray-800 mb-2">Choose Your Plan</h1>
        <p class="text-gray-500">Simple, transparent pricing in BDT. Upgrade or downgrade anytime.</p>
      </div>

      @if (loading()) {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          @for (_ of [1,2,3]; track $index) {
            <p-skeleton height="400px" />
          }
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          @for (plan of plans(); track plan.id) {
            <div
              class="rounded-2xl border p-6 flex flex-col gap-4 transition-shadow hover:shadow-lg"
              [class.border-primary]="plan.name === 'pro'"
              [class.border-gray-200]="plan.name !== 'pro'"
              [class.ring-2]="plan.name === 'pro'"
              [class.ring-primary]="plan.name === 'pro'"
            >
              @if (plan.name === 'pro') {
                <p-tag value="Most Popular" severity="success" class="self-start" />
              }
              <div>
                <h2 class="text-xl font-bold text-gray-800">{{ plan.display_name }}</h2>
                <div class="mt-2 flex items-end gap-1">
                  @if (plan.price_bdt === 0) {
                    <span class="text-4xl font-extrabold text-gray-900">Free</span>
                  } @else {
                    <span class="text-4xl font-extrabold text-gray-900">৳{{ plan.price_bdt }}</span>
                    <span class="text-gray-400 mb-1">/month</span>
                  }
                </div>
              </div>

              <ul class="space-y-2 text-sm text-gray-600 flex-1">
                <li class="flex items-center gap-2">
                  <i class="pi pi-check-circle text-green-500"></i>
                  {{ plan.max_subjects === null ? 'Unlimited subjects' : plan.max_subjects + ' subject' + (plan.max_subjects > 1 ? 's' : '') }}
                </li>
                <li class="flex items-center gap-2">
                  <i class="pi pi-check-circle text-green-500"></i>
                  {{ plan.max_exams === null ? 'Unlimited exams' : plan.max_exams + ' exams/month' }}
                </li>
                <li class="flex items-center gap-2">
                  <i class="pi pi-check-circle text-green-500"></i>
                  {{ plan.max_students === null ? 'Unlimited students' : 'Up to ' + plan.max_students + ' students' }}
                </li>
                <li class="flex items-center gap-2" [class.text-gray-400]="!plan.can_export">
                  <i class="pi" [class.pi-check-circle]="plan.can_export" [class.pi-times-circle]="!plan.can_export"
                     [class.text-green-500]="plan.can_export" [class.text-gray-300]="!plan.can_export"></i>
                  PDF &amp; CSV export
                </li>
                @if (plan.seat_count > 1) {
                  <li class="flex items-center gap-2">
                    <i class="pi pi-check-circle text-green-500"></i>
                    {{ plan.seat_count }} teacher seats
                  </li>
                }
              </ul>

              <p-button
                [label]="plan.price_bdt === 0 ? 'Get Started Free' : 'Subscribe with bKash'"
                [severity]="plan.name === 'pro' ? 'success' : 'secondary'"
                [loading]="processingPlanId() === plan.id"
                styleClass="w-full"
                (onClick)="selectPlan(plan)"
              />
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PlansComponent implements OnInit {
  private readonly billing = inject(BillingService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly plans = signal<BillingPlan[]>([]);
  readonly loading = signal(true);
  readonly processingPlanId = signal<number | null>(null);

  ngOnInit(): void {
    this.billing.getPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load plans' });
      },
    });
  }

  selectPlan(plan: BillingPlan): void {
    this.processingPlanId.set(plan.id);

    this.billing.createPayment(plan.id).subscribe({
      next: (res) => {
        this.processingPlanId.set(null);

        if (res.status === 'activated') {
          // Free plan — go straight to dashboard
          this.messageService.add({ severity: 'success', summary: 'Activated', detail: 'Starter plan activated!' });
          setTimeout(() => this.router.navigate(['/teacher/dashboard']), 1500);
          return;
        }

        // Redirect to bKash hosted checkout
        window.location.href = res.bkash_url;
      },
      error: () => {
        this.processingPlanId.set(null);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not initiate payment. Try again.' });
      },
    });
  }
}
