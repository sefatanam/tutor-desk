// @REVIEW: Super Admin Dashboard - Connected to Real Data with Charts
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  PLATFORM_ID,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ChartModule } from 'primeng/chart';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AuthStore } from '../../../core/store/auth.store';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import {
  TeacherWithUser,
  SuperAdminDashboardStats,
  ChartData,
} from '../../../core/models';

interface StatCard {
  readonly title: string;
  readonly value: string;
  readonly icon: string;
  readonly trend?: string;
  readonly trendUp?: boolean;
  readonly color: string;
}

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    AvatarModule,
    SkeletonModule,
    TooltipModule,
    RippleModule,
    ToastModule,
    ConfirmDialogModule,
    ChartModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './dashboard.component.html',
  styles: `
    .dashboard {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    /* Header */
    .dashboard__header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .dashboard__title {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    .dashboard__subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.9rem;
      color: var(--p-text-muted-color);
    }

    /* Stats Grid */
    .dashboard__stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }

    :host ::ng-deep .dashboard__stat-card {
      .p-card-body {
        padding: 1.25rem;
      }
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .stat-card__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      border-radius: 12px;
      color: white;
      font-size: 1.35rem;
      flex-shrink: 0;
    }

    .stat-card__content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .stat-card__value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--p-text-color);
      line-height: 1.2;
    }

    .stat-card__title {
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
      margin-top: 0.125rem;
    }

    .stat-card__trend {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
    }

    .stat-card__trend--up {
      background: var(--p-green-50);
      color: var(--p-green-600);
    }

    .stat-card__trend--down {
      background: var(--p-red-50);
      color: var(--p-red-600);
    }

    /* @REVIEW: Charts Section */
    .dashboard__charts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    :host ::ng-deep .dashboard__chart-card {
      .p-card-body {
        padding: 0;
      }

      .p-card-header {
        padding: 0;
      }

      .p-card-content {
        padding: 1rem 1.25rem;
      }
    }

    .chart-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 220px;
    }

    .chart-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 180px;
    }

    .chart-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 180px;
      color: var(--p-text-muted-color);
    }

    .chart-empty i {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      opacity: 0.5;
    }

    .chart-empty p {
      margin: 0;
    }

    .mr-2 {
      margin-right: 0.5rem;
    }

    /* Main Content Grid */
    .dashboard__content {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 1.5rem;
    }

    @media (max-width: 1100px) {
      .dashboard__content {
        grid-template-columns: 1fr;
      }
    }

    /* Table Card */
    :host ::ng-deep .dashboard__table-card {
      .p-card-body {
        padding: 0;
      }

      .p-card-header {
        padding: 0;
      }
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-200);
    }

    .card-header__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--p-text-color);
    }

    /* Table Styling */
    :host ::ng-deep .p-datatable {
      .p-datatable-thead > tr > th {
        background: transparent;
        padding: 0.875rem 1rem;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--p-text-muted-color);
        text-transform: uppercase;
        letter-spacing: 0.03em;
        border-color: var(--p-surface-200);
      }

      .p-datatable-tbody > tr > td {
        padding: 0.875rem 1rem;
        border-color: var(--p-surface-200);
      }

      .p-datatable-tbody > tr:last-child > td {
        border-bottom: none;
      }
    }

    .teacher-info {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .teacher-info__text {
      display: flex;
      flex-direction: column;
    }

    .teacher-info__name {
      font-weight: 500;
      color: var(--p-text-color);
    }

    .teacher-info__email {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    .student-count {
      font-weight: 600;
      color: var(--p-text-color);
    }

    .date-text {
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
    }

    .empty-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      color: var(--p-text-muted-color);

      i {
        font-size: 2rem;
        opacity: 0.5;
      }

      p {
        margin: 0;
      }
    }

    /* Sidebar */
    .dashboard__sidebar {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    :host ::ng-deep .dashboard__sidebar-card {
      .p-card-body {
        padding: 0;
      }

      .p-card-header {
        padding: 0;
      }

      .p-card-content {
        padding: 0;
      }
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 2rem 1rem;
      text-align: center;
    }

    .empty-state__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      margin-bottom: 0.75rem;

      i {
        font-size: 1.75rem;
      }
    }

    .empty-state__icon--success {
      background: var(--p-green-50);
      color: var(--p-green-500);
    }

    .empty-state__title {
      margin: 0;
      font-weight: 500;
      color: var(--p-text-color);
    }

    .empty-state__text {
      font-size: 0.85rem;
      color: var(--p-text-muted-color);
      margin-top: 0.25rem;
    }

    /* Approval List */
    .approval-list {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .approval-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--p-surface-200);
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .approval-item:last-child {
      border-bottom: none;
    }

    .approval-item:hover {
      background: var(--p-surface-50);
    }

    .approval-item__user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .approval-item__info {
      display: flex;
      flex-direction: column;
    }

    .approval-item__name {
      font-weight: 500;
      color: var(--p-text-color);
    }

    .approval-item__email {
      font-size: 0.8rem;
      color: var(--p-text-muted-color);
    }

    .approval-item__actions {
      display: flex;
      gap: 0.5rem;
    }

    /* Quick Actions */
    .quick-actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      padding: 1rem 1.25rem;
    }

    .quick-action {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 1.25rem 1rem;
      background: var(--p-surface-50);
      border: 1px solid var(--p-surface-200);
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }

    .quick-action:hover {
      background: var(--p-surface-100);
      border-color: var(--p-primary-color);
    }

    .quick-action i {
      font-size: 1.35rem;
      color: var(--p-primary-color);
    }

    .quick-action span {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--p-text-color);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  // Loading states
  protected readonly loadingStats = signal(true);
  protected readonly loadingTeachers = signal(true);
  protected readonly loadingPending = signal(true);

  // Data signals
  protected readonly dashboardStats = signal<SuperAdminDashboardStats | null>(
    null
  );
  protected readonly recentTeachers = signal<TeacherWithUser[]>([]);
  protected readonly pendingTeachers = signal<TeacherWithUser[]>([]);

  // @REVIEW: Chart data signals
  protected readonly teacherStatusData = signal<ChartData | null>(null);
  protected readonly teacherStudentsData = signal<ChartData | null>(null);

  // @REVIEW: Chart options
  protected readonly doughnutOptions = {
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

  protected readonly barOptions = {
    indexAxis: 'y',
    maintainAspectRatio: false,
    aspectRatio: 1.5,
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

  // Computed signal for user name
  protected readonly userName = computed(
    () => this.authStore.user()?.fullName ?? 'Super Admin'
  );

  // Computed stats cards from real data
  protected readonly statsCards = computed(() => {
    const stats = this.dashboardStats();
    if (!stats) return [];

    return [
      {
        title: 'Total Teachers',
        value: stats.totalTeachers.toString(),
        icon: 'pi-users',
        color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      },
      {
        title: 'Total Students',
        value: stats.totalStudents.toLocaleString(),
        icon: 'pi-graduation-cap',
        color: 'linear-gradient(135deg, #10b981, #059669)',
      },
      {
        title: 'Active Exams',
        value: stats.totalExams.toString(),
        icon: 'pi-file-edit',
        color: 'linear-gradient(135deg, #f59e0b, #d97706)',
      },
      {
        title: 'Pending Approvals',
        value: stats.pendingTeachers.toString(),
        icon: 'pi-clock',
        color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      },
    ];
  });

  private readonly avatarColors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
  ];

  ngOnInit(): void {
    this.loadDashboardData();
  }

  private loadDashboardData(): void {
    // Load stats
    this.loadingStats.set(true);
    this.db.admin
      .getDashboardStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.dashboardStats.set(stats);
          this.loadingStats.set(false);
          // @REVIEW: Build teacher status chart after stats load
          this.buildTeacherStatusChart(stats);
        },
        error: (err) => {
          console.error('Failed to load dashboard stats:', err);
          this.loadingStats.set(false);
        },
      });

    // Load recent teachers (also used for chart)
    this.loadingTeachers.set(true);
    this.db.teachers
      .getAll({ pageSize: 10, sortBy: 'created_at', sortOrder: 'desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.recentTeachers.set(response.items.slice(0, 5));
          this.loadingTeachers.set(false);
          // @REVIEW: Build students per teacher chart
          this.buildTeacherStudentsChart(response.items);
        },
        error: (err) => {
          console.error('Failed to load recent teachers:', err);
          this.loadingTeachers.set(false);
        },
      });

    // Load pending teachers
    this.loadingPending.set(true);
    this.db.teachers
      .getPendingApprovals()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (teachers) => {
          this.pendingTeachers.set(teachers);
          this.loadingPending.set(false);
        },
        error: (err) => {
          console.error('Failed to load pending teachers:', err);
          this.loadingPending.set(false);
        },
      });
  }

  // @REVIEW: Build teacher status distribution chart
  private buildTeacherStatusChart(stats: SuperAdminDashboardStats): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.teacherStatusData.set(null);
      return;
    }

    const data: number[] = [];
    const labels: string[] = [];
    const colors: string[] = [];

    if (stats.activeTeachers > 0) {
      labels.push('Active');
      data.push(stats.activeTeachers);
      colors.push('#10b981');
    }
    if (stats.pendingTeachers > 0) {
      labels.push('Pending');
      data.push(stats.pendingTeachers);
      colors.push('#f59e0b');
    }
    if (stats.disabledTeachers > 0) {
      labels.push('Disabled');
      data.push(stats.disabledTeachers);
      colors.push('#ef4444');
    }

    if (data.length === 0) {
      this.teacherStatusData.set(null);
      return;
    }

    this.teacherStatusData.set({
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          hoverBackgroundColor: colors.map((c) => c + 'cc'),
        },
      ],
    });
  }

  // @REVIEW: Build students per teacher chart
  private buildTeacherStudentsChart(teachers: TeacherWithUser[]): void {
    if (!isPlatformBrowser(this.platformId) || teachers.length === 0) {
      this.teacherStudentsData.set(null);
      return;
    }

    // Sort by total students and take top 6
    const sortedTeachers = [...teachers]
      .sort((a, b) => b.totalStudents - a.totalStudents)
      .slice(0, 6);

    // Skip if no teachers have students
    if (sortedTeachers.every((t) => t.totalStudents === 0)) {
      this.teacherStudentsData.set(null);
      return;
    }

    this.teacherStudentsData.set({
      labels: sortedTeachers.map((t) => {
        const name = t.user.fullName;
        return name.length > 15 ? name.slice(0, 15) + '...' : name;
      }),
      datasets: [
        {
          label: 'Students',
          data: sortedTeachers.map((t) => t.totalStudents),
          backgroundColor: this.avatarColors,
          borderRadius: 4,
        },
      ],
    });
  }

  protected getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  protected getAvatarColor(id: string): string {
    const index = id.charCodeAt(0) % this.avatarColors.length;
    return this.avatarColors[index];
  }

  protected getStatusSeverity(
    status: string
  ): 'success' | 'warn' | 'danger' | 'info' | 'secondary' | 'contrast' {
    const severityMap: Record<string, 'success' | 'warn' | 'danger'> = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
    };
    return severityMap[status] ?? 'secondary';
  }

  protected confirmApprove(teacher: TeacherWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to approve ${teacher.user.fullName}?`,
      header: 'Approve Teacher',
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => this.approveTeacher(teacher),
    });
  }

  protected confirmReject(teacher: TeacherWithUser): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to reject ${teacher.user.fullName}?`,
      header: 'Reject Teacher',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.rejectTeacher(teacher),
    });
  }

  private approveTeacher(teacher: TeacherWithUser): void {
    const adminId = this.authStore.user()?.id;
    if (!adminId) return;

    this.db.teachers
      .approve(teacher.id, adminId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `${teacher.user.fullName} has been approved`,
          });
          this.loadDashboardData();
        },
        error: (err) => {
          console.error('Failed to approve teacher:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to approve teacher',
          });
        },
      });
  }

  private rejectTeacher(teacher: TeacherWithUser): void {
    this.db.users
      .updateStatus(teacher.user.id, 'disabled')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: `${teacher.user.fullName} has been rejected`,
          });
          this.loadDashboardData();
        },
        error: (err) => {
          console.error('Failed to reject teacher:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to reject teacher',
          });
        },
      });
  }
}
