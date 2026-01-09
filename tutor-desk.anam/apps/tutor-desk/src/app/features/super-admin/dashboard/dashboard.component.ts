// @REVIEW: Super Admin Dashboard - Placeholder
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CardModule, ButtonModule, ChartModule, TableModule],
  template: `
    <div class="dashboard">
      <div class="dashboard__header">
        <h1>Admin Dashboard</h1>
        <p>Welcome back, Super Admin</p>
      </div>

      <!-- Stats Cards -->
      <div class="dashboard__stats">
        @for (stat of stats; track stat.label) {
          <p-card styleClass="stat-card">
            <div class="stat-card__content">
              <div class="stat-card__icon" [style.background]="stat.color">
                <i [class]="'pi ' + stat.icon"></i>
              </div>
              <div class="stat-card__info">
                <span class="stat-card__value">{{ stat.value }}</span>
                <span class="stat-card__label">{{ stat.label }}</span>
              </div>
            </div>
          </p-card>
        }
      </div>

      <!-- Recent Teachers -->
      <p-card styleClass="dashboard__card">
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>Recent Teachers</h2>
            <button pButton label="View All" icon="pi pi-arrow-right" iconPos="right" class="p-button-text"></button>
          </div>
        </ng-template>

        <p-table [value]="recentTeachers" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template pTemplate="header">
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Students</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-teacher>
            <tr>
              <td>{{ teacher.name }}</td>
              <td>{{ teacher.email }}</td>
              <td>{{ teacher.students }}</td>
              <td>
                <span class="status-badge" [class]="'status-badge--' + teacher.status">
                  {{ teacher.status }}
                </span>
              </td>
              <td>
                <button pButton icon="pi pi-eye" class="p-button-rounded p-button-text"></button>
                <button pButton icon="pi pi-pencil" class="p-button-rounded p-button-text"></button>
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="5" class="text-center p-4">No teachers found</td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>
    </div>
  `,
  styles: `
    .dashboard {
      padding: 1.5rem;
    }

    .dashboard__header {
      margin-bottom: 2rem;
    }

    .dashboard__header h1 {
      margin: 0 0 0.5rem;
      font-size: 1.75rem;
      font-weight: 600;
    }

    .dashboard__header p {
      margin: 0;
      color: var(--text-color-secondary);
    }

    .dashboard__stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    :host ::ng-deep .stat-card .p-card-body {
      padding: 1.25rem;
    }

    .stat-card__content {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .stat-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 12px;
      color: white;
      font-size: 1.5rem;
    }

    .stat-card__info {
      display: flex;
      flex-direction: column;
    }

    .stat-card__value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-color);
    }

    .stat-card__label {
      font-size: 0.875rem;
      color: var(--text-color-secondary);
    }

    :host ::ng-deep .dashboard__card {
      margin-bottom: 1.5rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--surface-border);
    }

    .card-header h2 {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 600;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: capitalize;
    }

    .status-badge--active {
      background: var(--green-100);
      color: var(--green-700);
    }

    .status-badge--pending {
      background: var(--yellow-100);
      color: var(--yellow-700);
    }

    .status-badge--inactive {
      background: var(--red-100);
      color: var(--red-700);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly stats = [
    { icon: 'pi-users', label: 'Total Teachers', value: '24', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    { icon: 'pi-user', label: 'Total Students', value: '1,248', color: 'linear-gradient(135deg, #10b981, #059669)' },
    { icon: 'pi-file-edit', label: 'Active Exams', value: '56', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { icon: 'pi-chart-line', label: 'Completion Rate', value: '94%', color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  ];

  readonly recentTeachers = [
    { name: 'John Doe', email: 'john@example.com', students: 45, status: 'active' },
    { name: 'Jane Smith', email: 'jane@example.com', students: 32, status: 'active' },
    { name: 'Bob Wilson', email: 'bob@example.com', students: 28, status: 'pending' },
    { name: 'Alice Brown', email: 'alice@example.com', students: 51, status: 'active' },
  ];
}
