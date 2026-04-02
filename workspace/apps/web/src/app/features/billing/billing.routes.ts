import { Routes } from '@angular/router';

export const billingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./plans/plans.component').then((m) => m.PlansComponent),
    title: 'Billing Plans - Tutor Desk',
  },
];
