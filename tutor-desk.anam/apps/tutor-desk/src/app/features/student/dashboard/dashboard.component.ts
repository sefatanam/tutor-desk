// @REVIEW: Student Dashboard - Placeholder
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'app-student-dashboard',
  imports: [CardModule, ButtonModule, TableModule],
  template: `
    <div class="dashboard">
      <div class="dashboard__header">
        <h1>Student Dashboard</h1>
        <p>Welcome back! Here's your learning overview.</p>
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

      <!-- Upcoming Exams -->
      <p-card styleClass="dashboard__card">
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>Upcoming Exams</h2>
            <button pButton label="View All" icon="pi pi-arrow-right" iconPos="right" class="p-button-text"></button>
          </div>
        </ng-template>

        <p-table [value]="upcomingExams" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template pTemplate="header">
            <tr>
              <th>Exam Title</th>
              <th>Subject</th>
              <th>Date</th>
              <th>Duration</th>
              <th>Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-exam>
            <tr>
              <td>{{ exam.title }}</td>
              <td>{{ exam.subject }}</td>
              <td>{{ exam.date }}</td>
              <td>{{ exam.duration }} min</td>
              <td>
                <button pButton label="Take Exam" icon="pi pi-play" class="p-button-sm"></button>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </p-card>

      <!-- Recent Results -->
      <p-card styleClass="dashboard__card">
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>Recent Results</h2>
            <button pButton label="View All" icon="pi pi-arrow-right" iconPos="right" class="p-button-text"></button>
          </div>
        </ng-template>

        <p-table [value]="recentResults" [tableStyle]="{ 'min-width': '50rem' }">
          <ng-template pTemplate="header">
            <tr>
              <th>Exam Title</th>
              <th>Subject</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-result>
            <tr>
              <td>{{ result.title }}</td>
              <td>{{ result.subject }}</td>
              <td>
                <span class="score" [class.score--high]="result.score >= 80" [class.score--medium]="result.score >= 60 && result.score < 80" [class.score--low]="result.score < 60">
                  {{ result.score }}%
                </span>
              </td>
              <td>
                <span class="status-badge" [class]="'status-badge--' + result.status">
                  {{ result.status }}
                </span>
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

    .score {
      font-weight: 600;
    }

    .score--high { color: var(--green-600); }
    .score--medium { color: var(--yellow-600); }
    .score--low { color: var(--red-600); }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: capitalize;
    }

    .status-badge--passed {
      background: var(--green-100);
      color: var(--green-700);
    }

    .status-badge--failed {
      background: var(--red-100);
      color: var(--red-700);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly stats = [
    { icon: 'pi-book', label: 'Enrolled Subjects', value: '6', color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    { icon: 'pi-file-edit', label: 'Pending Exams', value: '3', color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { icon: 'pi-check-circle', label: 'Completed', value: '18', color: 'linear-gradient(135deg, #10b981, #059669)' },
    { icon: 'pi-chart-line', label: 'Avg Score', value: '85%', color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
  ];

  readonly upcomingExams = [
    { title: 'Mathematics Mid-Term', subject: 'Mathematics', date: 'Jan 15, 2026', duration: 60 },
    { title: 'Physics Quiz 4', subject: 'Physics', date: 'Jan 18, 2026', duration: 30 },
    { title: 'Chemistry Final', subject: 'Chemistry', date: 'Jan 22, 2026', duration: 90 },
  ];

  readonly recentResults = [
    { title: 'Mathematics Quiz 3', subject: 'Mathematics', score: 92, status: 'passed' },
    { title: 'Physics Mid-Term', subject: 'Physics', score: 78, status: 'passed' },
    { title: 'Biology Assessment', subject: 'Biology', score: 55, status: 'failed' },
    { title: 'Chemistry Quiz 2', subject: 'Chemistry', score: 88, status: 'passed' },
  ];
}
