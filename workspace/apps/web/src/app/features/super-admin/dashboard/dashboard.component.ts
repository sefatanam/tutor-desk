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
        color: 'td-gradient-info',
      },
      {
        title: 'Total Students',
        value: stats.totalStudents.toLocaleString(),
        icon: 'pi-graduation-cap',
        color: 'td-gradient-success',
      },
      {
        title: 'Active Exams',
        value: stats.totalExams.toString(),
        icon: 'pi-file-edit',
        color: 'td-gradient-warning',
      },
      {
        title: 'Pending Approvals',
        value: stats.pendingTeachers.toString(),
        icon: 'pi-clock',
        color: 'td-gradient-accent',
      },
    ];
  });

  private readonly avatarToneClasses = [
    'td-tone-info',
    'td-tone-success',
    'td-tone-warning',
    'td-tone-accent',
    'td-tone-accent',
    'td-tone-info',
  ];

  private readonly teacherChartColors = [
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
      colors.push('td-tone-success');
    }
    if (stats.pendingTeachers > 0) {
      labels.push('Pending');
      data.push(stats.pendingTeachers);
      colors.push('td-tone-warning');
    }
    if (stats.disabledTeachers > 0) {
      labels.push('Disabled');
      data.push(stats.disabledTeachers);
      colors.push('td-tone-danger');
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
          backgroundColor: this.teacherChartColors,
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
    const index = id.charCodeAt(0) % this.avatarToneClasses.length;
    return this.avatarToneClasses[index];
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
