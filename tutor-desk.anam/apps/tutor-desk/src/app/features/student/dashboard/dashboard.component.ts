// @REVIEW: Student Dashboard - Real data from database
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
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
import { ExamWithSubject, ExamSubmission, StudentDashboardStats } from '../../../core/models';

// @REVIEW: Upcoming exam card data - Updated to track submission status for proper button display
interface UpcomingExam {
  readonly exam: ExamWithSubject;
  readonly status: 'not_started' | 'in_progress' | 'completed' | 'retake_allowed';
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
  template: `
    <div class="dashboard">
      <div class="dashboard__header">
        <h1>Student Dashboard</h1>
        <p>Welcome back, {{ userName() }}! Here's your learning overview.</p>
      </div>

      <!-- Stats Cards -->
      <div class="dashboard__stats">
        @if (loadingStats()) {
          @for (i of [1, 2, 3, 4]; track i) {
            <p-card styleClass="stat-card">
              <div class="stat-card__content">
                <p-skeleton shape="circle" size="56px" />
                <div class="stat-card__info">
                  <p-skeleton width="40px" height="24px" />
                  <p-skeleton width="100px" height="14px" />
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

      <!-- Upcoming Exams -->
      <p-card styleClass="dashboard__card">
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>Upcoming Exams</h2>
            <button pButton label="View All" icon="pi pi-arrow-right" iconPos="right" class="p-button-text" routerLink="/student/exams"></button>
          </div>
        </ng-template>

        @if (loadingExams()) {
          <div class="skeleton-table">
            @for (i of [1, 2, 3]; track i) {
              <div class="skeleton-row">
                <p-skeleton width="200px" height="16px" />
                <p-skeleton width="120px" height="24px" borderRadius="16px" />
                <p-skeleton width="150px" height="16px" />
                <p-skeleton width="80px" height="16px" />
                <p-skeleton width="100px" height="36px" />
              </div>
            }
          </div>
        } @else if (upcomingExams().length === 0) {
          <div class="empty-state">
            <i class="pi pi-calendar empty-state__icon"></i>
            <p class="empty-state__text">No upcoming exams scheduled</p>
          </div>
        } @else {
          <p-table [value]="upcomingExams()" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Exam Title</th>
                <th>Subject</th>
                <th>Schedule</th>
                <th>Questions</th>
                <th>Actions</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-item>
              <tr>
                <td>
                  <span class="exam-title">{{ item.exam.title }}</span>
                </td>
                <td>
                  <span class="subject-badge" [style.background]="item.exam.subject.color">
                    {{ item.exam.subject.name }}
                  </span>
                </td>
                <td>
                  @if (item.exam.scheduledStart) {
                    {{ item.exam.scheduledStart | date:'short' }}
                  } @else {
                    <span class="text-secondary">Anytime</span>
                  }
                </td>
                <td>{{ item.exam.totalQuestions }} ({{ item.exam.totalMarks }} marks)</td>
                <td>
                  @switch (item.status) {
                    @case ('in_progress') {
                      <button 
                        pButton 
                        label="Resume" 
                        icon="pi pi-play" 
                        class="p-button-sm p-button-warning"
                        [routerLink]="['/student/exams', item.exam.id, 'take']"
                      ></button>
                    }
                    @case ('retake_allowed') {
                      <button 
                        pButton 
                        label="Retake" 
                        icon="pi pi-refresh" 
                        class="p-button-sm p-button-help"
                        [routerLink]="['/student/exams', item.exam.id, 'take']"
                      ></button>
                    }
                    @case ('completed') {
                      <p-tag value="Completed" severity="success" icon="pi pi-check" />
                    }
                    @default {
                      <button 
                        pButton 
                        label="Take Exam" 
                        icon="pi pi-play" 
                        class="p-button-sm"
                        [routerLink]="['/student/exams', item.exam.id, 'take']"
                      ></button>
                    }
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>

      <!-- Recent Results -->
      <p-card styleClass="dashboard__card">
        <ng-template pTemplate="header">
          <div class="card-header">
            <h2>Recent Results</h2>
            <button pButton label="View All" icon="pi pi-arrow-right" iconPos="right" class="p-button-text" routerLink="/student/results"></button>
          </div>
        </ng-template>

        @if (loadingResults()) {
          <div class="skeleton-table">
            @for (i of [1, 2, 3]; track i) {
              <div class="skeleton-row">
                <p-skeleton width="200px" height="16px" />
                <p-skeleton width="120px" height="24px" borderRadius="16px" />
                <p-skeleton width="80px" height="16px" />
                <p-skeleton width="60px" height="24px" borderRadius="16px" />
              </div>
            }
          </div>
        } @else if (recentResults().length === 0) {
          <div class="empty-state">
            <i class="pi pi-chart-bar empty-state__icon"></i>
            <p class="empty-state__text">No exam results yet. Complete an exam to see your results here.</p>
          </div>
        } @else {
          <p-table [value]="recentResults()" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Exam Title</th>
                <th>Subject</th>
                <th>Score</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-result>
              <tr>
                <td>
                  <span class="exam-title">{{ result.examTitle }}</span>
                </td>
                <td>
                  <span class="subject-badge" [style.background]="result.subjectColor">
                    {{ result.subjectName }}
                  </span>
                </td>
                <td>
                  <span class="score" [class.score--pass]="result.passed">
                    {{ result.submission.score }} / {{ result.totalMarks }}
                    <span class="score__percentage">({{ result.submission.percentage }}%)</span>
                  </span>
                </td>
                <td>
                  <p-tag
                    [value]="result.passed ? 'Passed' : 'Failed'"
                    [severity]="result.passed ? 'success' : 'danger'"
                  />
                </td>
                <td>{{ result.submission.submittedAt | date:'short' }}</td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>
    </div>
  `,
  styles: `
    .dashboard { padding: 1.5rem; }

    .dashboard__header { margin-bottom: 2rem; }
    .dashboard__header h1 { margin: 0 0 0.5rem; font-size: 1.75rem; font-weight: 600; }
    .dashboard__header p { margin: 0; color: var(--text-color-secondary); }

    .dashboard__stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    :host ::ng-deep .stat-card .p-card-body { padding: 1.25rem; }

    .stat-card__content { display: flex; align-items: center; gap: 1rem; }

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

    .stat-card__info { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 700; color: var(--text-color); }
    .stat-card__label { font-size: 0.875rem; color: var(--text-color-secondary); }

    :host ::ng-deep .dashboard__card { margin-bottom: 1.5rem; }
    :host ::ng-deep .dashboard__card .p-card-body { padding: 0; }
    :host ::ng-deep .dashboard__card .p-card-content { padding: 0; }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--surface-border);
    }
    .card-header h2 { margin: 0; font-size: 1.125rem; font-weight: 600; }

    .skeleton-table { padding: 1rem 1.5rem; }
    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 2rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--surface-100);
    }

    .empty-state { text-align: center; padding: 3rem 2rem; }
    .empty-state__icon { font-size: 3rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 0.5rem; }
    .empty-state__text { margin: 0; color: var(--text-color-secondary); }

    .exam-title { font-weight: 500; }

    .subject-badge {
      display: inline-block;
      padding: 0.25rem 0.625rem;
      border-radius: 16px;
      color: white;
      font-size: 0.8125rem;
      font-weight: 500;
    }

    .text-secondary { color: var(--text-color-secondary); }

    .score { font-weight: 600; color: var(--red-600); }
    .score--pass { color: var(--green-600); }
    .score__percentage { font-weight: 400; color: var(--text-color-secondary); margin-left: 0.25rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);

  // State
  readonly loadingStats = signal(true);
  readonly loadingExams = signal(true);
  readonly loadingResults = signal(true);
  readonly stats = signal<StudentDashboardStats | null>(null);
  readonly upcomingExams = signal<UpcomingExam[]>([]);
  readonly recentResults = signal<RecentResult[]>([]);

  // Computed
  readonly userName = computed(() => this.authStore.user()?.fullName?.split(' ')[0] ?? 'Student');

  readonly statsCards = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { icon: 'pi-book', label: 'Enrolled Subjects', value: s.enrolledSubjects.toString(), color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
      { icon: 'pi-file-edit', label: 'Pending Exams', value: s.pendingExams.toString(), color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
      { icon: 'pi-check-circle', label: 'Completed', value: s.totalExamsTaken.toString(), color: 'linear-gradient(135deg, #10b981, #059669)' },
      { icon: 'pi-chart-line', label: 'Avg Score', value: `${Math.round(s.averageScore)}%`, color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' },
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
    this.db.students.getDashboardStats(studentId).subscribe({
      next: (stats) => {
        this.stats.set(stats);
        this.loadingStats.set(false);
      },
      error: () => {
        this.stats.set({ enrolledSubjects: 0, totalExamsTaken: 0, averageScore: 0, pendingExams: 0 });
        this.loadingStats.set(false);
      },
    });

    // @REVIEW: Load upcoming exams with submission status check - Fixed to filter out completed exams
    forkJoin({
      exams: this.db.exams.getUpcomingForStudent(studentId),
      submissions: this.db.submissions.getByStudent(studentId, { page: 1, pageSize: 100 }),
    }).subscribe({
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
            (sub.status === 'submitted' || sub.status === 'auto_submitted' || sub.status === 'evaluated') &&
            currentStatus !== 'in_progress' && currentStatus !== 'retake_allowed'
          ) {
            // Only set completed if not already in_progress or retake_allowed
            submissionStatusMap.set(sub.examId, 'completed');
          }
        }

        // @REVIEW: Filter out completed exams (unless retake_allowed or in_progress)
        const upcomingItems: UpcomingExam[] = exams
          .map(exam => {
            const status = submissionStatusMap.get(exam.id) ?? 'not_started';
            return { exam, status };
          })
          .filter(item => item.status !== 'completed') // Hide completed exams from upcoming
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
    this.db.submissions.getByStudent(studentId, { page: 1, pageSize: 10 }).pipe(
      switchMap(response => {
        const completed = response.items.filter(s =>
          s.status === 'submitted' || s.status === 'auto_submitted' || s.status === 'evaluated'
        ).slice(0, 5);

        if (completed.length === 0) return of([]);

        const requests = completed.map(sub =>
          this.db.exams.getById(sub.examId).pipe(
            switchMap(exam => {
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
      })
    ).subscribe({
      next: (items) => {
        const valid = (items ?? []).filter((i): i is RecentResult => i !== null);
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
