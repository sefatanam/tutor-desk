// @REVIEW: Student Results - View exam results and scores
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { forkJoin, of, switchMap } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamSubmission, ExamSubmissionWithDetails, Exam } from '../../../core/models';

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
    DialogModule,
    ProgressBarModule,
  ],
  template: `
    <div class="results-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">My Results</h1>
          <p class="page-header__subtitle">View all your exam results and performance</p>
        </div>
      </header>

      <!-- Stats Cards -->
      <section class="stats-row">
        @if (loading()) {
          @for (i of [1, 2, 3, 4]; track i) {
            <p-card styleClass="stat-card">
              <div class="stat-card__content">
                <p-skeleton shape="circle" size="48px" />
                <div class="stat-card__text">
                  <p-skeleton width="40px" height="24px" />
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
                  <i [class]="stat.icon"></i>
                </div>
                <div class="stat-card__text">
                  <span class="stat-card__value">{{ stat.value }}</span>
                  <span class="stat-card__label">{{ stat.label }}</span>
                </div>
              </div>
            </p-card>
          }
        }
      </section>

      <!-- Results Table -->
      <p-card styleClass="results-table-card">
        <ng-template #header>
          <div class="table-header">
            <h2 class="table-header__title">Exam Results</h2>
            <div class="table-header__filters">
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                  type="text"
                  pInputText
                  placeholder="Search results..."
                  [(ngModel)]="searchTerm"
                />
              </p-iconfield>
            </div>
          </div>
        </ng-template>

        @if (loading()) {
          <div class="skeleton-table">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="skeleton-row">
                <p-skeleton width="200px" height="16px" />
                <p-skeleton width="120px" height="16px" />
                <p-skeleton width="80px" height="16px" />
                <p-skeleton width="60px" height="16px" />
                <p-skeleton width="80px" height="24px" borderRadius="16px" />
              </div>
            }
          </div>
        } @else if (filteredResults().length === 0) {
          <div class="empty-state">
            <i class="pi pi-chart-bar empty-state__icon"></i>
            <h3 class="empty-state__title">
              @if (searchTerm) {
                No matching results
              } @else {
                No exam results yet
              }
            </h3>
            <p class="empty-state__text">
              @if (searchTerm) {
                Try adjusting your search
              } @else {
                Complete an exam to see your results here
              }
            </p>
          </div>
        } @else {
          <p-table
            [value]="filteredResults()"
            [paginator]="filteredResults().length > 10"
            [rows]="10"
            [rowsPerPageOptions]="[10, 25, 50]"
            styleClass="p-datatable-sm"
          >
            <ng-template #header>
              <tr>
                <th pSortableColumn="examTitle">Exam <p-sortIcon field="examTitle" /></th>
                <th pSortableColumn="subjectName">Subject <p-sortIcon field="subjectName" /></th>
                <th pSortableColumn="submission.score">Score <p-sortIcon field="submission.score" /></th>
                <th pSortableColumn="submission.percentage">Percentage <p-sortIcon field="submission.percentage" /></th>
                <th>Status</th>
                <th pSortableColumn="submission.submittedAt">Submitted <p-sortIcon field="submission.submittedAt" /></th>
                <th>Actions</th>
              </tr>
            </ng-template>
            <ng-template #body let-result>
              <tr>
                <td>
                  <div class="exam-cell">
                    <span class="exam-title">{{ result.examTitle }}</span>
                    @if (result.submission.attemptNumber > 1) {
                      <span class="attempt-badge">Attempt {{ result.submission.attemptNumber }}</span>
                    }
                  </div>
                </td>
                <td>
                  <span class="subject-badge" [style.background]="result.subjectColor">
                    {{ result.subjectName }}
                  </span>
                </td>
                <td>
                  <div class="score-cell">
                    <span class="score-value" [class.score-value--pass]="result.passed">
                      {{ result.submission.score }}
                    </span>
                    <span class="score-total">/ {{ result.totalMarks }}</span>
                  </div>
                </td>
                <td>
                  <div class="percentage-cell">
                    <p-progressBar
                      [value]="result.submission.percentage"
                      [showValue]="false"
                      styleClass="percentage-bar"
                      [style]="{ height: '8px', width: '80px' }"
                    />
                    <span>{{ result.submission.percentage }}%</span>
                  </div>
                </td>
                <td>
                  <p-tag
                    [value]="result.passed ? 'Passed' : 'Failed'"
                    [severity]="result.passed ? 'success' : 'danger'"
                  />
                </td>
                <td>{{ result.submission.submittedAt | date:'short' }}</td>
                <td>
                  <p-button
                    icon="pi pi-eye"
                    [rounded]="true"
                    [text]="true"
                    pTooltip="View Details"
                    (click)="viewDetails(result)"
                  />
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>

      <!-- Details Dialog -->
      <p-dialog
        [(visible)]="showDetailsDialog"
        [modal]="true"
        [closable]="true"
        [style]="{ width: '600px' }"
        header="Result Details"
      >
        @if (selectedResult()) {
          <div class="details-dialog">
            <div class="details-header">
              <h3>{{ selectedResult()!.examTitle }}</h3>
              <span class="subject-badge" [style.background]="selectedResult()!.subjectColor">
                {{ selectedResult()!.subjectName }}
              </span>
            </div>

            <div class="details-score">
              <div class="score-display">
                <span class="score-main" [class.score-main--pass]="selectedResult()!.passed">
                  {{ selectedResult()!.submission.score }}
                </span>
                <span class="score-divider">/ {{ selectedResult()!.totalMarks }}</span>
              </div>
              <span class="percentage-display">{{ selectedResult()!.submission.percentage }}%</span>
              <p-tag
                [value]="selectedResult()!.passed ? 'PASSED' : 'FAILED'"
                [severity]="selectedResult()!.passed ? 'success' : 'danger'"
                styleClass="result-tag"
              />
            </div>

            <div class="details-stats">
              <div class="detail-stat">
                <span class="detail-value correct">{{ selectedResult()!.submission.totalCorrect }}</span>
                <span class="detail-label">Correct</span>
              </div>
              <div class="detail-stat">
                <span class="detail-value wrong">{{ selectedResult()!.submission.totalWrong }}</span>
                <span class="detail-label">Wrong</span>
              </div>
              <div class="detail-stat">
                <span class="detail-value skipped">{{ selectedResult()!.submission.totalSkipped }}</span>
                <span class="detail-label">Skipped</span>
              </div>
              <div class="detail-stat">
                <span class="detail-value">{{ selectedResult()!.submission.totalAnswered }}</span>
                <span class="detail-label">Answered</span>
              </div>
            </div>

            <div class="details-info">
              <div class="info-row">
                <span class="info-label">Attempt</span>
                <span class="info-value">#{{ selectedResult()!.submission.attemptNumber }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Started</span>
                <span class="info-value">{{ selectedResult()!.submission.startedAt | date:'medium' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Submitted</span>
                <span class="info-value">{{ selectedResult()!.submission.submittedAt | date:'medium' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Status</span>
                <span class="info-value">
                  @switch (selectedResult()!.submission.status) {
                    @case ('submitted') { Submitted }
                    @case ('auto_submitted') { Auto-Submitted }
                    @case ('evaluated') { Evaluated }
                    @default { {{ selectedResult()!.submission.status }} }
                  }
                </span>
              </div>
              @if (selectedResult()!.submission.autoSubmitReason) {
                <div class="info-row">
                  <span class="info-label">Auto-Submit Reason</span>
                  <span class="info-value auto-reason">{{ selectedResult()!.submission.autoSubmitReason }}</span>
                </div>
              }
              @if (selectedResult()!.submission.remarks) {
                <div class="info-row">
                  <span class="info-label">Teacher Remarks</span>
                  <span class="info-value">{{ selectedResult()!.submission.remarks }}</span>
                </div>
              }
              @if (selectedResult()!.passingMarks > 0) {
                <div class="info-row">
                  <span class="info-label">Passing Marks</span>
                  <span class="info-value">{{ selectedResult()!.passingMarks }}</span>
                </div>
              }
            </div>
          </div>
        }

        <ng-template pTemplate="footer">
          <p-button label="Close" severity="secondary" (click)="showDetailsDialog = false" />
        </ng-template>
      </p-dialog>
    </div>
  `,
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

    /* Details Dialog */
    .details-dialog { display: flex; flex-direction: column; gap: 1.5rem; }
    .details-header { display: flex; justify-content: space-between; align-items: center; }
    .details-header h3 { margin: 0; font-size: 1.25rem; }

    .details-score {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      padding: 1.5rem;
      background: var(--surface-100);
      border-radius: 12px;
    }
    .score-display { display: flex; align-items: baseline; }
    .score-main { font-size: 3rem; font-weight: 700; color: var(--red-500); }
    .score-main--pass { color: var(--green-500); }
    .score-divider { font-size: 1.5rem; color: var(--text-color-secondary); }
    .percentage-display { font-size: 1.5rem; font-weight: 600; color: var(--text-color-secondary); }
    :host ::ng-deep .result-tag { font-size: 1rem; padding: 0.5rem 1rem; }

    .details-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      text-align: center;
    }
    .detail-stat { padding: 0.75rem; background: var(--surface-50); border-radius: 8px; }
    .detail-value { display: block; font-size: 1.5rem; font-weight: 600; }
    .detail-value.correct { color: var(--green-500); }
    .detail-value.wrong { color: var(--red-500); }
    .detail-value.skipped { color: var(--orange-500); }
    .detail-label { font-size: 0.8125rem; color: var(--text-color-secondary); }

    .details-info {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 1rem;
      background: var(--surface-50);
      border-radius: 8px;
    }
    .info-row { display: flex; justify-content: space-between; }
    .info-label { color: var(--text-color-secondary); }
    .info-value { font-weight: 500; }
    .info-value.auto-reason { color: var(--orange-600); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsComponent implements OnInit {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);

  // State
  readonly loading = signal(true);
  readonly results = signal<ResultItem[]>([]);
  searchTerm = '';
  showDetailsDialog = false;
  readonly selectedResult = signal<ResultItem | null>(null);

  // Computed
  readonly filteredResults = computed(() => {
    const search = this.searchTerm.toLowerCase().trim();
    if (!search) return this.results();
    return this.results().filter(r =>
      r.examTitle.toLowerCase().includes(search) ||
      r.subjectName.toLowerCase().includes(search)
    );
  });

  readonly statsCards = computed(() => {
    const items = this.results();
    const total = items.length;
    const passed = items.filter(r => r.passed).length;
    const avgScore = total > 0
      ? Math.round(items.reduce((sum, r) => sum + r.submission.percentage, 0) / total)
      : 0;
    const bestScore = total > 0
      ? Math.max(...items.map(r => r.submission.percentage))
      : 0;

    return [
      { icon: 'pi pi-file-edit', label: 'Total Exams', value: total, color: 'var(--primary-color)' },
      { icon: 'pi pi-check-circle', label: 'Passed', value: passed, color: 'var(--green-500)' },
      { icon: 'pi pi-chart-line', label: 'Avg Score', value: `${avgScore}%`, color: 'var(--blue-500)' },
      { icon: 'pi pi-star', label: 'Best Score', value: `${bestScore}%`, color: 'var(--orange-500)' },
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
    this.db.submissions.getByStudent(studentId, { page: 1, pageSize: 100 }).pipe(
      switchMap(response => {
        const completedSubmissions = response.items.filter(s =>
          s.status === 'submitted' || s.status === 'auto_submitted' || s.status === 'evaluated'
        );

        if (completedSubmissions.length === 0) {
          return of([]);
        }

        // Get exam details for each submission
        const examRequests = completedSubmissions.map(sub =>
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
              } as ResultItem);
            })
          )
        );

        return forkJoin(examRequests);
      })
    ).subscribe({
      next: (items) => {
        const validItems = (items ?? []).filter((item): item is ResultItem => item !== null);
        // Sort by submitted date descending
        validItems.sort((a, b) =>
          (b.submission.submittedAt?.getTime() ?? 0) - (a.submission.submittedAt?.getTime() ?? 0)
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

  viewDetails(result: ResultItem): void {
    this.selectedResult.set(result);
    this.showDetailsDialog = true;
  }
}
