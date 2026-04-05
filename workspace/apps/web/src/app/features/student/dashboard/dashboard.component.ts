// @REVIEW: Student Dashboard - Real data from database
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin, of, switchMap } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

import {
  ExamWithSubject,
  ExamSubmission,
  StudentDashboardStats,
} from '../../../core/models';

// @REVIEW: Upcoming exam card data - Updated to track submission status for proper button display
interface UpcomingExam {
  readonly exam: ExamWithSubject;
  readonly status:
    | 'not_started'
    | 'in_progress'
    | 'completed'
    | 'retake_allowed';
}

// @REVIEW: Recent result card data
interface RecentResult {
  readonly submission: ExamSubmission;
  readonly examTitle: string;
  readonly subjectName: string;
  readonly subjectColor: string;
  readonly totalMarks: number;
  readonly passingMarks: number;
  readonly passed: boolean;
}

@Component({
  selector: 'app-student-dashboard',
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    SkeletonModule,
  ],
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loadingStats = signal(true);
  readonly loadingExams = signal(true);
  readonly loadingResults = signal(true);
  readonly stats = signal<StudentDashboardStats | null>(null);
  readonly upcomingExams = signal<UpcomingExam[]>([]);
  readonly recentResults = signal<RecentResult[]>([]);

  // Computed
  readonly userName = computed(
    () => this.authStore.user()?.fullName?.split(' ')[0] ?? 'Student'
  );

  readonly statsCards = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      {
        icon: 'pi-book',
        label: 'Enrolled Subjects',
        value: s.enrolledSubjects.toString(),
        color: 'td-gradient-info',
      },
      {
        icon: 'pi-file-edit',
        label: 'Pending Exams',
        value: s.pendingExams.toString(),
        color: 'td-gradient-warning',
      },
      {
        icon: 'pi-check-circle',
        label: 'Completed',
        value: s.totalExamsTaken.toString(),
        color: 'td-gradient-success',
      },
      {
        icon: 'pi-chart-line',
        label: 'Avg Score',
        value: `${Math.round(s.averageScore)}%`,
        color: 'td-gradient-accent',
      },
    ];
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  // @REVIEW: Load all dashboard data in parallel
  private loadDashboardData(): void {
    const studentId = this.authStore.studentId();
    if (!studentId) {
      this.loadingStats.set(false);
      this.loadingExams.set(false);
      this.loadingResults.set(false);
      return;
    }

    // Load stats
    this.db.students
      .getDashboardStats(studentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => {
          this.stats.set(stats);
          this.loadingStats.set(false);
        },
        error: () => {
          this.stats.set({
            enrolledSubjects: 0,
            totalExamsTaken: 0,
            averageScore: 0,
            pendingExams: 0,
          });
          this.loadingStats.set(false);
        },
      });

    // @REVIEW: Load upcoming exams with submission status check - Fixed to filter out completed exams
    forkJoin({
      exams: this.db.exams.getUpcomingForStudent(studentId),
      submissions: this.db.submissions.getByStudent(studentId, {
        page: 1,
        pageSize: 100,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ exams, submissions }) => {
          // @REVIEW: Build submission status map - tracks latest status for each exam
          const submissionStatusMap = new Map<string, UpcomingExam['status']>();

          for (const sub of submissions.items) {
            const currentStatus = submissionStatusMap.get(sub.examId);

            // Map submission status to our UpcomingExam status
            if (sub.status === 'in_progress') {
              submissionStatusMap.set(sub.examId, 'in_progress');
            } else if (sub.status === 'retake_allowed') {
              // Retake allowed takes precedence over completed
              submissionStatusMap.set(sub.examId, 'retake_allowed');
            } else if (
              (sub.status === 'submitted' ||
                sub.status === 'auto_submitted' ||
                sub.status === 'evaluated') &&
              currentStatus !== 'in_progress' &&
              currentStatus !== 'retake_allowed'
            ) {
              // Only set completed if not already in_progress or retake_allowed
              submissionStatusMap.set(sub.examId, 'completed');
            }
          }

          // @REVIEW: Filter out completed exams (unless retake_allowed or in_progress)
          const upcomingItems: UpcomingExam[] = exams
            .map((exam) => {
              const status = submissionStatusMap.get(exam.id) ?? 'not_started';
              return { exam, status };
            })
            .filter((item) => item.status !== 'completed') // Hide completed exams from upcoming
            .slice(0, 5);

          this.upcomingExams.set(upcomingItems);
          this.loadingExams.set(false);
        },
        error: () => {
          this.upcomingExams.set([]);
          this.loadingExams.set(false);
        },
      });

    // Load recent results
    this.db.submissions
      .getByStudent(studentId, { page: 1, pageSize: 10 })
      .pipe(
        switchMap((response) => {
          const completed = response.items
            .filter(
              (s) =>
                s.status === 'submitted' ||
                s.status === 'auto_submitted' ||
                s.status === 'evaluated'
            )
            .slice(0, 5);

          if (completed.length === 0) return of([]);

          const requests = completed.map((sub) =>
            this.db.exams.getById(sub.examId).pipe(
              switchMap((exam) => {
                if (!exam) return of(null);
                // @REVIEW: Handle nullable subject for independent exams
                return of({
                  submission: sub,
                  examTitle: exam.title,
                  subjectName: exam.subject?.name ?? 'Independent Exam',
                  subjectColor: exam.subject?.color ?? '#6b7280',
                  totalMarks: exam.totalMarks,
                  passingMarks: exam.passingMarks,
                  passed: sub.score >= exam.passingMarks,
                } as RecentResult);
              })
            )
          );

          return forkJoin(requests);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          const valid = (items ?? []).filter(
            (i): i is RecentResult => i !== null
          );
          this.recentResults.set(valid);
          this.loadingResults.set(false);
        },
        error: () => {
          this.recentResults.set([]);
          this.loadingResults.set(false);
        },
      });
  }
}
