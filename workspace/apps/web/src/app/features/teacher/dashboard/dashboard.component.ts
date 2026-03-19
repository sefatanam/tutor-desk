// @REVIEW: Teacher Dashboard - Connected to real Supabase data with Charts
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
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
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { AuthStore } from '../../../core/store/auth.store';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { getThemeTextToneClass } from '../../../core/utils/theme-tone.util';

import {
  TeacherDashboardStats,
  ExamWithSubject,
  Subject,
  ChartData,
} from '../../../core/models';

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
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  readonly getThemeTextToneClass = getThemeTextToneClass;
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
  readonly userName = computed(
    () => this.authStore.user()?.fullName ?? 'Teacher'
  );
  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly statsCards = computed(() => {
    const stats = this.dashboardStats();
    if (!stats) return [];

    return [
      {
        icon: 'pi-users',
        label: 'My Students',
        value: stats.totalStudents.toString(),
        color: 'td-gradient-info',
      },
      {
        icon: 'pi-book',
        label: 'Subjects',
        value: stats.totalSubjects.toString(),
        color: 'td-gradient-success',
      },
      {
        icon: 'pi-file-edit',
        label: 'Active Exams',
        value: stats.activeExams.toString(),
        color: 'td-gradient-warning',
      },
      {
        icon: 'pi-check-circle',
        label: 'Avg Score',
        value: `${Math.round(stats.averageStudentScore)}%`,
        color: 'td-gradient-accent',
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
    this.db.teachers
      .getDashboardStats(teacherId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    this.db.exams
      .getByTeacher(teacherId, { page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    this.db.subjects
      .getByTeacher(teacherId, { page: 1, pageSize: 50 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

    exams.forEach((exam) => {
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
          hoverBackgroundColor: colors.map((c) => c + 'cc'),
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
      labels: sortedSubjects.map((s) =>
        s.name.length > 15 ? s.name.slice(0, 15) + '...' : s.name
      ),
      datasets: [
        {
          label: 'Students',
          data: sortedSubjects.map((s) => s.totalStudents),
          backgroundColor: sortedSubjects.map((s) => s.color || '#3b82f6'),
          borderRadius: 4,
        },
      ],
    });
  }

  getStatusSeverity(
    status: string
  ): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' {
    const severityMap: Record<
      string,
      'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast'
    > = {
      draft: 'secondary',
      active: 'success',
      published: 'success',
      closed: 'info',
      cancelled: 'danger',
    };
    return severityMap[status] ?? 'secondary';
  }
}
