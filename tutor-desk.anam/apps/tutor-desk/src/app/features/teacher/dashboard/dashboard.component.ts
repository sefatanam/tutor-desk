// @REVIEW: Teacher Dashboard - Placeholder
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-teacher-dashboard',
  imports: [CardModule, ButtonModule, TableModule],
  template: `
    <div class="dashboard">
      <div class="dashboard__header">
        <h1>Teacher Dashboard</h1>
        <p>Welcome back! Here's your overview.</p>
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

      <!-- Quick Actions -->
      <p-card styleClass="dashboard__card">
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>Quick Actions</h2>
          </div>
        </ng-template>

        <div class="quick-actions">
          <button pButton label="Create Exam" icon="pi pi-plus" class="p-button-lg"></button>
          <button pButton label="Add Student" icon="pi pi-user-plus" class="p-button-lg p-button-outlined"></button>
          <button pButton label="New Subject" icon="pi pi-book" class="p-button-lg p-button-outlined"></button>
        </div>
      </p-card>

      <!-- Recent Exams -->
      <p-card styleClass="dashboard__card">
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>Recent Exams</h2>
            <button pButton label="View All" icon="pi pi-arrow-right" iconPos="right" class="p-button-text"></button>
          </div>
        </ng-template>

        <p-table [value]="recentExams" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template pTemplate="header">
            <tr>
              <th>Exam Title</th>
              <th>Subject</th>
              <th>Questions</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-exam>
            <tr>
              <td>{{ exam.title }}</td>
              <td>{{ exam.subject }}</td>
              <td>{{ exam.questions }}</td>
              <td>
                <span class="status-badge" [class]="'status-badge--' + exam.status">
                  {{ exam.status }}
                </span>
              </td>
              <td>
                <button pButton icon="pi pi-eye" class="p-button-rounded p-button-text"></button>
                <button pButton icon="pi pi-pencil" class="p-button-rounded p-button-text"></button>
              </td>
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

    .quick-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: capitalize;
    }

    .status-badge--published {
      background: var(--green-100);
      color: var(--green-700);
    }

    .status-badge--draft {
      background: var(--yellow-100);
      color: var(--yellow-700);
    }

    .status-badge--closed {
      background: var(--red-100);
      color: var(--red-700);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly stats = [
    { icon: 'pi-users', label: 'My Students', value: '45', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    { icon: 'pi-book', label: 'Subjects', value: '8', color: 'linear-gradient(135deg, #10b981, #059669)' },
    { icon: 'pi-file-edit', label: 'Active Exams', value: '12', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { icon: 'pi-check-circle', label: 'Avg Score', value: '82%', color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  ];

  readonly recentExams = [
    { title: 'Mathematics Mid-Term', subject: 'Mathematics', questions: 25, status: 'published' },
    { title: 'Physics Quiz 3', subject: 'Physics', questions: 15, status: 'draft' },
    { title: 'Chemistry Final', subject: 'Chemistry', questions: 40, status: 'published' },
    { title: 'Biology Assessment', subject: 'Biology', questions: 20, status: 'closed' },
  ];
}
