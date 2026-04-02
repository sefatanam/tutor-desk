import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BillingPlan {
  id: number;
  name: string;
  display_name: string;
  price_bdt: number;
  max_subjects: number | null;
  max_exams: number | null;
  max_students: number | null;
  can_export: boolean;
  seat_count: number;
  active: boolean;
}

export interface Subscription {
  id: string;
  teacher_id: string;
  plan_id: number;
  plan: BillingPlan;
  status: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
}

export interface CreatePaymentResponse {
  payment_id: string;
  bkash_url: string;
  // for free plan
  status?: string;
  plan?: string;
}

export interface ExecutePaymentResponse {
  status: string;
  trx_id?: string;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBaseUrl;

  getPlans(): Observable<BillingPlan[]> {
    return this.http.get<BillingPlan[]>(`${this.api}/billing/plans`);
  }

  getMySubscription(): Observable<Subscription | { status: string; plan: string }> {
    return this.http.get<Subscription | { status: string; plan: string }>(`${this.api}/subscriptions/me`);
  }

  createPayment(planId: number): Observable<CreatePaymentResponse> {
    return this.http.post<CreatePaymentResponse>(`${this.api}/payments/create`, { plan_id: planId });
  }

  executePayment(paymentId: string, status: string): Observable<ExecutePaymentResponse> {
    return this.http.post<ExecutePaymentResponse>(`${this.api}/payments/execute`, {
      payment_id: paymentId,
      status,
    });
  }
}
