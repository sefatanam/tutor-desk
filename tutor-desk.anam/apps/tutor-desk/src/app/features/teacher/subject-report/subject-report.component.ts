// @REVIEW: Subject Report - Comprehensive report of all students' exam performance in a subject
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { Subject, Exam, StudentWithUser, ExamSubmission } from '../../../core/models';

// @REVIEW: Student performance summary across all exams in subject
interface StudentPerformance {
  readonly student: StudentWithUser;
  readonly totalExams: number;
  readonly examsTaken: number;
  readonly totalScore: number;
  readonly totalMarks: number;
  readonly averagePercentage: number;
  readonly passed: number;
  readonly failed: number;
  readonly submissions: ExamSubmissionSummary[];
}

// @REVIEW: Summary of a single submission
interface ExamSubmissionSummary {
  readonly examId: string;
  readonly examTitle: string;
  readonly submission: ExamSubmission | null;
  readonly totalMarks: number;
  readonly passingMarks: number;
}

// @REVIEW: Exam performance stats
interface ExamPerformanceStats {
  readonly exam: Exam;
  readonly totalStudents: number;
  readonly submitted: number;
  readonly passed: number;
  readonly failed: number;
  readonly averageScore: number;
  readonly highestScore: number;
  readonly lowestScore: number;
}

@Component({
  selector: 'app-subject-report',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SkeletonModule,
    ProgressBarModule,
    SelectModule,
    TabsModule,
  ],
  template: `
    <div class="report-page">
      <!-- Navigation -->
      <div class="page-nav">
        <p-button
          icon="pi pi-arrow-left"
          label="Back to Subjects"
          [text]="true"
          routerLink="/teacher/subjects"
        />
      </div>

      @if (loading()) {
        <div class="loading-container">
          <p-skeleton width="350px" height="36px" styleClass="mb-3" />
          <p-skeleton width="200px" height="20px" styleClass="mb-4" />
          <div class="stats-row">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <p-skeleton width="100%" height="100px" />
            }
          </div>
        </div>
      } @else if (!subject()) {
        <div class="not-found">
          <i class="pi pi-exclamation-circle"></i>
          <h2>Subject Not Found</h2>
          <p>The subject you're looking for doesn't exist.</p>
          <p-button label="Go to Subjects" routerLink="/teacher/subjects" />
        </div>
      } @else {
        <!-- Header -->
        <header class="page-header">
          <div class="header-info">
            <div class="subject-icon" [style.background]="subject()!.color">
              <i [class]="'pi ' + subject()!.icon"></i>
            </div>
            <div class="subject-details">
              <h1 class="subject-name">{{ subject()!.name }} - Performance Report</h1>
              @if (subject()!.code) {
                <span class="subject-code">{{ subject()!.code }}</span>
              }
            </div>
          </div>
          <div class="header-actions">
            <p-button
              icon="pi pi-download"
              label="Export Report"
              severity="secondary"
              (click)="exportReport()"
            />
          </div>
        </header>

        <!-- Overall Stats -->
        <section class="stats-row">
          <p-card styleClass="stat-card primary">
            <div class="stat-content">
              <i class="pi pi-users"></i>
              <div class="stat-text">
                <span class="stat-value">{{ enrolledStudents().length }}</span>
                <span class="stat-label">Enrolled Students</span>
              </div>
            </div>
          </p-card>
          <p-card styleClass="stat-card purple">
            <div class="stat-content">
              <i class="pi pi-file-edit"></i>
              <div class="stat-text">
                <span class="stat-value">{{ exams().length }}</span>
                <span class="stat-label">Total Exams</span>
              </div>
            </div>
          </p-card>
          <p-card styleClass="stat-card green">
            <div class="stat-content">
              <i class="pi pi-check-circle"></i>
              <div class="stat-text">
                <span class="stat-value">{{ overallPassRate() }}%</span>
                <span class="stat-label">Pass Rate</span>
              </div>
            </div>
          </p-card>
          <p-card styleClass="stat-card blue">
            <div class="stat-content">
              <i class="pi pi-chart-line"></i>
              <div class="stat-text">
                <span class="stat-value">{{ overallAverageScore() }}%</span>
                <span class="stat-label">Avg Score</span>
              </div>
            </div>
          </p-card>
          <p-card styleClass="stat-card orange">
            <div class="stat-content">
              <i class="pi pi-percentage"></i>
              <div class="stat-text">
                <span class="stat-value">{{ participationRate() }}%</span>
                <span class="stat-label">Participation</span>
              </div>
            </div>
          </p-card>
        </section>

        <!-- Tabs for different views -->
        <p-tabs value="0">
          <p-tablist>
            <p-tab value="0">
              <i class="pi pi-users"></i>
              Student Performance
            </p-tab>
            <p-tab value="1">
              <i class="pi pi-file-edit"></i>
              Exam-wise Analysis
            </p-tab>
          </p-tablist>

          <p-tabpanels>
            <!-- Student Performance Tab -->
            <p-tabpanel value="0">
              <p-card styleClass="table-card">
                <ng-template #header>
                  <div class="table-header">
                    <h3>Student Performance Summary</h3>
                    <p-iconfield>
                      <p-inputicon styleClass="pi pi-search" />
                      <input
                        type="text"
                        pInputText
                        placeholder="Search students..."
                        [(ngModel)]="studentSearchTerm"
                      />
                    </p-iconfield>
                  </div>
                </ng-template>

                @if (filteredStudentPerformance().length === 0) {
                  <div class="empty-state">
                    <i class="pi pi-users"></i>
                    <p>No students enrolled in this subject</p>
                  </div>
                } @else {
                  <p-table
                    [value]="filteredStudentPerformance()"
                    [paginator]="filteredStudentPerformance().length > 10"
                    [rows]="10"
                    [rowsPerPageOptions]="[10, 25, 50]"
                    styleClass="p-datatable-sm"
                    sortField="averagePercentage"
                    [sortOrder]="-1"
                  >
                    <ng-template #header>
                      <tr>
                        <th pSortableColumn="student.user.fullName">Student <p-sortIcon field="student.user.fullName" /></th>
                        <th pSortableColumn="examsTaken">Exams Taken <p-sortIcon field="examsTaken" /></th>
                        <th pSortableColumn="averagePercentage">Avg Score <p-sortIcon field="averagePercentage" /></th>
                        <th pSortableColumn="passed">Passed <p-sortIcon field="passed" /></th>
                        <th pSortableColumn="failed">Failed <p-sortIcon field="failed" /></th>
                        <th>Progress</th>
                        <th>Actions</th>
                      </tr>
                    </ng-template>
                    <ng-template #body let-perf>
                      <tr>
                        <td>
                          <div class="student-cell">
                            <div class="student-avatar" [style.background]="getAvatarColor(perf.student.user.fullName)">
                              {{ getInitials(perf.student.user.fullName) }}
                            </div>
                            <div class="student-info">
                              <span class="student-name">{{ perf.student.user.fullName }}</span>
                              <span class="student-email">{{ perf.student.user.email }}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span class="exams-count">{{ perf.examsTaken }} / {{ perf.totalExams }}</span>
                        </td>
                        <td>
                          <div class="score-cell">
                            <span class="score-value" [class.good]="perf.averagePercentage >= 60">
                              {{ perf.averagePercentage }}%
                            </span>
                          </div>
                        </td>
                        <td>
                          <p-tag [value]="perf.passed.toString()" severity="success" />
                        </td>
                        <td>
                          <p-tag [value]="perf.failed.toString()" severity="danger" />
                        </td>
                        <td>
                          <div class="progress-cell">
                            <p-progressBar
                              [value]="perf.averagePercentage"
                              [showValue]="false"
                              styleClass="progress-bar"
                            />
                          </div>
                        </td>
                        <td>
                          <p-button
                            icon="pi pi-eye"
                            [rounded]="true"
                            [text]="true"
                            pTooltip="View Details"
                            [routerLink]="['/teacher/students', perf.student.id]"
                          />
                        </td>
                      </tr>
                    </ng-template>
                  </p-table>
                }
              </p-card>

              <!-- Detailed Exam Matrix -->
              @if (exams().length > 0 && studentPerformance().length > 0) {
                <p-card styleClass="matrix-card">
                  <ng-template #header>
                    <div class="table-header">
                      <h3>Exam-wise Scores Matrix</h3>
                    </div>
                  </ng-template>

                  <div class="matrix-container">
                    <table class="score-matrix">
                      <thead>
                        <tr>
                          <th class="student-col">Student</th>
                          @for (exam of exams(); track exam.id) {
                            <th class="exam-col" [pTooltip]="exam.title">
                              {{ exam.title | slice:0:15 }}{{ exam.title.length > 15 ? '...' : '' }}
                            </th>
                          }
                          <th class="avg-col">Average</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (perf of studentPerformance(); track perf.student.id) {
                          <tr>
                            <td class="student-col">
                              <span class="matrix-student">{{ perf.student.user.fullName }}</span>
                            </td>
                            @for (examSub of perf.submissions; track examSub.examId) {
                              <td class="score-col">
                                @if (examSub.submission) {
                                  <span
                                    class="matrix-score"
                                    [class.passed]="examSub.submission.score >= examSub.passingMarks"
                                    [class.failed]="examSub.submission.score < examSub.passingMarks"
                                    [pTooltip]="examSub.submission.score + '/' + examSub.totalMarks"
                                    [routerLink]="['/teacher/submissions', examSub.submission.id]"
                                  >
                                    {{ examSub.submission.percentage }}%
                                  </span>
                                } @else {
                                  <span class="matrix-score not-taken">-</span>
                                }
                              </td>
                            }
                            <td class="avg-col">
                              <span class="matrix-avg" [class.good]="perf.averagePercentage >= 60">
                                {{ perf.averagePercentage }}%
                              </span>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </p-card>
              }
            </p-tabpanel>

            <!-- Exam-wise Analysis Tab -->
            <p-tabpanel value="1">
              <p-card styleClass="table-card">
                <ng-template #header>
                  <div class="table-header">
                    <h3>Exam Performance Analysis</h3>
                  </div>
                </ng-template>

                @if (examStats().length === 0) {
                  <div class="empty-state">
                    <i class="pi pi-file-edit"></i>
                    <p>No exams in this subject</p>
                  </div>
                } @else {
                  <p-table
                    [value]="examStats()"
                    styleClass="p-datatable-sm"
                    sortField="exam.createdAt"
                    [sortOrder]="-1"
                  >
                    <ng-template #header>
                      <tr>
                        <th pSortableColumn="exam.title">Exam <p-sortIcon field="exam.title" /></th>
                        <th>Status</th>
                        <th pSortableColumn="submitted">Submissions <p-sortIcon field="submitted" /></th>
                        <th pSortableColumn="passed">Passed <p-sortIcon field="passed" /></th>
                        <th pSortableColumn="averageScore">Avg Score <p-sortIcon field="averageScore" /></th>
                        <th>Score Range</th>
                        <th>Pass Rate</th>
                        <th>Actions</th>
                      </tr>
                    </ng-template>
                    <ng-template #body let-stat>
                      <tr>
                        <td>
                          <div class="exam-cell">
                            <span class="exam-title">{{ stat.exam.title }}</span>
                            <span class="exam-meta">{{ stat.exam.totalQuestions }} Q • {{ stat.exam.totalMarks }} marks</span>
                          </div>
                        </td>
                        <td>
                          <p-tag
                            [value]="stat.exam.status"
                            [severity]="getExamStatusSeverity(stat.exam.status)"
                          />
                        </td>
                        <td>
                          <span class="submission-count">
                            {{ stat.submitted }} / {{ stat.totalStudents }}
                          </span>
                        </td>
                        <td>
                          <div class="pass-fail">
                            <span class="passed">{{ stat.passed }}</span>
                            <span class="separator">/</span>
                            <span class="failed">{{ stat.failed }}</span>
                          </div>
                        </td>
                        <td>
                          <span class="avg-score" [class.good]="stat.averageScore >= 60">
                            {{ stat.averageScore }}%
                          </span>
                        </td>
                        <td>
                          @if (stat.submitted > 0) {
                            <span class="score-range">
                              {{ stat.lowestScore }}% - {{ stat.highestScore }}%
                            </span>
                          } @else {
                            <span class="no-data">-</span>
                          }
                        </td>
                        <td>
                          @if (stat.submitted > 0) {
                            <div class="pass-rate">
                              <p-progressBar
                                [value]="getPassRate(stat)"
                                [showValue]="false"
                                styleClass="pass-rate-bar"
                              />
                              <span>{{ getPassRate(stat) }}%</span>
                            </div>
                          } @else {
                            <span class="no-data">-</span>
                          }
                        </td>
                        <td>
                          <p-button
                            icon="pi pi-chart-bar"
                            [rounded]="true"
                            [text]="true"
                            pTooltip="View Results"
                            [routerLink]="['/teacher/exams', stat.exam.id, 'results']"
                          />
                        </td>
                      </tr>
                    </ng-template>
                  </p-table>
                }
              </p-card>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      }
    </div>
  `,
  styles: `
    .report-page { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }

    .page-nav { margin-bottom: 1.5rem; }

    .loading-container { padding: 2rem 0; }

    .not-found {
      display: flex; flex-direction: column; align-items: center;
      padding: 4rem 2rem; text-align: center;
    }
    .not-found i { font-size: 4rem; color: var(--text-color-secondary); margin-bottom: 1rem; }

    /* Header */
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;
    }
    .header-info { display: flex; align-items: center; gap: 1rem; }
    .subject-icon {
      width: 56px; height: 56px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.5rem;
    }
    .subject-details { display: flex; flex-direction: column; gap: 0.25rem; }
    .subject-name { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .subject-code {
      font-size: 0.875rem; color: var(--text-color-secondary);
      background: var(--surface-100); padding: 0.25rem 0.5rem;
      border-radius: 4px; width: fit-content;
    }

    /* Stats Row */
    .stats-row {
      display: grid; grid-template-columns: repeat(5, 1fr);
      gap: 1rem; margin-bottom: 1.5rem;
    }
    @media (max-width: 1024px) { .stats-row { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 640px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    :host ::ng-deep .stat-card.primary { border-left: 4px solid var(--primary-color); }
    :host ::ng-deep .stat-card.purple { border-left: 4px solid var(--purple-500); }
    :host ::ng-deep .stat-card.green { border-left: 4px solid var(--green-500); }
    :host ::ng-deep .stat-card.blue { border-left: 4px solid var(--blue-500); }
    :host ::ng-deep .stat-card.orange { border-left: 4px solid var(--orange-500); }
    .stat-content { display: flex; align-items: center; gap: 1rem; }
    .stat-content i { font-size: 1.5rem; color: var(--text-color-secondary); }
    .stat-text { display: flex; flex-direction: column; }
    .stat-value { font-size: 1.5rem; font-weight: 700; }
    .stat-label { font-size: 0.8125rem; color: var(--text-color-secondary); }

    /* Tabs */
    :host ::ng-deep .p-tabs { margin-bottom: 1.5rem; }
    :host ::ng-deep .p-tablist { margin-bottom: 1rem; }
    :host ::ng-deep .p-tab { display: flex; align-items: center; gap: 0.5rem; }

    /* Table Card */
    .table-card { margin-bottom: 1.5rem; }
    :host ::ng-deep .table-card .p-card-body { padding: 0; }
    :host ::ng-deep .table-card .p-card-content { padding: 0; }
    .table-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--surface-border);
    }
    .table-header h3 { margin: 0; font-size: 1rem; font-weight: 600; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center;
      padding: 3rem; color: var(--text-color-secondary);
    }
    .empty-state i { font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.5; }

    /* Student Cell */
    .student-cell { display: flex; align-items: center; gap: 0.75rem; }
    .student-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 0.8125rem;
    }
    .student-info { display: flex; flex-direction: column; }
    .student-name { font-weight: 500; }
    .student-email { font-size: 0.75rem; color: var(--text-color-secondary); }

    .exams-count { font-weight: 500; }
    .score-cell .score-value { font-weight: 600; color: var(--red-500); }
    .score-cell .score-value.good { color: var(--green-500); }

    .progress-cell { width: 100px; }
    :host ::ng-deep .progress-bar { height: 8px; border-radius: 4px; }

    /* Exam Cell */
    .exam-cell { display: flex; flex-direction: column; gap: 0.125rem; }
    .exam-title { font-weight: 500; }
    .exam-meta { font-size: 0.75rem; color: var(--text-color-secondary); }

    .submission-count { font-weight: 500; }

    .pass-fail { display: flex; gap: 0.25rem; }
    .pass-fail .passed { color: var(--green-600); font-weight: 600; }
    .pass-fail .failed { color: var(--red-600); font-weight: 600; }
    .pass-fail .separator { color: var(--text-color-secondary); }

    .avg-score { font-weight: 600; color: var(--red-500); }
    .avg-score.good { color: var(--green-500); }

    .score-range { font-size: 0.875rem; color: var(--text-color-secondary); }
    .no-data { color: var(--text-color-secondary); }

    .pass-rate { display: flex; align-items: center; gap: 0.5rem; }
    :host ::ng-deep .pass-rate-bar { width: 60px; height: 8px; }

    /* Matrix */
    .matrix-card { margin-top: 1.5rem; }
    :host ::ng-deep .matrix-card .p-card-body { padding: 0; }
    :host ::ng-deep .matrix-card .p-card-content { padding: 0; }
    .matrix-container { overflow-x: auto; }
    .score-matrix {
      width: 100%; border-collapse: collapse;
      font-size: 0.875rem;
    }
    .score-matrix th, .score-matrix td {
      padding: 0.75rem 0.5rem;
      border-bottom: 1px solid var(--surface-border);
      text-align: center;
    }
    .score-matrix th { background: var(--surface-50); font-weight: 600; }
    .score-matrix .student-col { text-align: left; min-width: 180px; }
    .score-matrix .exam-col { min-width: 80px; font-size: 0.75rem; }
    .score-matrix .avg-col { min-width: 80px; background: var(--surface-50); }
    .matrix-student { font-weight: 500; }
    .matrix-score {
      display: inline-block; padding: 0.25rem 0.5rem;
      border-radius: 4px; font-weight: 500; cursor: pointer;
      transition: transform 0.2s;
    }
    .matrix-score:hover { transform: scale(1.1); }
    .matrix-score.passed { background: var(--green-100); color: var(--green-700); }
    .matrix-score.failed { background: var(--red-100); color: var(--red-700); }
    .matrix-score.not-taken { color: var(--text-color-secondary); cursor: default; }
    .matrix-score.not-taken:hover { transform: none; }
    .matrix-avg { font-weight: 600; }
    .matrix-avg.good { color: var(--green-600); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectReportComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(SupabaseDatabaseAdapter);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly subject = signal<Subject | null>(null);
  readonly exams = signal<Exam[]>([]);
  readonly enrolledStudents = signal<StudentWithUser[]>([]);
  readonly studentPerformance = signal<StudentPerformance[]>([]);
  readonly examStats = signal<ExamPerformanceStats[]>([]);

  studentSearchTerm = '';

  // Computed
  readonly filteredStudentPerformance = computed(() => {
    const search = this.studentSearchTerm.toLowerCase().trim();
    if (!search) return this.studentPerformance();
    return this.studentPerformance().filter(p =>
      p.student.user.fullName.toLowerCase().includes(search) ||
      p.student.user.email.toLowerCase().includes(search)
    );
  });

  readonly overallPassRate = computed(() => {
    const perfs = this.studentPerformance();
    const totalPassed = perfs.reduce((sum, p) => sum + p.passed, 0);
    const totalTaken = perfs.reduce((sum, p) => sum + p.examsTaken, 0);
    return totalTaken > 0 ? Math.round((totalPassed / totalTaken) * 100) : 0;
  });

  readonly overallAverageScore = computed(() => {
    const perfs = this.studentPerformance().filter(p => p.examsTaken > 0);
    if (perfs.length === 0) return 0;
    return Math.round(perfs.reduce((sum, p) => sum + p.averagePercentage, 0) / perfs.length);
  });

  readonly participationRate = computed(() => {
    const totalStudents = this.enrolledStudents().length;
    const totalExams = this.exams().length;
    if (totalStudents === 0 || totalExams === 0) return 0;

    const totalPossible = totalStudents * totalExams;
    const totalTaken = this.studentPerformance().reduce((sum, p) => sum + p.examsTaken, 0);
    return Math.round((totalTaken / totalPossible) * 100);
  });

  ngOnInit(): void {
    const subjectId = this.route.snapshot.paramMap.get('id');
    if (subjectId) {
      this.loadReport(subjectId);
    } else {
      this.loading.set(false);
    }
  }

  private loadReport(subjectId: string): void {
    // Load subject, exams, and enrolled students
    forkJoin({
      subject: this.db.subjects.getById(subjectId),
      exams: this.db.exams.getBySubject(subjectId, { page: 1, pageSize: 100 }),
      students: this.db.subjects.getEnrolledStudents(subjectId),
    }).pipe(
      switchMap(({ subject, exams, students }) => {
        if (!subject) {
          return of({ subject: null, exams: [], students: [], submissions: [] });
        }

        this.subject.set(subject);
        this.exams.set(exams.items);
        this.enrolledStudents.set(students);

        if (exams.items.length === 0 || students.length === 0) {
          return of({ subject, exams: exams.items, students, submissions: [] as ExamSubmission[][] });
        }

        // Load submissions for each exam
        const submissionRequests = exams.items.map(exam =>
          this.db.submissions.getByExam(exam.id, { page: 1, pageSize: 500 })
        );

        return forkJoin(submissionRequests).pipe(
          switchMap(submissionResponses => {
            const allSubmissions = submissionResponses.flatMap(r => r.items);
            return of({ subject, exams: exams.items, students, submissions: allSubmissions });
          })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ subject, exams, students, submissions }) => {
        if (!subject) {
          this.loading.set(false);
          return;
        }

        // Build student performance data
        const submissionsByStudent = new Map<string, ExamSubmission[]>();
        (submissions as ExamSubmission[]).forEach(sub => {
          const existing = submissionsByStudent.get(sub.studentId) ?? [];
          existing.push(sub);
          submissionsByStudent.set(sub.studentId, existing);
        });

        const studentPerfs: StudentPerformance[] = students.map(student => {
          const studentSubs = submissionsByStudent.get(student.id) ?? [];
          const completedSubs = studentSubs.filter(s =>
            s.status === 'submitted' || s.status === 'auto_submitted' || s.status === 'evaluated'
          );

          const examSubmissions: ExamSubmissionSummary[] = exams.map(exam => {
            const sub = completedSubs.find(s => s.examId === exam.id) ?? null;
            return {
              examId: exam.id,
              examTitle: exam.title,
              submission: sub,
              totalMarks: exam.totalMarks,
              passingMarks: exam.passingMarks,
            };
          });

          const passed = examSubmissions.filter(es =>
            es.submission && es.submission.score >= es.passingMarks
          ).length;

          const totalScore = completedSubs.reduce((sum, s) => sum + s.score, 0);
          const totalMarks = examSubmissions
            .filter(es => es.submission)
            .reduce((sum, es) => sum + es.totalMarks, 0);

          const avgPercentage = completedSubs.length > 0
            ? Math.round(completedSubs.reduce((sum, s) => sum + s.percentage, 0) / completedSubs.length)
            : 0;

          return {
            student,
            totalExams: exams.length,
            examsTaken: completedSubs.length,
            totalScore,
            totalMarks,
            averagePercentage: avgPercentage,
            passed,
            failed: completedSubs.length - passed,
            submissions: examSubmissions,
          };
        });

        this.studentPerformance.set(studentPerfs);

        // Build exam stats
        const examStatsData: ExamPerformanceStats[] = exams.map(exam => {
          const examSubs = (submissions as ExamSubmission[]).filter(s =>
            s.examId === exam.id &&
            (s.status === 'submitted' || s.status === 'auto_submitted' || s.status === 'evaluated')
          );

          const passed = examSubs.filter(s => s.score >= exam.passingMarks).length;
          const avgScore = examSubs.length > 0
            ? Math.round(examSubs.reduce((sum, s) => sum + s.percentage, 0) / examSubs.length)
            : 0;
          const highestScore = examSubs.length > 0
            ? Math.max(...examSubs.map(s => s.percentage))
            : 0;
          const lowestScore = examSubs.length > 0
            ? Math.min(...examSubs.map(s => s.percentage))
            : 0;

          return {
            exam,
            totalStudents: students.length,
            submitted: examSubs.length,
            passed,
            failed: examSubs.length - passed,
            averageScore: avgScore,
            highestScore,
            lowestScore,
          };
        });

        this.examStats.set(examStatsData);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load report:', err);
        this.loading.set(false);
      },
    });
  }

  getPassRate(stat: ExamPerformanceStats): number {
    return stat.submitted > 0 ? Math.round((stat.passed / stat.submitted) * 100) : 0;
  }

  exportReport(): void {
    // Generate CSV export
    const subject = this.subject();
    const perfs = this.studentPerformance();
    const examList = this.exams();

    if (!subject || perfs.length === 0) return;

    // Build CSV header
    const headers = ['Student Name', 'Email', 'Exams Taken', 'Average %', 'Passed', 'Failed'];
    examList.forEach(e => headers.push(e.title));

    // Build CSV rows
    const rows = perfs.map(p => {
      const row = [
        p.student.user.fullName,
        p.student.user.email,
        p.examsTaken.toString(),
        p.averagePercentage.toString() + '%',
        p.passed.toString(),
        p.failed.toString(),
      ];
      p.submissions.forEach(es => {
        row.push(es.submission ? es.submission.percentage + '%' : '-');
      });
      return row;
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(',')),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${subject.name}_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  getAvatarColor(name: string): string {
    const colors = [
      '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  getExamStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      draft: 'secondary',
      scheduled: 'info',
      active: 'success',
      completed: 'warn',
      cancelled: 'danger',
    };
    return map[status] ?? 'secondary';
  }
}
