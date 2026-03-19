// @REVIEW: Student Results - View exam results and scores
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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { forkJoin, of, switchMap } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamSubmission } from '../../../core/models';

// @REVIEW: Result item with exam details
interface ResultItem {
  readonly submission: ExamSubmission;
  readonly examTitle: string;
  readonly subjectName: string;
  readonly subjectColor: string;
  readonly totalMarks: number;
  readonly passingMarks: number;
  readonly passed: boolean;
}

@Component({
  selector: 'app-results',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SkeletonModule,
    ProgressBarModule,
  ],
  templateUrl: './results.component.html',
  styles: `
    .results-page { padding: 1.5rem; }

    /* Page Header */
    .page-header { margin-bottom: 1.5rem; }
    .page-header__title { margin: 0 0 0.25rem; font-size: 1.75rem; font-weight: 600; }
    .page-header__subtitle { margin: 0; color: var(--text-color-secondary); }

    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    :host ::ng-deep .stat-card { height: 100%; }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    .stat-card__content { display: flex; align-items: center; gap: 1rem; }
    .stat-card__icon {
      width: 48px; height: 48px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.25rem;
    }
    .stat-card__text { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 600; line-height: 1.2; }
    .stat-card__label { font-size: 0.875rem; color: var(--text-color-secondary); }

    /* Table */
    :host ::ng-deep .results-table-card .p-card-body { padding: 0; }
    :host ::ng-deep .results-table-card .p-card-content { padding: 0; }
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--surface-200);
    }
    .table-header__title { margin: 0; font-size: 1.125rem; font-weight: 600; }

    .skeleton-table { padding: 1rem; }
    .skeleton-row {
      display: flex;
      gap: 2rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--surface-100);
    }

    /* Table Cells */
    .exam-cell { display: flex; flex-direction: column; gap: 0.25rem; }
    .exam-title { font-weight: 500; }
    .attempt-badge {
      font-size: 0.75rem;
      color: var(--text-color-secondary);
      background: var(--surface-100);
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      width: fit-content;
    }
    .subject-badge {
      display: inline-block;
      padding: 0.25rem 0.625rem;
      border-radius: 16px;
      color: white;
      font-size: 0.8125rem;
      font-weight: 500;
    }
    .score-cell { display: flex; align-items: baseline; gap: 0.25rem; }
    .score-value { font-weight: 600; color: var(--red-500); }
    .score-value--pass { color: var(--green-500); }
    .score-total { font-size: 0.875rem; color: var(--text-color-secondary); }
    .percentage-cell { display: flex; align-items: center; gap: 0.5rem; }
    :host ::ng-deep .percentage-bar .p-progressbar-value { background: var(--primary-color); }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }
    .empty-state__icon { font-size: 4rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 1rem; }
    .empty-state__title { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .empty-state__text { margin: 0; color: var(--text-color-secondary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsComponent implements OnInit {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly results = signal<ResultItem[]>([]);
  searchTerm = '';

  // Computed
  readonly filteredResults = computed(() => {
    const search = this.searchTerm.toLowerCase().trim();
    if (!search) return this.results();
    return this.results().filter(
      (r) =>
        r.examTitle.toLowerCase().includes(search) ||
        r.subjectName.toLowerCase().includes(search)
    );
  });

  readonly statsCards = computed(() => {
    const items = this.results();
    const total = items.length;
    const passed = items.filter((r) => r.passed).length;
    const avgScore =
      total > 0
        ? Math.round(
            items.reduce((sum, r) => sum + r.submission.percentage, 0) / total
          )
        : 0;
    const bestScore =
      total > 0 ? Math.max(...items.map((r) => r.submission.percentage)) : 0;

    return [
      {
        icon: 'pi pi-file-edit',
        label: 'Total Exams',
        value: total,
        color: 'var(--primary-color)',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Passed',
        value: passed,
        color: 'var(--green-500)',
      },
      {
        icon: 'pi pi-chart-line',
        label: 'Avg Score',
        value: `${avgScore}%`,
        color: 'var(--blue-500)',
      },
      {
        icon: 'pi pi-star',
        label: 'Best Score',
        value: `${bestScore}%`,
        color: 'var(--orange-500)',
      },
    ];
  });

  ngOnInit(): void {
    this.loadResults();
  }

  // @REVIEW: Load all student results with exam details
  private loadResults(): void {
    const studentId = this.authStore.studentId();
    if (!studentId) {
      this.loading.set(false);
      return;
    }

    // Get all submissions (paginated, but fetch more)
    this.db.submissions
      .getByStudent(studentId, { page: 1, pageSize: 100 })
      .pipe(
        switchMap((response) => {
          const completedSubmissions = response.items.filter(
            (s) =>
              s.status === 'submitted' ||
              s.status === 'auto_submitted' ||
              s.status === 'evaluated'
          );

          if (completedSubmissions.length === 0) {
            return of([]);
          }

          // Get exam details for each submission
          const examRequests = completedSubmissions.map((sub) =>
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
                } as ResultItem);
              })
            )
          );

          return forkJoin(examRequests);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          const validItems = (items ?? []).filter(
            (item): item is ResultItem => item !== null
          );
          // Sort by submitted date descending
          validItems.sort(
            (a, b) =>
              (b.submission.submittedAt?.getTime() ?? 0) -
              (a.submission.submittedAt?.getTime() ?? 0)
          );
          this.results.set(validItems);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load results:', err);
          this.loading.set(false);
        },
      });
  }

  // @REVIEW: Navigate to submission review page instead of showing dialog
  viewDetails(result: ResultItem): void {
    this.router.navigate(['/student/results', result.submission.id]);
  }
}
