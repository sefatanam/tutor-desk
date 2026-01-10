// @REVIEW: Teacher Results - View all student exam submissions with comprehensive filters
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, effect } from '@angular/core';
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
import { SelectModule } from 'primeng/select';
import { forkJoin } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamSubmission, ExamWithSubject, StudentWithUser } from '../../../core/models';

// @REVIEW: Result item with exam and student details for teacher view
interface ResultItem {
  readonly submission: ExamSubmission;
  readonly examId: string;
  readonly examTitle: string;
  readonly subjectId: string | null;
  readonly subjectName: string;
  readonly subjectColor: string;
  readonly studentId: string;
  readonly studentName: string;
  readonly studentEmail: string;
  readonly totalMarks: number;
  readonly passingMarks: number;
  readonly passed: boolean;
}

// @REVIEW: Filter dropdown option
interface FilterOption {
  readonly label: string;
  readonly value: string;
}

@Component({
  selector: 'app-teacher-results',
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
    SelectModule,
  ],
  template: `
    <div class="results-page">
      <!-- Page Header -->
      <header class="page-header">
        <div class="page-header__content">
          <h1 class="page-header__title">All Results</h1>
          <p class="page-header__subtitle">View and manage all student exam submissions</p>
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

      <!-- Filters Section -->
      <p-card styleClass="filters-card">
        <div class="filters-row">
          <div class="filter-group">
            <label class="filter-label">Subject</label>
            <p-select
              [options]="subjectOptions()"
              [ngModel]="subjectFilter()"
              (ngModelChange)="subjectFilter.set($event); onSubjectChange()"
              placeholder="All Subjects"
              [showClear]="true"
              styleClass="filter-select"
            />
          </div>
          <div class="filter-group">
            <label class="filter-label">Exam</label>
            <p-select
              [options]="examOptions()"
              [ngModel]="examFilter()"
              (ngModelChange)="examFilter.set($event)"
              placeholder="All Exams"
              [showClear]="true"
              styleClass="filter-select"
            />
          </div>
          <div class="filter-group">
            <label class="filter-label">Student</label>
            <p-select
              [options]="studentOptions()"
              [ngModel]="studentFilter()"
              (ngModelChange)="studentFilter.set($event)"
              placeholder="All Students"
              [showClear]="true"
              styleClass="filter-select"
            />
          </div>
          <div class="filter-group">
            <label class="filter-label">Status</label>
            <p-select
              [options]="statusOptions"
              [ngModel]="statusFilter()"
              (ngModelChange)="statusFilter.set($event)"
              placeholder="All Statuses"
              [showClear]="true"
              styleClass="filter-select"
            />
          </div>
          <div class="filter-group filter-group--search">
            <label class="filter-label">Search</label>
            <p-iconfield>
              <p-inputicon styleClass="pi pi-search" />
              <input
                type="text"
                pInputText
                placeholder="Search..."
                [ngModel]="searchTerm()"
                (ngModelChange)="searchTerm.set($event)"
              />
            </p-iconfield>
          </div>
          @if (hasActiveFilters()) {
            <div class="filter-group filter-group--action">
              <button 
                pButton 
                label="Clear Filters" 
                icon="pi pi-filter-slash" 
                class="p-button-outlined p-button-secondary"
                (click)="clearFilters()"
              ></button>
            </div>
          }
        </div>
      </p-card>

      <!-- Results Table -->
      <p-card styleClass="results-table-card">
        <ng-template #header>
          <div class="table-header">
            <h2 class="table-header__title">
              Exam Submissions
              <span class="table-header__count">({{ filteredResults().length }} results)</span>
            </h2>
          </div>
        </ng-template>

        @if (loading()) {
          <div class="skeleton-table">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="skeleton-row">
                <p-skeleton width="150px" height="16px" />
                <p-skeleton width="180px" height="16px" />
                <p-skeleton width="120px" height="16px" />
                <p-skeleton width="80px" height="16px" />
                <p-skeleton width="80px" height="24px" borderRadius="16px" />
                <p-skeleton width="100px" height="16px" />
              </div>
            }
          </div>
        } @else if (filteredResults().length === 0) {
          <div class="empty-state">
            <i class="pi pi-chart-bar empty-state__icon"></i>
            <h3 class="empty-state__title">
              @if (hasActiveFilters()) {
                No matching results
              } @else {
                No submissions yet
              }
            </h3>
            <p class="empty-state__text">
              @if (hasActiveFilters()) {
                Try adjusting your filters
              } @else {
                Student submissions will appear here once they complete exams
              }
            </p>
          </div>
        } @else {
          <p-table
            [value]="filteredResults()"
            [paginator]="filteredResults().length > 15"
            [rows]="15"
            [rowsPerPageOptions]="[15, 30, 50, 100]"
            styleClass="p-datatable-sm p-datatable-striped"
            [sortField]="'submission.submittedAt'"
            [sortOrder]="-1"
          >
            <ng-template #header>
              <tr>
                <th pSortableColumn="studentName">Student <p-sortIcon field="studentName" /></th>
                <th pSortableColumn="examTitle">Exam <p-sortIcon field="examTitle" /></th>
                <th pSortableColumn="subjectName">Subject <p-sortIcon field="subjectName" /></th>
                <th pSortableColumn="submission.score">Score <p-sortIcon field="submission.score" /></th>
                <th pSortableColumn="submission.percentage">% <p-sortIcon field="submission.percentage" /></th>
                <th>Result</th>
                <th>Status</th>
                <th pSortableColumn="submission.submittedAt">Submitted <p-sortIcon field="submission.submittedAt" /></th>
                <th style="width: 100px">Actions</th>
              </tr>
            </ng-template>
            <ng-template #body let-result>
              <tr>
                <td>
                  <div class="student-cell">
                    <span class="student-name">{{ result.studentName }}</span>
                    <span class="student-email">{{ result.studentEmail }}</span>
                  </div>
                </td>
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
                      [style]="{ height: '6px', width: '60px' }"
                    />
                    <span>{{ result.submission.percentage }}%</span>
                  </div>
                </td>
                <td>
                  <p-tag
                    [value]="result.passed ? 'Passed' : 'Failed'"
                    [severity]="result.passed ? 'success' : 'danger'"
                    [style]="{ minWidth: '60px' }"
                  />
                </td>
                <td>
                  <p-tag
                    [value]="getStatusLabel(result.submission.status)"
                    [severity]="getStatusSeverity(result.submission.status)"
                  />
                </td>
                <td>
                  @if (result.submission.submittedAt) {
                    {{ result.submission.submittedAt | date:'short' }}
                  } @else {
                    <span class="text-secondary">In Progress</span>
                  }
                </td>
                <td>
                  <div class="action-buttons">
                    <p-button
                      icon="pi pi-eye"
                      [rounded]="true"
                      [text]="true"
                      pTooltip="View Details"
                      tooltipPosition="left"
                      (click)="viewDetails(result)"
                    />
                    @if (result.submission.status === 'submitted' || result.submission.status === 'auto_submitted') {
                      <p-button
                        icon="pi pi-check-square"
                        [rounded]="true"
                        [text]="true"
                        severity="success"
                        pTooltip="Evaluate"
                        tooltipPosition="left"
                        (click)="viewDetails(result)"
                      />
                    }
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>
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

    /* Filters Card */
    :host ::ng-deep .filters-card { margin-bottom: 1.5rem; }
    :host ::ng-deep .filters-card .p-card-body { padding: 1rem 1.5rem; }
    .filters-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      align-items: flex-end;
    }
    .filter-group { display: flex; flex-direction: column; gap: 0.375rem; }
    .filter-group--search { flex: 1; min-width: 200px; }
    .filter-group--action { align-self: flex-end; }
    .filter-label { font-size: 0.8125rem; font-weight: 500; color: var(--text-color-secondary); }
    :host ::ng-deep .filter-select { min-width: 180px; }

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
    .table-header__title { 
      margin: 0; 
      font-size: 1.125rem; 
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .table-header__count {
      font-size: 0.875rem;
      font-weight: 400;
      color: var(--text-color-secondary);
    }

    .skeleton-table { padding: 1rem; }
    .skeleton-row {
      display: flex;
      gap: 2rem;
      padding: 1rem 0;
      border-bottom: 1px solid var(--surface-100);
    }

    /* Table Cells */
    .student-cell { display: flex; flex-direction: column; gap: 0.125rem; }
    .student-name { font-weight: 500; }
    .student-email { font-size: 0.8125rem; color: var(--text-color-secondary); }

    .exam-cell { display: flex; flex-direction: column; gap: 0.25rem; }
    .exam-title { font-weight: 500; }
    .attempt-badge {
      font-size: 0.6875rem;
      color: var(--orange-700);
      background: var(--orange-100);
      padding: 0.125rem 0.375rem;
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
    .percentage-cell { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
    :host ::ng-deep .percentage-bar .p-progressbar-value { background: var(--primary-color); }

    .text-secondary { color: var(--text-color-secondary); font-style: italic; font-size: 0.8125rem; }

    .action-buttons { display: flex; gap: 0.125rem; }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 4rem 2rem;
    }
    .empty-state__icon { font-size: 4rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 1rem; }
    .empty-state__title { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .empty-state__text { margin: 0; color: var(--text-color-secondary); }

    /* Responsive */
    @media (max-width: 768px) {
      .filters-row { flex-direction: column; }
      .filter-group { width: 100%; }
      :host ::ng-deep .filter-select { width: 100%; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherResultsComponent implements OnInit {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  // State
  readonly loading = signal(true);
  readonly results = signal<ResultItem[]>([]);
  
  // Raw data for building filter options
  private readonly exams = signal<ExamWithSubject[]>([]);
  private readonly students = signal<StudentWithUser[]>([]);

  // @REVIEW: Filter values as signals for reactive filtering
  readonly searchTerm = signal('');
  readonly subjectFilter = signal<string | null>(null);
  readonly examFilter = signal<string | null>(null);
  readonly studentFilter = signal<string | null>(null);
  readonly statusFilter = signal<string | null>(null);

  // @REVIEW: Status filter options
  readonly statusOptions: FilterOption[] = [
    { label: 'In Progress', value: 'in_progress' },
    { label: 'Submitted', value: 'submitted' },
    { label: 'Auto Submitted', value: 'auto_submitted' },
    { label: 'Evaluated', value: 'evaluated' },
    { label: 'Retake Allowed', value: 'retake_allowed' },
  ];

  // @REVIEW: Dynamic subject options from loaded data
  readonly subjectOptions = computed<FilterOption[]>(() => {
    const uniqueSubjects = new Map<string, string>();
    this.results().forEach(r => {
      if (r.subjectId) {
        uniqueSubjects.set(r.subjectId, r.subjectName);
      }
    });
    return Array.from(uniqueSubjects.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  // @REVIEW: Dynamic exam options - filtered by selected subject
  readonly examOptions = computed<FilterOption[]>(() => {
    let items = this.results();
    
    // Filter by subject if selected
    const subjectId = this.subjectFilter();
    if (subjectId) {
      items = items.filter(r => r.subjectId === subjectId);
    }
    
    const uniqueExams = new Map<string, string>();
    items.forEach(r => {
      uniqueExams.set(r.examId, r.examTitle);
    });
    
    return Array.from(uniqueExams.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  // @REVIEW: Dynamic student options from loaded data
  readonly studentOptions = computed<FilterOption[]>(() => {
    const uniqueStudents = new Map<string, string>();
    this.results().forEach(r => {
      uniqueStudents.set(r.studentId, r.studentName);
    });
    return Array.from(uniqueStudents.entries())
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  // @REVIEW: Filtered results based on all active filters
  readonly filteredResults = computed(() => {
    let items = this.results();
    
    // Get filter values
    const subjectId = this.subjectFilter();
    const examId = this.examFilter();
    const studentId = this.studentFilter();
    const status = this.statusFilter();
    const search = this.searchTerm().toLowerCase().trim();
    
    // Filter by subject
    if (subjectId) {
      items = items.filter(r => r.subjectId === subjectId);
    }
    
    // Filter by exam
    if (examId) {
      items = items.filter(r => r.examId === examId);
    }
    
    // Filter by student
    if (studentId) {
      items = items.filter(r => r.studentId === studentId);
    }
    
    // Filter by status
    if (status) {
      items = items.filter(r => r.submission.status === status);
    }
    
    // Filter by search term
    if (search) {
      items = items.filter(r =>
        r.studentName.toLowerCase().includes(search) ||
        r.studentEmail.toLowerCase().includes(search) ||
        r.examTitle.toLowerCase().includes(search) ||
        r.subjectName.toLowerCase().includes(search)
      );
    }
    
    return items;
  });

  // @REVIEW: Stats computed from filtered results
  readonly statsCards = computed(() => {
    const items = this.filteredResults();
    const total = items.length;
    const passed = items.filter(r => r.passed).length;
    const pending = items.filter(r => 
      r.submission.status === 'submitted' || r.submission.status === 'auto_submitted'
    ).length;
    const avgScore = total > 0
      ? Math.round(items.reduce((sum, r) => sum + r.submission.percentage, 0) / total)
      : 0;

    return [
      { icon: 'pi pi-file-edit', label: 'Total Submissions', value: total, color: 'var(--primary-color)' },
      { icon: 'pi pi-clock', label: 'Pending Review', value: pending, color: 'var(--orange-500)' },
      { icon: 'pi pi-check-circle', label: 'Passed', value: passed, color: 'var(--green-500)' },
      { icon: 'pi pi-chart-line', label: 'Avg Score', value: `${avgScore}%`, color: 'var(--blue-500)' },
    ];
  });

  ngOnInit(): void {
    this.loadResults();
  }

  // @REVIEW: Check if any filters are active
  readonly hasActiveFilters = computed(() => {
    return !!(this.subjectFilter() || this.examFilter() || this.studentFilter() || this.statusFilter() || this.searchTerm());
  });

  // @REVIEW: Clear all filters
  clearFilters(): void {
    this.subjectFilter.set(null);
    this.examFilter.set(null);
    this.studentFilter.set(null);
    this.statusFilter.set(null);
    this.searchTerm.set('');
  }

  // @REVIEW: When subject changes, clear exam filter if it doesn't match
  onSubjectChange(): void {
    const currentExam = this.examFilter();
    if (currentExam) {
      const result = this.results().find(r => r.examId === currentExam);
      const newSubject = this.subjectFilter();
      if (result && newSubject && result.subjectId !== newSubject) {
        this.examFilter.set(null);
      }
    }
  }

  // @REVIEW: Load all submissions for teacher's exams
  private loadResults(): void {
    const teacherId = this.authStore.teacherId();
    if (!teacherId) {
      this.loading.set(false);
      return;
    }

    // First get all teacher's exams
    this.db.exams.getByTeacher(teacherId, { page: 1, pageSize: 500 }).subscribe({
      next: (examResponse) => {
        const exams = examResponse.items;
        this.exams.set(exams);
        
        if (exams.length === 0) {
          this.results.set([]);
          this.loading.set(false);
          return;
        }

        // Build exam lookup map
        const examMap = new Map<string, ExamWithSubject>();
        exams.forEach(e => examMap.set(e.id, e));

        // Get submissions for all exams
        const submissionRequests = exams.map(exam =>
          this.db.submissions.getByExam(exam.id, { page: 1, pageSize: 500 })
        );

        forkJoin(submissionRequests).subscribe({
          next: (submissionResponses) => {
            // Flatten all submissions
            const allSubmissions = submissionResponses.flatMap(r => r.items);
            
            if (allSubmissions.length === 0) {
              this.results.set([]);
              this.loading.set(false);
              return;
            }

            // Get unique student IDs
            const studentIds = [...new Set(allSubmissions.map(s => s.studentId))];
            
            // Fetch all students
            const studentRequests = studentIds.map(id => this.db.students.getById(id));
            
            forkJoin(studentRequests).subscribe({
              next: (students) => {
                // Build student lookup map
                const studentMap = new Map<string, StudentWithUser>();
                students.forEach(s => {
                  if (s) {
                    studentMap.set(s.id, s);
                  }
                });
                this.students.set(students.filter((s): s is StudentWithUser => s !== null));

                // Build result items
                const resultItems: ResultItem[] = allSubmissions
                  .map(sub => {
                    const exam = examMap.get(sub.examId);
                    const student = studentMap.get(sub.studentId);
                    
                    if (!exam || !student) return null;

                    return {
                      submission: sub,
                      examId: exam.id,
                      examTitle: exam.title,
                      subjectId: exam.subjectId,
                      subjectName: exam.subject?.name ?? 'Independent Exam',
                      subjectColor: exam.subject?.color ?? '#6b7280',
                      studentId: student.id,
                      studentName: student.user.fullName,
                      studentEmail: student.user.email,
                      totalMarks: exam.totalMarks,
                      passingMarks: exam.passingMarks,
                      passed: sub.score >= exam.passingMarks,
                    };
                  })
                  .filter((item): item is ResultItem => item !== null)
                  .sort((a, b) => {
                    const dateA = a.submission.submittedAt?.getTime() ?? a.submission.startedAt.getTime();
                    const dateB = b.submission.submittedAt?.getTime() ?? b.submission.startedAt.getTime();
                    return dateB - dateA;
                  });

                this.results.set(resultItems);
                this.loading.set(false);
              },
              error: (err) => {
                console.error('Failed to load students:', err);
                this.loading.set(false);
              },
            });
          },
          error: (err) => {
            console.error('Failed to load submissions:', err);
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        console.error('Failed to load exams:', err);
        this.loading.set(false);
      },
    });
  }

  // @REVIEW: Navigate to submission detail page
  viewDetails(result: ResultItem): void {
    this.router.navigate(['/teacher/results', result.submission.id]);
  }

  // @REVIEW: Get human-readable status label
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'in_progress': 'In Progress',
      'submitted': 'Submitted',
      'auto_submitted': 'Auto Submitted',
      'evaluated': 'Evaluated',
      'retake_allowed': 'Retake Allowed',
    };
    return labels[status] ?? status;
  }

  // @REVIEW: Get PrimeNG severity for status
  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast' {
    const severities: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'> = {
      'in_progress': 'warn',
      'submitted': 'info',
      'auto_submitted': 'info',
      'evaluated': 'success',
      'retake_allowed': 'secondary',
    };
    return severities[status] ?? 'info';
  }
}
