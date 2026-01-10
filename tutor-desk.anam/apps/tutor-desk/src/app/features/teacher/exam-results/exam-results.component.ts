// @REVIEW: Exam Results - View all student submissions for an exam
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
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
import { TextareaModule } from 'primeng/textarea';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { forkJoin } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamSubmission, ExamWithSubject, StudentWithUser } from '../../../core/models';

// @REVIEW: Submission with student details
interface SubmissionRow {
  readonly submission: ExamSubmission;
  readonly student: StudentWithUser | null;
}

@Component({
  selector: 'app-exam-results',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
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
    TextareaModule,
    ToastModule,
    ConfirmDialogModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <div class="results-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__nav">
          <a routerLink="/teacher/exams" class="back-link">
            <i class="pi pi-arrow-left"></i>
            Back to Exams
          </a>
        </div>
        @if (loading()) {
          <p-skeleton width="300px" height="32px" />
          <p-skeleton width="200px" height="20px" />
        } @else if (exam()) {
          <div class="page-header__content">
            <h1 class="page-header__title">{{ exam()!.title }} - Results</h1>
            <p class="page-header__subtitle">
              @if (exam()!.subject) {
                <span class="subject-badge" [style.background]="exam()!.subject!.color">
                  {{ exam()!.subject!.name }}
                </span>
              }
              {{ submissions().length }} submission(s)
            </p>
          </div>
        }
      </header>

      <!-- Stats Cards -->
      <section class="stats-row">
        @if (loading()) {
          @for (i of [1, 2, 3, 4, 5]; track i) {
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

      <!-- Submissions Table -->
      <p-card styleClass="results-table-card">
        <ng-template #header>
          <div class="table-header">
            <h2 class="table-header__title">Student Submissions</h2>
            <div class="table-header__filters">
              <p-iconfield>
                <p-inputicon styleClass="pi pi-search" />
                <input
                  type="text"
                  pInputText
                  placeholder="Search students..."
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
        } @else if (filteredSubmissions().length === 0) {
          <div class="empty-state">
            <i class="pi pi-users empty-state__icon"></i>
            <h3 class="empty-state__title">
              @if (searchTerm) {
                No matching submissions
              } @else {
                No submissions yet
              }
            </h3>
            <p class="empty-state__text">
              @if (searchTerm) {
                Try adjusting your search
              } @else {
                No students have taken this exam yet
              }
            </p>
          </div>
        } @else {
          <p-table
            [value]="filteredSubmissions()"
            [paginator]="filteredSubmissions().length > 10"
            [rows]="10"
            [rowsPerPageOptions]="[10, 25, 50]"
            styleClass="p-datatable-sm"
            sortField="submission.submittedAt"
            [sortOrder]="-1"
          >
            <ng-template #header>
              <tr>
                <th pSortableColumn="student.user.fullName">Student <p-sortIcon field="student.user.fullName" /></th>
                <th>Email</th>
                <th pSortableColumn="submission.score">Score <p-sortIcon field="submission.score" /></th>
                <th pSortableColumn="submission.percentage">Percentage <p-sortIcon field="submission.percentage" /></th>
                <th>Status</th>
                <th>Result</th>
                <th pSortableColumn="submission.submittedAt">Submitted <p-sortIcon field="submission.submittedAt" /></th>
                <th>Actions</th>
              </tr>
            </ng-template>
            <ng-template #body let-row>
              <tr>
                <td>
                  <div class="student-cell">
                    <div class="student-avatar" [style.background]="getAvatarColor(row.student?.user?.fullName ?? 'S')">
                      {{ getInitials(row.student?.user?.fullName ?? 'Student') }}
                    </div>
                    <div class="student-info">
                      <span class="student-name">{{ row.student?.user?.fullName ?? 'Unknown Student' }}</span>
                      @if (row.submission.attemptNumber > 1) {
                        <span class="attempt-badge">Attempt {{ row.submission.attemptNumber }}</span>
                      }
                    </div>
                  </div>
                </td>
                <td>
                  <span class="email-text">{{ row.student?.user?.email ?? '-' }}</span>
                </td>
                <td>
                  <div class="score-cell">
                    <span class="score-value" [class.score-value--pass]="row.submission.score >= (exam()?.passingMarks ?? 0)">
                      {{ row.submission.score }}
                    </span>
                    <span class="score-total">/ {{ exam()?.totalMarks ?? 0 }}</span>
                  </div>
                </td>
                <td>
                  <div class="percentage-cell">
                    <p-progressBar
                      [value]="row.submission.percentage"
                      [showValue]="false"
                      styleClass="percentage-bar"
                      [style]="{ height: '8px', width: '80px' }"
                    />
                    <span>{{ row.submission.percentage }}%</span>
                  </div>
                </td>
                <td>
                  <p-tag
                    [value]="getStatusLabel(row.submission.status)"
                    [severity]="getStatusSeverity(row.submission.status)"
                  />
                </td>
                <td>
                  @if (row.submission.status !== 'in_progress') {
                    <p-tag
                      [value]="row.submission.score >= (exam()?.passingMarks ?? 0) ? 'Passed' : 'Failed'"
                      [severity]="row.submission.score >= (exam()?.passingMarks ?? 0) ? 'success' : 'danger'"
                    />
                  } @else {
                    <span class="text-muted">-</span>
                  }
                </td>
                <td>
                  @if (row.submission.submittedAt) {
                    {{ row.submission.submittedAt | date:'short' }}
                  } @else {
                    <span class="text-muted">In Progress</span>
                  }
                </td>
                <td>
                    <div class="actions-cell">
                    <p-button
                      icon="pi pi-eye"
                      [rounded]="true"
                      [text]="true"
                      pTooltip="View Details"
                      (click)="viewDetails(row)"
                    />
                    @if (row.submission.status !== 'in_progress' && row.submission.status !== 'retake_allowed') {
                      <p-button
                        icon="pi pi-refresh"
                        [rounded]="true"
                        [text]="true"
                        severity="warn"
                        pTooltip="Allow Retake"
                        (click)="confirmAllowRetake(row)"
                      />
                    }
                    @if (row.submission.status === 'retake_allowed') {
                      <p-button
                        icon="pi pi-times"
                        [rounded]="true"
                        [text]="true"
                        severity="danger"
                        pTooltip="Cancel Retake"
                        (click)="confirmCancelRetake(row)"
                      />
                    }
                  </div>
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
        [style]="{ width: '700px' }"
        header="Submission Details"
      >
        @if (selectedRow()) {
          <div class="details-dialog">
            <div class="details-header">
              <div class="student-cell">
                <div class="student-avatar large" [style.background]="getAvatarColor(selectedRow()!.student?.user?.fullName ?? 'S')">
                  {{ getInitials(selectedRow()!.student?.user?.fullName ?? 'Student') }}
                </div>
                <div class="student-info">
                  <h3>{{ selectedRow()!.student?.user?.fullName ?? 'Unknown Student' }}</h3>
                  <span class="email-text">{{ selectedRow()!.student?.user?.email ?? '-' }}</span>
                </div>
              </div>
            </div>

            <div class="details-score">
              <div class="score-display">
                <span class="score-main" [class.score-main--pass]="selectedRow()!.submission.score >= (exam()?.passingMarks ?? 0)">
                  {{ selectedRow()!.submission.score }}
                </span>
                <span class="score-divider">/ {{ exam()?.totalMarks ?? 0 }}</span>
              </div>
              <span class="percentage-display">{{ selectedRow()!.submission.percentage }}%</span>
              <p-tag
                [value]="selectedRow()!.submission.score >= (exam()?.passingMarks ?? 0) ? 'PASSED' : 'FAILED'"
                [severity]="selectedRow()!.submission.score >= (exam()?.passingMarks ?? 0) ? 'success' : 'danger'"
                styleClass="result-tag"
              />
            </div>

            <div class="details-stats">
              <div class="detail-stat">
                <span class="detail-value correct">{{ selectedRow()!.submission.totalCorrect }}</span>
                <span class="detail-label">Correct</span>
              </div>
              <div class="detail-stat">
                <span class="detail-value wrong">{{ selectedRow()!.submission.totalWrong }}</span>
                <span class="detail-label">Wrong</span>
              </div>
              <div class="detail-stat">
                <span class="detail-value skipped">{{ selectedRow()!.submission.totalSkipped }}</span>
                <span class="detail-label">Skipped</span>
              </div>
              <div class="detail-stat">
                <span class="detail-value">{{ selectedRow()!.submission.totalAnswered }}</span>
                <span class="detail-label">Answered</span>
              </div>
            </div>

            <div class="details-info">
              <div class="info-row">
                <span class="info-label">Attempt</span>
                <span class="info-value">#{{ selectedRow()!.submission.attemptNumber }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Started</span>
                <span class="info-value">{{ selectedRow()!.submission.startedAt | date:'medium' }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Submitted</span>
                <span class="info-value">
                  @if (selectedRow()!.submission.submittedAt) {
                    {{ selectedRow()!.submission.submittedAt | date:'medium' }}
                  } @else {
                    <span class="text-muted">In Progress</span>
                  }
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">Status</span>
                <span class="info-value">
                  <p-tag
                    [value]="getStatusLabel(selectedRow()!.submission.status)"
                    [severity]="getStatusSeverity(selectedRow()!.submission.status)"
                  />
                </span>
              </div>
              @if (selectedRow()!.submission.autoSubmitReason) {
                <div class="info-row">
                  <span class="info-label">Auto-Submit Reason</span>
                  <span class="info-value auto-reason">{{ selectedRow()!.submission.autoSubmitReason }}</span>
                </div>
              }
            </div>

            <!-- Teacher Remarks -->
            <div class="remarks-section">
              <label class="remarks-label">Teacher Remarks</label>
              <textarea
                pTextarea
                [(ngModel)]="remarksInput"
                rows="3"
                placeholder="Add feedback or remarks for the student..."
                class="remarks-input"
              ></textarea>
            </div>
          </div>
        }

        <ng-template pTemplate="footer">
          <div class="dialog-footer">
            <p-button label="Close" severity="secondary" (click)="showDetailsDialog = false" />
            <!-- @REVIEW: View full submission detail page with question-by-question review -->
            <p-button
              label="View Full Details"
              icon="pi pi-external-link"
              severity="info"
              (click)="navigateToSubmissionDetail()"
            />
            <p-button
              label="Save Remarks"
              icon="pi pi-save"
              (click)="saveRemarks()"
              [loading]="savingRemarks()"
            />
          </div>
        </ng-template>
      </p-dialog>
    </div>

    <p-toast />
    <p-confirmDialog />
  `,
  styles: `
    .results-page { padding: 1.5rem; }

    /* Page Header */
    .page-header { margin-bottom: 1.5rem; }
    .page-header__nav { margin-bottom: 1rem; }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--text-color-secondary);
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.2s;
    }
    .back-link:hover { color: var(--primary-color); }
    .page-header__title { margin: 0 0 0.5rem; font-size: 1.75rem; font-weight: 600; }
    .page-header__subtitle {
      margin: 0;
      color: var(--text-color-secondary);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    /* Subject Badge */
    .subject-badge {
      display: inline-block;
      padding: 0.25rem 0.625rem;
      border-radius: 16px;
      color: white;
      font-size: 0.8125rem;
      font-weight: 500;
    }

    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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

    /* Student Cell */
    .student-cell { display: flex; align-items: center; gap: 0.75rem; }
    .student-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 0.875rem;
    }
    .student-avatar.large { width: 48px; height: 48px; font-size: 1rem; }
    .student-info { display: flex; flex-direction: column; gap: 0.125rem; }
    .student-name { font-weight: 500; }
    .email-text { font-size: 0.875rem; color: var(--text-color-secondary); }
    .attempt-badge {
      font-size: 0.6875rem;
      color: var(--text-color-secondary);
      background: var(--surface-100);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      width: fit-content;
    }

    /* Score Cell */
    .score-cell { display: flex; align-items: baseline; gap: 0.25rem; }
    .score-value { font-weight: 600; color: var(--red-500); }
    .score-value--pass { color: var(--green-500); }
    .score-total { font-size: 0.875rem; color: var(--text-color-secondary); }
    .percentage-cell { display: flex; align-items: center; gap: 0.5rem; }
    :host ::ng-deep .percentage-bar .p-progressbar-value { background: var(--primary-color); }

    .actions-cell { display: flex; gap: 0.25rem; }
    .text-muted { color: var(--text-color-secondary); font-style: italic; }

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
    .details-header h3 { margin: 0; font-size: 1.125rem; }

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
    .info-row { display: flex; justify-content: space-between; align-items: center; }
    .info-label { color: var(--text-color-secondary); }
    .info-value { font-weight: 500; }
    .info-value.auto-reason { color: var(--orange-600); }

    .remarks-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .remarks-label { font-weight: 500; color: var(--text-color-secondary); }
    .remarks-input { width: 100%; }

    .dialog-footer { display: flex; justify-content: flex-end; gap: 0.5rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  // State
  readonly loading = signal(true);
  readonly exam = signal<ExamWithSubject | null>(null);
  readonly submissions = signal<SubmissionRow[]>([]);
  readonly selectedRow = signal<SubmissionRow | null>(null);
  readonly savingRemarks = signal(false);

  searchTerm = '';
  showDetailsDialog = false;
  remarksInput = '';

  // Computed
  readonly filteredSubmissions = computed(() => {
    const search = this.searchTerm.toLowerCase().trim();
    if (!search) return this.submissions();
    return this.submissions().filter(row =>
      (row.student?.user?.fullName?.toLowerCase().includes(search) ?? false) ||
      (row.student?.user?.email?.toLowerCase().includes(search) ?? false)
    );
  });

  readonly statsCards = computed(() => {
    const items = this.submissions();
    const completed = items.filter(r => r.submission.status !== 'in_progress');
    const total = completed.length;
    const passed = completed.filter(r => r.submission.score >= (this.exam()?.passingMarks ?? 0)).length;
    const avgScore = total > 0
      ? Math.round(completed.reduce((sum, r) => sum + r.submission.percentage, 0) / total)
      : 0;
    const highestScore = total > 0
      ? Math.max(...completed.map(r => r.submission.score))
      : 0;
    const inProgress = items.filter(r => r.submission.status === 'in_progress').length;

    return [
      { icon: 'pi pi-users', label: 'Total Submissions', value: items.length, color: 'var(--primary-color)' },
      { icon: 'pi pi-check-circle', label: 'Passed', value: passed, color: 'var(--green-500)' },
      { icon: 'pi pi-times-circle', label: 'Failed', value: total - passed, color: 'var(--red-500)' },
      { icon: 'pi pi-chart-line', label: 'Avg Score', value: `${avgScore}%`, color: 'var(--blue-500)' },
      { icon: 'pi pi-clock', label: 'In Progress', value: inProgress, color: 'var(--orange-500)' },
    ];
  });

  ngOnInit(): void {
    const examId = this.route.snapshot.paramMap.get('id');
    if (examId) {
      this.loadData(examId);
    } else {
      this.loading.set(false);
    }
  }

  private loadData(examId: string): void {
    forkJoin({
      exam: this.db.exams.getById(examId),
      submissions: this.db.submissions.getByExam(examId, { page: 1, pageSize: 500 }),
    }).subscribe({
      next: ({ exam, submissions }) => {
        this.exam.set(exam);

        if (submissions.items.length === 0) {
          this.submissions.set([]);
          this.loading.set(false);
          return;
        }

        // Fetch student details for each submission
        const studentIds = [...new Set(submissions.items.map(s => s.studentId))];
        const studentRequests = studentIds.map(id => this.db.students.getById(id));

        forkJoin(studentRequests).subscribe({
          next: (students) => {
            const studentMap = new Map<string, StudentWithUser | null>();
            studentIds.forEach((id, index) => {
              studentMap.set(id, students[index]);
            });

            const rows: SubmissionRow[] = submissions.items.map(sub => ({
              submission: sub,
              student: studentMap.get(sub.studentId) ?? null,
            }));

            // Sort by submitted date desc, in_progress first
            rows.sort((a, b) => {
              if (a.submission.status === 'in_progress' && b.submission.status !== 'in_progress') return -1;
              if (a.submission.status !== 'in_progress' && b.submission.status === 'in_progress') return 1;
              return (b.submission.submittedAt?.getTime() ?? 0) - (a.submission.submittedAt?.getTime() ?? 0);
            });

            this.submissions.set(rows);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load students:', err);
            // Still show submissions without student details
            this.submissions.set(submissions.items.map(sub => ({ submission: sub, student: null })));
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        console.error('Failed to load exam results:', err);
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load exam results',
        });
      },
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'in_progress': 'In Progress',
      'submitted': 'Submitted',
      'auto_submitted': 'Auto-Submitted',
      'evaluated': 'Evaluated',
      'retake_allowed': 'Retake Allowed',
    };
    return labels[status] ?? status;
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const severities: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      'in_progress': 'warn',
      'submitted': 'info',
      'auto_submitted': 'secondary',
      'evaluated': 'success',
      'retake_allowed': 'warn',
    };
    return severities[status] ?? 'secondary';
  }

  viewDetails(row: SubmissionRow): void {
    this.selectedRow.set(row);
    this.remarksInput = row.submission.remarks ?? '';
    this.showDetailsDialog = true;
  }

  saveRemarks(): void {
    const row = this.selectedRow();
    if (!row) return;

    this.savingRemarks.set(true);

    this.db.submissions.evaluate(
      row.submission.id,
      this.authStore.user()?.id ?? '',
      this.remarksInput || undefined
    ).subscribe({
      next: (updated) => {
        // Update the submission in the list
        this.submissions.update(list =>
          list.map(r =>
            r.submission.id === updated.id
              ? { ...r, submission: updated }
              : r
          )
        );
        this.selectedRow.update(r => r ? { ...r, submission: updated } : null);
        this.savingRemarks.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Saved',
          detail: 'Remarks saved successfully',
        });
      },
      error: (err) => {
        console.error('Failed to save remarks:', err);
        this.savingRemarks.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to save remarks',
        });
      },
    });
  }

  confirmAllowRetake(row: SubmissionRow): void {
    this.confirmationService.confirm({
      message: `Allow ${row.student?.user?.fullName ?? 'this student'} to retake this exam?`,
      header: 'Allow Retake',
      icon: 'pi pi-refresh',
      acceptLabel: 'Allow Retake',
      rejectLabel: 'Cancel',
      accept: () => this.allowRetake(row),
    });
  }

  private allowRetake(row: SubmissionRow): void {
    this.db.submissions.allowRetake(row.submission.id).subscribe({
      next: (updated) => {
        this.submissions.update(list =>
          list.map(r =>
            r.submission.id === updated.id
              ? { ...r, submission: updated }
              : r
          )
        );
        this.messageService.add({
          severity: 'success',
          summary: 'Retake Allowed',
          detail: `${row.student?.user?.fullName ?? 'Student'} can now retake this exam`,
        });
      },
      error: (err) => {
        console.error('Failed to allow retake:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to allow retake',
        });
      },
    });
  }

  // @REVIEW: Cancel retake confirmation dialog
  confirmCancelRetake(row: SubmissionRow): void {
    this.confirmationService.confirm({
      message: `Cancel retake permission for ${row.student?.user?.fullName ?? 'this student'}? Their previous result will be restored.`,
      header: 'Cancel Retake',
      icon: 'pi pi-times-circle',
      acceptLabel: 'Cancel Retake',
      acceptButtonStyleClass: 'p-button-danger',
      rejectLabel: 'Keep',
      accept: () => this.cancelRetake(row),
    });
  }

  // @REVIEW: Cancel retake - reverts status back to evaluated
  private cancelRetake(row: SubmissionRow): void {
    this.db.submissions.cancelRetake(row.submission.id).subscribe({
      next: (updated) => {
        this.submissions.update(list =>
          list.map(r =>
            r.submission.id === updated.id
              ? { ...r, submission: updated }
              : r
          )
        );
        this.messageService.add({
          severity: 'success',
          summary: 'Retake Cancelled',
          detail: `${row.student?.user?.fullName ?? 'Student'}'s retake permission has been revoked`,
        });
      },
      error: (err) => {
        console.error('Failed to cancel retake:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to cancel retake',
        });
      },
    });
  }

  // @REVIEW: Navigate to full submission detail page for question-by-question review
  navigateToSubmissionDetail(): void {
    const row = this.selectedRow();
    if (!row) return;
    this.showDetailsDialog = false;
    this.router.navigate(['/teacher/submissions', row.submission.id]);
  }
}
