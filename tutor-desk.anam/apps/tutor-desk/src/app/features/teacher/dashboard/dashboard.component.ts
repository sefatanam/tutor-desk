// @REVIEW: Teacher Dashboard - Connected to real Supabase data with Charts
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, PLATFORM_ID, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { AuthStore } from '../../../core/store/auth.store';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { TeacherDashboardStats, ExamWithSubject, Subject, ChartData } from '../../../core/models';

// @REVIEW: Teacher Dashboard - Connected to real Supabase data
@Component({
  selector: 'app-teacher-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
    ToastModule,
    ChartModule,
  ],
  providers: [MessageService],
  template: `
    <div class="dashboard">
      <div class="dashboard__header">
        <div>
          <h1>Teacher Dashboard</h1>
          <p>Welcome back, {{ userName() }}! Here's your overview.</p>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="dashboard__stats">
        @if (loadingStats()) {
          @for (i of [1, 2, 3, 4]; track i) {
            <p-card styleClass="stat-card">
              <div class="stat-card__content">
                <p-skeleton shape="circle" size="56px" />
                <div class="stat-card__info">
                  <p-skeleton width="50px" height="24px" />
                  <p-skeleton width="80px" height="14px" />
                </div>
              </div>
            </p-card>
          }
        } @else {
          @for (stat of statsCards(); track stat.label) {
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
          <button pButton label="Create Exam" icon="pi pi-plus" class="p-button-lg" routerLink="/teacher/exams/create"></button>
          <button pButton label="Add Student" icon="pi pi-user-plus" class="p-button-lg p-button-outlined" routerLink="/teacher/students"></button>
          <button pButton label="New Subject" icon="pi pi-book" class="p-button-lg p-button-outlined" routerLink="/teacher/subjects"></button>
        </div>
      </p-card>

      <!-- @REVIEW: Analytics Charts Section -->
      <div class="dashboard__charts">
        <!-- Exam Status Chart -->
        <p-card styleClass="dashboard__card chart-card">
          <ng-template pTemplate="header">
            <div class="card-header">
              <h2><i class="pi pi-chart-pie mr-2"></i>Exam Status Distribution</h2>
            </div>
          </ng-template>

          @if (loadingCharts()) {
            <div class="chart-loading">
              <p-skeleton shape="circle" size="200px" />
            </div>
          } @else if (examStatusData()) {
            <div class="chart-container">
              <p-chart type="doughnut" [data]="examStatusData()!" [options]="doughnutOptions" />
            </div>
          } @else {
            <div class="chart-empty">
              <i class="pi pi-chart-pie"></i>
              <p>No exam data available</p>
            </div>
          }
        </p-card>

        <!-- Subject Performance Chart -->
        <p-card styleClass="dashboard__card chart-card">
          <ng-template pTemplate="header">
            <div class="card-header">
              <h2><i class="pi pi-chart-bar mr-2"></i>Students per Subject</h2>
            </div>
          </ng-template>

          @if (loadingCharts()) {
            <div class="chart-loading">
              <p-skeleton width="100%" height="200px" />
            </div>
          } @else if (subjectStudentsData()) {
            <div class="chart-container">
              <p-chart type="bar" [data]="subjectStudentsData()!" [options]="barOptions" />
            </div>
          } @else {
            <div class="chart-empty">
              <i class="pi pi-chart-bar"></i>
              <p>No subject data available</p>
            </div>
          }
        </p-card>
      </div>

      <!-- Recent Exams -->
      <p-card styleClass="dashboard__card">
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>Recent Exams</h2>
            <button pButton label="View All" icon="pi pi-arrow-right" iconPos="right" class="p-button-text" routerLink="/teacher/exams"></button>
          </div>
        </ng-template>

        @if (loadingExams()) {
          <div class="skeleton-table">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="skeleton-row">
                <p-skeleton width="200px" height="16px" />
                <p-skeleton width="100px" height="16px" />
                <p-skeleton width="50px" height="16px" />
                <p-skeleton width="80px" height="24px" borderRadius="16px" />
                <p-skeleton width="60px" height="32px" />
              </div>
            }
          </div>
        } @else if (recentExams().length === 0) {
          <div class="empty-state">
            <i class="pi pi-file-edit empty-state__icon"></i>
            <p class="empty-state__text">No exams yet</p>
            <button pButton label="Create Your First Exam" icon="pi pi-plus" class="p-button-outlined" routerLink="/teacher/exams/create"></button>
          </div>
        } @else {
          <p-table [value]="recentExams()" [tableStyle]="{ 'min-width': '50rem' }" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Exam Title</th>
                <th>Subject</th>
                <th class="text-center">Questions</th>
                <th>Status</th>
                <th style="width: 100px">Actions</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-exam>
              <tr>
                <td>
                  <span class="exam-title">{{ exam.title }}</span>
                </td>
                <td>
                  <span class="subject-name" [style.color]="exam.subject.color">
                    <i [class]="'pi ' + exam.subject.icon" style="margin-right: 0.5rem"></i>
                    {{ exam.subject.name }}
                  </span>
                </td>
                <td class="text-center">{{ exam.totalQuestions }}</td>
                <td>
                  <p-tag [value]="exam.status" [severity]="getStatusSeverity(exam.status)" />
                </td>
                <td>
                  <button pButton icon="pi pi-eye" class="p-button-rounded p-button-text p-button-sm" [routerLink]="['/teacher/exams', exam.id, 'results']" pTooltip="View Results"></button>
                  <button pButton icon="pi pi-pencil" class="p-button-rounded p-button-text p-button-sm" [routerLink]="['/teacher/exams', exam.id, 'edit']" pTooltip="Edit"></button>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>
    </div>
    <p-toast />
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

    .exam-title {
      font-weight: 500;
    }

    .subject-name {
      display: flex;
      align-items: center;
      font-weight: 500;
    }

    .text-center {
      text-align: center;
    }

    .skeleton-table {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 2rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--surface-border);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
    }

    .empty-state__icon {
      font-size: 3rem;
      color: var(--text-color-secondary);
      margin-bottom: 1rem;
    }

    .empty-state__text {
      color: var(--text-color-secondary);
      margin-bottom: 1.5rem;
    }

    /* @REVIEW: Charts Section Styles */
    .dashboard__charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    :host ::ng-deep .chart-card .p-card-body {
      padding: 1rem 1.5rem;
    }

    .chart-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 250px;
    }

    .chart-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
    }

    .chart-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      color: var(--text-color-secondary);
    }

    .chart-empty i {
      font-size: 3rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }

    .chart-empty p {
      margin: 0;
    }

    .mr-2 {
      margin-right: 0.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly messageService = inject(MessageService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  // State signals
  readonly loadingStats = signal(true);
  readonly loadingExams = signal(true);
  readonly loadingCharts = signal(true);
  readonly dashboardStats = signal<TeacherDashboardStats | null>(null);
  readonly recentExams = signal<ExamWithSubject[]>([]);
  readonly subjects = signal<Subject[]>([]);

  // @REVIEW: Chart data signals
  readonly examStatusData = signal<ChartData | null>(null);
  readonly subjectStudentsData = signal<ChartData | null>(null);

  // Chart options
  readonly doughnutOptions = {
    cutout: '60%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
        },
      },
    },
  };

  readonly barOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    aspectRatio: 1.2,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // Computed
  readonly userName = computed(() => this.authStore.user()?.fullName ?? 'Teacher');
  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly statsCards = computed(() => {
    const stats = this.dashboardStats();
    if (!stats) return [];
    
    return [
      { 
        icon: 'pi-users', 
        label: 'My Students', 
        value: stats.totalStudents.toString(), 
        color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' 
      },
      { 
        icon: 'pi-book', 
        label: 'Subjects', 
        value: stats.totalSubjects.toString(), 
        color: 'linear-gradient(135deg, #10b981, #059669)' 
      },
      { 
        icon: 'pi-file-edit', 
        label: 'Active Exams', 
        value: stats.activeExams.toString(), 
        color: 'linear-gradient(135deg, #f59e0b, #d97706)' 
      },
      { 
        icon: 'pi-check-circle', 
        label: 'Avg Score', 
        value: `${Math.round(stats.averageStudentScore)}%`, 
        color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' 
      },
    ];
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    const teacherId = this.teacherId();
    
    if (!teacherId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Teacher profile not found. Please contact support.',
      });
      this.loadingStats.set(false);
      this.loadingExams.set(false);
      this.loadingCharts.set(false);
      return;
    }

    // Load dashboard stats
    this.db.teachers.getDashboardStats(teacherId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (stats) => {
        this.dashboardStats.set(stats);
        this.loadingStats.set(false);
      },
      error: (err) => {
        console.error('Failed to load dashboard stats:', err);
        this.loadingStats.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load dashboard statistics.',
        });
      },
    });

    // Load recent exams and all exams for chart
    this.db.exams.getByTeacher(teacherId, { page: 1, pageSize: 100 }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.recentExams.set(response.items.slice(0, 5));
        this.loadingExams.set(false);
        // @REVIEW: Build exam status chart data
        this.buildExamStatusChart(response.items);
      },
      error: (err) => {
        console.error('Failed to load recent exams:', err);
        this.loadingExams.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load recent exams.',
        });
      },
    });

    // @REVIEW: Load subjects for chart
    this.db.subjects.getByTeacher(teacherId, { page: 1, pageSize: 50 }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.subjects.set(response.items);
        this.buildSubjectStudentsChart(response.items);
        this.loadingCharts.set(false);
      },
      error: (err) => {
        console.error('Failed to load subjects:', err);
        this.loadingCharts.set(false);
      },
    });
  }

  // @REVIEW: Build exam status distribution chart
  private buildExamStatusChart(exams: ExamWithSubject[]): void {
    if (!isPlatformBrowser(this.platformId) || exams.length === 0) {
      this.examStatusData.set(null);
      return;
    }

    const statusCounts: Record<string, number> = {
      draft: 0,
      scheduled: 0,
      active: 0,
      completed: 0,
      cancelled: 0,
    };

    exams.forEach(exam => {
      if (statusCounts[exam.status] !== undefined) {
        statusCounts[exam.status]++;
      }
    });

    // Filter out zero values
    const labels: string[] = [];
    const data: number[] = [];
    const colors: string[] = [];

    const colorMap: Record<string, string> = {
      draft: '#6b7280',
      scheduled: '#3b82f6',
      active: '#10b981',
      completed: '#f59e0b',
      cancelled: '#ef4444',
    };

    Object.entries(statusCounts).forEach(([status, count]) => {
      if (count > 0) {
        labels.push(status.charAt(0).toUpperCase() + status.slice(1));
        data.push(count);
        colors.push(colorMap[status]);
      }
    });

    if (data.length === 0) {
      this.examStatusData.set(null);
      return;
    }

    this.examStatusData.set({
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          hoverBackgroundColor: colors.map(c => c + 'cc'),
        },
      ],
    });
  }

  // @REVIEW: Build students per subject chart
  private buildSubjectStudentsChart(subjectsList: Subject[]): void {
    if (!isPlatformBrowser(this.platformId) || subjectsList.length === 0) {
      this.subjectStudentsData.set(null);
      return;
    }

    const sortedSubjects = [...subjectsList]
      .sort((a, b) => b.totalStudents - a.totalStudents)
      .slice(0, 6); // Top 6 subjects

    this.subjectStudentsData.set({
      labels: sortedSubjects.map(s => s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name),
      datasets: [
        {
          label: 'Students',
          data: sortedSubjects.map(s => s.totalStudents),
          backgroundColor: sortedSubjects.map(s => s.color || '#3b82f6'),
          borderRadius: 4,
        },
      ],
    });
  }

  getStatusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    const severityMap: Record<string, 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast'> = {
      draft: 'secondary',
      active: 'success',
      published: 'success',
      closed: 'info',
      cancelled: 'danger',
    };
    return severityMap[status] ?? 'secondary';
  }
}
