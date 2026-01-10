// @REVIEW: Student Submission Review - View own exam submission with visibility settings
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { ProgressBarModule } from 'primeng/progressbar';
import { MessageModule } from 'primeng/message';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { PdfExportService, PdfQuestionItem } from '../../../core/services/pdf-export.service';
import { CsvExportService } from '../../../core/services/csv-export.service';
import {
  ExamSubmissionWithDetails,
  Question,
  SubmissionAnswer,
  QuestionOption,
  Subject,
  Exam,
  StudentWithUser,
} from '../../../core/models';
import {
  getResultDisplaySettings,
  getResultAvailabilityMessage,
  ResultDisplaySettings,
} from '../../../core/utils/result-visibility.util';

// @REVIEW: Question review item for student view
interface QuestionReviewItem {
  readonly question: Question;
  readonly answer: SubmissionAnswer | null;
  readonly selectedOption: QuestionOption | null;
  readonly correctOption: QuestionOption;
  readonly status: 'correct' | 'wrong' | 'skipped' | 'unanswered';
  readonly marksObtained: number;
  readonly timeSpent: number;
}

@Component({
  selector: 'app-submission-review',
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    SkeletonModule,
    DividerModule,
    ProgressBarModule,
    MessageModule,
    MenuModule,
  ],
  template: `
    <div class="submission-review-page">
      <!-- Navigation -->
      <div class="page-nav">
        <p-button
          icon="pi pi-arrow-left"
          label="Back to Results"
          [text]="true"
          routerLink="/student/results"
        />
      </div>

      @if (loading()) {
        <!-- Loading State -->
        <div class="loading-container">
          <p-skeleton width="400px" height="32px" styleClass="mb-3" />
          <p-skeleton width="250px" height="20px" styleClass="mb-4" />
          <div class="stats-row">
            @for (i of [1, 2, 3, 4]; track i) {
              <p-skeleton width="100%" height="100px" />
            }
          </div>
        </div>
      } @else if (!submission()) {
        <!-- Not Found -->
        <div class="not-found">
          <i class="pi pi-exclamation-circle"></i>
          <h2>Submission Not Found</h2>
          <p>The submission you're looking for doesn't exist or you don't have access to it.</p>
          <p-button label="Go to Results" routerLink="/student/results" />
        </div>
      } @else if (!displaySettings().canViewResults) {
        <!-- Results Not Available -->
        <div class="results-not-available">
          <i class="pi pi-lock"></i>
          <h2>Results Not Available Yet</h2>
          <p>{{ availabilityMessage() }}</p>
          <p-button label="Go to Results" routerLink="/student/results" severity="secondary" />
        </div>
      } @else {
        <!-- Header -->
        <header class="page-header">
          <div class="header-info">
            <h1 class="exam-title">{{ submission()!.exam.title }}</h1>
            @if (subject()) {
              <span class="subject-badge" [style.background]="subject()!.color">
                {{ subject()!.name }}
              </span>
            } @else {
              <span class="subject-badge" style="background: #6b7280">
                Independent Exam
              </span>
            }
          </div>
          @if (displaySettings().showPassFail) {
            <p-tag
              [value]="submission()!.score >= submission()!.exam.passingMarks ? 'PASSED' : 'FAILED'"
              [severity]="submission()!.score >= submission()!.exam.passingMarks ? 'success' : 'danger'"
              styleClass="result-tag"
            />
          }
          <!-- @REVIEW: Export dropdown menu for PDF/CSV -->
          <p-menu #exportMenu [model]="exportMenuItems()" [popup]="true" />
          <p-button
            icon="pi pi-download"
            label="Export"
            severity="secondary"
            [outlined]="true"
            (click)="exportMenu.toggle($event)"
          />
        </header>

        <!-- Score Summary - Conditional based on visibility -->
        @if (displaySettings().showScore || displaySettings().showPercentage) {
          <section class="score-section">
            <div class="score-display">
              @if (displaySettings().showScore) {
                <div class="score-main-block">
                  <span class="score-value" [class.passed]="submission()!.score >= submission()!.exam.passingMarks">
                    {{ submission()!.score }}
                  </span>
                  <span class="score-divider">/</span>
                  <span class="score-total">{{ submission()!.exam.totalMarks }}</span>
                </div>
              }
              @if (displaySettings().showPercentage) {
                <div class="percentage-block">
                  <span class="percentage-value">{{ submission()!.percentage }}%</span>
                  <p-progressBar
                    [value]="submission()!.percentage"
                    [showValue]="false"
                    styleClass="score-progress"
                  />
                </div>
              }
            </div>
          </section>
        }

        <!-- Stats Cards - Conditional -->
        <section class="stats-row">
          @if (displaySettings().showScore) {
            <p-card styleClass="stat-card correct">
              <div class="stat-content">
                <i class="pi pi-check-circle"></i>
                <div class="stat-text">
                  <span class="stat-value">{{ submission()!.totalCorrect }}</span>
                  <span class="stat-label">Correct</span>
                </div>
              </div>
            </p-card>
            <p-card styleClass="stat-card wrong">
              <div class="stat-content">
                <i class="pi pi-times-circle"></i>
                <div class="stat-text">
                  <span class="stat-value">{{ submission()!.totalWrong }}</span>
                  <span class="stat-label">Wrong</span>
                </div>
              </div>
            </p-card>
            <p-card styleClass="stat-card skipped">
              <div class="stat-content">
                <i class="pi pi-minus-circle"></i>
                <div class="stat-text">
                  <span class="stat-value">{{ submission()!.totalSkipped }}</span>
                  <span class="stat-label">Skipped</span>
                </div>
              </div>
            </p-card>
          }
          @if (displaySettings().showTimeSpent) {
            <p-card styleClass="stat-card info">
              <div class="stat-content">
                <i class="pi pi-clock"></i>
                <div class="stat-text">
                  <span class="stat-value">{{ formatDuration(totalTimeSpent()) }}</span>
                  <span class="stat-label">Time Spent</span>
                </div>
              </div>
            </p-card>
          }
        </section>

        <!-- Submission Info -->
        <p-card styleClass="info-card">
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Attempt</span>
              <span class="info-value">#{{ submission()!.attemptNumber }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Started</span>
              <span class="info-value">{{ submission()!.startedAt | date:'medium' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Submitted</span>
              <span class="info-value">
                @if (submission()!.submittedAt) {
                  {{ submission()!.submittedAt | date:'medium' }}
                } @else {
                  <span class="text-muted">In Progress</span>
                }
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Status</span>
              <span class="info-value">
                <p-tag
                  [value]="getStatusLabel(submission()!.status)"
                  [severity]="getStatusSeverity(submission()!.status)"
                />
              </span>
            </div>
            @if (submission()!.autoSubmitReason) {
              <div class="info-item full-width">
                <span class="info-label">Auto-Submit Reason</span>
                <span class="info-value warning">{{ getAutoSubmitReasonLabel(submission()!.autoSubmitReason!) }}</span>
              </div>
            }
          </div>
        </p-card>

        <!-- Teacher Remarks - Read Only -->
        @if (displaySettings().showTeacherRemarks && submission()!.remarks) {
          <p-card styleClass="remarks-card">
            <ng-template #header>
              <div class="card-header">
                <h3><i class="pi pi-comment"></i> Teacher Remarks</h3>
              </div>
            </ng-template>
            <div class="remarks-content">
              <p class="remarks-text">{{ submission()!.remarks }}</p>
            </div>
          </p-card>
        }

        <!-- Rank Info -->
        @if (displaySettings().showRank && rank() !== null) {
          <p-card styleClass="rank-card">
            <div class="rank-content">
              <i class="pi pi-trophy"></i>
              <div class="rank-text">
                <span class="rank-label">Your Rank</span>
                <span class="rank-value">#{{ rank() }}</span>
                <span class="rank-total">out of {{ totalSubmissions() }} students</span>
              </div>
            </div>
          </p-card>
        }

        <!-- Questions Review - Conditional -->
        @if (displaySettings().showQuestionReview) {
          <p-card styleClass="questions-card">
            <ng-template #header>
              <div class="card-header">
                <h3><i class="pi pi-list-check"></i> Question Review</h3>
                <div class="filter-buttons">
                  <p-button
                    [label]="'All (' + reviewItems().length + ')'"
                    [outlined]="filterStatus() !== 'all'"
                    size="small"
                    (click)="filterStatus.set('all')"
                  />
                  <p-button
                    [label]="'Correct (' + correctCount() + ')'"
                    [outlined]="filterStatus() !== 'correct'"
                    severity="success"
                    size="small"
                    (click)="filterStatus.set('correct')"
                  />
                  <p-button
                    [label]="'Wrong (' + wrongCount() + ')'"
                    [outlined]="filterStatus() !== 'wrong'"
                    severity="danger"
                    size="small"
                    (click)="filterStatus.set('wrong')"
                  />
                  <p-button
                    [label]="'Skipped (' + skippedCount() + ')'"
                    [outlined]="filterStatus() !== 'skipped'"
                    severity="warn"
                    size="small"
                    (click)="filterStatus.set('skipped')"
                  />
                </div>
              </div>
            </ng-template>

            <div class="questions-list">
              @for (item of filteredItems(); track item.question.id) {
                <div class="question-item" [class]="'status-' + item.status">
                  <div class="question-header">
                    <div class="question-number">
                      <span class="q-num">Q{{ item.question.sequenceNumber }}</span>
                      <p-tag
                        [value]="item.status | titlecase"
                        [severity]="getAnswerSeverity(item.status)"
                      />
                    </div>
                    <div class="question-marks">
                      @if (displaySettings().showScore) {
                        <span class="marks-obtained" [class]="item.status">
                          {{ item.marksObtained > 0 ? '+' : '' }}{{ item.marksObtained }}
                        </span>
                        <span class="marks-total">/ {{ item.question.marks }}</span>
                      }
                      @if (displaySettings().showTimeSpent && item.timeSpent > 0) {
                        <span class="time-spent">
                          <i class="pi pi-clock"></i> {{ formatDuration(item.timeSpent) }}
                        </span>
                      }
                    </div>
                  </div>

                  <div class="question-content">
                    <p class="question-text">{{ item.question.questionText }}</p>
                    @if (item.question.questionImageUrl) {
                      <img [src]="item.question.questionImageUrl" alt="Question image" class="question-image" />
                    }
                  </div>

                  <div class="options-list">
                    @for (option of item.question.options; track option.id) {
                      <div
                        class="option-item"
                        [class.selected]="displaySettings().showStudentAnswers && item.selectedOption?.id === option.id"
                        [class.correct]="displaySettings().showCorrectAnswers && item.correctOption.id === option.id"
                        [class.wrong]="displaySettings().showStudentAnswers && displaySettings().showCorrectAnswers && item.selectedOption?.id === option.id && item.correctOption.id !== option.id"
                      >
                        <div class="option-marker">
                          @if (displaySettings().showCorrectAnswers && item.correctOption.id === option.id) {
                            <i class="pi pi-check-circle correct-icon"></i>
                          } @else if (displaySettings().showStudentAnswers && item.selectedOption?.id === option.id && (!displaySettings().showCorrectAnswers || item.correctOption.id === option.id)) {
                            <i class="pi pi-check-circle selected-icon"></i>
                          } @else if (displaySettings().showStudentAnswers && displaySettings().showCorrectAnswers && item.selectedOption?.id === option.id) {
                            <i class="pi pi-times-circle wrong-icon"></i>
                          } @else {
                            <span class="option-bullet"></span>
                          }
                        </div>
                        <span class="option-text">{{ option.text }}</span>
                        @if (displaySettings().showStudentAnswers && item.selectedOption?.id === option.id) {
                          <span class="selected-label">Your Answer</span>
                        }
                        @if (displaySettings().showCorrectAnswers && item.correctOption.id === option.id) {
                          <span class="correct-label">Correct Answer</span>
                        }
                      </div>
                    }
                  </div>

                  @if (displaySettings().showExplanations && item.question.explanation) {
                    <div class="explanation">
                      <strong><i class="pi pi-info-circle"></i> Explanation:</strong>
                      <p>{{ item.question.explanation }}</p>
                    </div>
                  }
                </div>
              }

              @if (filteredItems().length === 0) {
                <div class="empty-filter">
                  <i class="pi pi-filter-slash"></i>
                  <p>No questions match the selected filter</p>
                </div>
              }
            </div>
          </p-card>
        } @else {
          <!-- Question review not available -->
          <p-message
            severity="info"
            text="Question-by-question review is not available for this exam."
            styleClass="full-width-message"
          />
        }
      }
    </div>
  `,
  styles: `
    .submission-review-page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }

    .page-nav { margin-bottom: 1.5rem; }

    .loading-container { padding: 2rem 0; }

    .not-found, .results-not-available {
      display: flex; flex-direction: column; align-items: center;
      padding: 4rem 2rem; text-align: center;
      background: var(--surface-card); border-radius: 12px;
    }
    .not-found i, .results-not-available i {
      font-size: 4rem; color: var(--text-color-secondary); margin-bottom: 1rem;
    }
    .results-not-available i { color: var(--orange-500); }
    .not-found h2, .results-not-available h2 { margin: 0 0 0.5rem; }
    .not-found p, .results-not-available p {
      color: var(--text-color-secondary); margin-bottom: 1.5rem; max-width: 400px;
    }

    /* Header */
    .page-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;
    }
    .header-info { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .exam-title { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .subject-badge {
      padding: 0.25rem 0.75rem; border-radius: 16px;
      color: white; font-size: 0.8125rem; font-weight: 500;
    }
    :host ::ng-deep .result-tag { font-size: 1rem; padding: 0.5rem 1rem; }

    /* Score Section */
    .score-section {
      background: var(--surface-card); border-radius: 12px;
      padding: 2rem; margin-bottom: 1.5rem;
      display: flex; justify-content: center;
    }
    .score-display { display: flex; align-items: center; gap: 3rem; flex-wrap: wrap; justify-content: center; }
    .score-main-block { display: flex; align-items: baseline; }
    .score-value { font-size: 4rem; font-weight: 700; color: var(--red-500); }
    .score-value.passed { color: var(--green-500); }
    .score-divider { font-size: 2rem; color: var(--text-color-secondary); margin: 0 0.25rem; }
    .score-total { font-size: 2rem; color: var(--text-color-secondary); }
    .percentage-block { display: flex; flex-direction: column; gap: 0.5rem; min-width: 150px; }
    .percentage-value { font-size: 2rem; font-weight: 600; text-align: center; }
    :host ::ng-deep .score-progress { height: 12px; border-radius: 6px; }

    /* Stats Row */
    .stats-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem; margin-bottom: 1.5rem;
    }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    :host ::ng-deep .stat-card.correct { border-left: 4px solid var(--green-500); }
    :host ::ng-deep .stat-card.wrong { border-left: 4px solid var(--red-500); }
    :host ::ng-deep .stat-card.skipped { border-left: 4px solid var(--orange-500); }
    :host ::ng-deep .stat-card.info { border-left: 4px solid var(--blue-500); }
    .stat-content { display: flex; align-items: center; gap: 1rem; }
    .stat-content i { font-size: 1.5rem; }
    .stat-card.correct .stat-content i { color: var(--green-500); }
    .stat-card.wrong .stat-content i { color: var(--red-500); }
    .stat-card.skipped .stat-content i { color: var(--orange-500); }
    .stat-card.info .stat-content i { color: var(--blue-500); }
    .stat-text { display: flex; flex-direction: column; }
    .stat-value { font-size: 1.5rem; font-weight: 700; }
    .stat-label { font-size: 0.875rem; color: var(--text-color-secondary); }

    /* Info Card */
    :host ::ng-deep .info-card .p-card-body { padding: 1rem 1.5rem; }
    .info-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem;
    }
    .info-item { display: flex; flex-direction: column; gap: 0.25rem; }
    .info-item.full-width { grid-column: 1 / -1; }
    .info-label { font-size: 0.75rem; color: var(--text-color-secondary); text-transform: uppercase; }
    .info-value { font-weight: 500; }
    .info-value.warning { color: var(--orange-600); }
    .text-muted { color: var(--text-color-secondary); font-style: italic; }

    /* Remarks Card */
    .remarks-card { margin: 1.5rem 0; }
    .card-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--surface-border);
    }
    .card-header h3 {
      margin: 0; font-size: 1rem; font-weight: 600;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .card-header h3 i { color: var(--primary-color); }
    .remarks-content { padding: 0.5rem 0; }
    .remarks-text {
      margin: 0; padding: 1rem; background: var(--surface-100);
      border-radius: 8px; font-style: italic; color: var(--text-color-secondary);
    }

    /* Rank Card */
    .rank-card { margin-bottom: 1.5rem; }
    :host ::ng-deep .rank-card .p-card-body { padding: 1.5rem; }
    .rank-content {
      display: flex; align-items: center; gap: 1rem;
      justify-content: center;
    }
    .rank-content i { font-size: 2.5rem; color: var(--yellow-500); }
    .rank-text { display: flex; flex-direction: column; align-items: center; }
    .rank-label { font-size: 0.875rem; color: var(--text-color-secondary); }
    .rank-value { font-size: 2.5rem; font-weight: 700; color: var(--primary-color); }
    .rank-total { font-size: 0.875rem; color: var(--text-color-secondary); }

    /* Filter Buttons */
    .filter-buttons { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    /* Questions Card */
    .questions-card { margin-bottom: 2rem; }
    :host ::ng-deep .questions-card .p-card-body { padding: 0; }
    :host ::ng-deep .questions-card .p-card-content { padding: 0; }

    .questions-list { display: flex; flex-direction: column; }

    .question-item {
      padding: 1.5rem; border-bottom: 1px solid var(--surface-border);
    }
    .question-item:last-child { border-bottom: none; }
    .question-item.status-correct { background: var(--green-50); }
    .question-item.status-wrong { background: var(--red-50); }
    .question-item.status-skipped { background: var(--orange-50); }

    .question-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;
    }
    .question-number { display: flex; align-items: center; gap: 0.75rem; }
    .q-num {
      font-weight: 700; font-size: 1rem;
      background: var(--surface-200); padding: 0.25rem 0.75rem; border-radius: 6px;
    }
    .question-marks { display: flex; align-items: center; gap: 0.75rem; }
    .marks-obtained { font-weight: 700; font-size: 1.125rem; }
    .marks-obtained.correct { color: var(--green-600); }
    .marks-obtained.wrong { color: var(--red-600); }
    .marks-obtained.skipped { color: var(--orange-600); }
    .marks-total { color: var(--text-color-secondary); }
    .time-spent {
      display: flex; align-items: center; gap: 0.25rem;
      font-size: 0.875rem; color: var(--text-color-secondary);
      background: var(--surface-100); padding: 0.25rem 0.5rem; border-radius: 4px;
    }

    .question-content { margin-bottom: 1rem; }
    .question-text { margin: 0 0 0.75rem; font-size: 1rem; line-height: 1.5; }
    .question-image { max-width: 400px; border-radius: 8px; margin-top: 0.5rem; }

    .options-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .option-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.75rem 1rem; border-radius: 8px;
      background: var(--surface-0); border: 1px solid var(--surface-200);
      position: relative;
    }
    .option-item.correct {
      background: var(--green-100); border-color: var(--green-300);
    }
    .option-item.wrong {
      background: var(--red-100); border-color: var(--red-300);
    }
    .option-item.selected:not(.correct):not(.wrong) {
      border-color: var(--primary-300); background: var(--primary-50);
    }
    .option-marker { width: 24px; display: flex; justify-content: center; }
    .option-bullet {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid var(--surface-400);
    }
    .correct-icon { color: var(--green-600); font-size: 1.25rem; }
    .selected-icon { color: var(--primary-600); font-size: 1.25rem; }
    .wrong-icon { color: var(--red-600); font-size: 1.25rem; }
    .option-text { flex: 1; }
    .selected-label, .correct-label {
      font-size: 0.6875rem; padding: 0.125rem 0.5rem;
      border-radius: 4px; font-weight: 500;
    }
    .selected-label { background: var(--blue-100); color: var(--blue-700); }
    .correct-label { background: var(--green-100); color: var(--green-700); }

    .explanation {
      margin-top: 1rem; padding: 1rem;
      background: var(--surface-100); border-radius: 8px;
      font-size: 0.9375rem;
    }
    .explanation strong {
      display: flex; align-items: center; gap: 0.5rem;
      color: var(--primary-color); margin-bottom: 0.5rem;
    }
    .explanation p { margin: 0; color: var(--text-color-secondary); }

    .empty-filter {
      display: flex; flex-direction: column; align-items: center;
      padding: 3rem; color: var(--text-color-secondary);
    }
    .empty-filter i { font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5; }

    :host ::ng-deep .full-width-message { width: 100%; margin-bottom: 1.5rem; }
    :host ::ng-deep .full-width-message .p-message { width: 100%; justify-content: center; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmissionReviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  // @REVIEW: Export services for PDF and CSV generation
  private readonly pdfExportService = inject(PdfExportService);
  private readonly csvExportService = inject(CsvExportService);

  // State
  readonly loading = signal(true);
  readonly submission = signal<ExamSubmissionWithDetails | null>(null);
  readonly exam = signal<Exam | null>(null);
  readonly subject = signal<Subject | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly filterStatus = signal<'all' | 'correct' | 'wrong' | 'skipped'>('all');
  readonly rank = signal<number | null>(null);
  readonly totalSubmissions = signal<number>(0);
  // @REVIEW: Store current student data for export functionality
  readonly currentStudent = signal<StudentWithUser | null>(null);

  // @REVIEW: Computed display settings based on exam visibility configuration
  readonly displaySettings = computed<ResultDisplaySettings>(() => {
    const sub = this.submission();
    const exam = this.exam();
    if (!sub || !exam) {
      return {
        canViewResults: false,
        showScore: false,
        showPercentage: false,
        showPassFail: false,
        showCorrectAnswers: false,
        showStudentAnswers: false,
        showExplanations: false,
        showQuestionReview: false,
        showTimeSpent: false,
        showTeacherRemarks: false,
        showRank: false,
      };
    }
    return getResultDisplaySettings(exam, sub);
  });

  readonly availabilityMessage = computed(() => {
    const exam = this.exam();
    return exam ? getResultAvailabilityMessage(exam) : 'Results are not available.';
  });

  // Computed: Build review items
  readonly reviewItems = computed<QuestionReviewItem[]>(() => {
    const sub = this.submission();
    const qs = this.questions();
    if (!sub || qs.length === 0) return [];

    const answerMap = new Map(sub.answers.map(a => [a.questionId, a]));

    return qs.map(question => {
      const answer = answerMap.get(question.id) ?? null;
      const correctOption = question.options.find(o => o.id === question.correctOptionId)!;
      const selectedOption = answer?.selectedOptionId
        ? question.options.find(o => o.id === answer.selectedOptionId) ?? null
        : null;

      let status: 'correct' | 'wrong' | 'skipped' | 'unanswered';
      if (answer?.wasSkipped) {
        status = 'skipped';
      } else if (answer?.isCorrect === true) {
        status = 'correct';
      } else if (answer?.isCorrect === false) {
        status = 'wrong';
      } else {
        status = 'unanswered';
      }

      return {
        question,
        answer,
        selectedOption,
        correctOption,
        status,
        marksObtained: answer?.marksObtained ?? 0,
        timeSpent: answer?.timeSpentSeconds ?? 0,
      };
    }).sort((a, b) => a.question.sequenceNumber - b.question.sequenceNumber);
  });

  readonly filteredItems = computed(() => {
    const status = this.filterStatus();
    const items = this.reviewItems();
    if (status === 'all') return items;
    if (status === 'skipped') {
      return items.filter(i => i.status === 'skipped' || i.status === 'unanswered');
    }
    return items.filter(i => i.status === status);
  });

  readonly correctCount = computed(() => this.reviewItems().filter(i => i.status === 'correct').length);
  readonly wrongCount = computed(() => this.reviewItems().filter(i => i.status === 'wrong').length);
  readonly skippedCount = computed(() =>
    this.reviewItems().filter(i => i.status === 'skipped' || i.status === 'unanswered').length
  );

  readonly totalTimeSpent = computed(() =>
    this.reviewItems().reduce((sum, i) => sum + i.timeSpent, 0)
  );

  // @REVIEW: Export menu items for PDF/CSV dropdown
  readonly exportMenuItems = computed<MenuItem[]>(() => [
    {
      label: 'Export as PDF',
      icon: 'pi pi-file-pdf',
      command: () => this.exportToPdf(),
    },
    {
      label: 'Export as CSV',
      icon: 'pi pi-file',
      command: () => this.exportToCsv(),
    },
  ]);

  ngOnInit(): void {
    const submissionId = this.route.snapshot.paramMap.get('submissionId');
    if (submissionId) {
      this.loadSubmission(submissionId);
    } else {
      this.loading.set(false);
    }
  }

  private loadSubmission(id: string): void {
    const studentId = this.authStore.studentId();

    this.db.submissions.getById(id).subscribe({
      next: (submission) => {
        if (!submission) {
          this.loading.set(false);
          return;
        }

        // @REVIEW: Security check - ensure student can only view their own submissions
        if (submission.studentId !== studentId) {
          console.warn('Access denied: Student trying to view another student\'s submission');
          this.loading.set(false);
          return;
        }

        this.submission.set(submission);

        // @REVIEW: Load exam, questions, subject, and student data in parallel
        forkJoin({
          exam: this.db.exams.getById(submission.examId),
          questions: this.db.questions.getByExam(submission.examId),
          subject: submission.exam.subjectId
            ? this.db.subjects.getById(submission.exam.subjectId)
            : of(null),
          student: studentId
            ? this.db.students.getById(studentId)
            : of(null),
        }).subscribe({
          next: ({ exam, questions, subject, student }) => {
            this.exam.set(exam);
            this.questions.set(questions);
            this.subject.set(subject);
            this.currentStudent.set(student);

            // @REVIEW: Load rank if showRank is enabled
            if (exam?.showRank) {
              this.loadRank(submission.examId, submission.score);
            }

            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load details:', err);
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        console.error('Failed to load submission:', err);
        this.loading.set(false);
      },
    });
  }

  // @REVIEW: Calculate student's rank among all submissions for this exam
  private loadRank(examId: string, studentScore: number): void {
    this.db.submissions.getByExam(examId, { page: 1, pageSize: 1000 }).subscribe({
      next: (response) => {
        const completedSubmissions = response.items.filter(s =>
          s.status === 'submitted' || s.status === 'auto_submitted' || s.status === 'evaluated'
        );

        this.totalSubmissions.set(completedSubmissions.length);

        // Sort by score descending and find rank
        const sorted = [...completedSubmissions].sort((a, b) => b.score - a.score);
        const rankIndex = sorted.findIndex(s => s.score <= studentScore);
        this.rank.set(rankIndex + 1);
      },
      error: (err) => {
        console.error('Failed to load rank:', err);
      },
    });
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

  getAutoSubmitReasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      'tab_blur': 'Left the exam tab',
      'window_blur': 'Left the browser window',
      'time_expired': 'Time limit reached',
      'visibility_change': 'Browser visibility changed',
    };
    return labels[reason] ?? reason;
  }

  getAnswerSeverity(status: string): 'success' | 'danger' | 'warn' | 'secondary' {
    const map: Record<string, 'success' | 'danger' | 'warn' | 'secondary'> = {
      correct: 'success',
      wrong: 'danger',
      skipped: 'warn',
      unanswered: 'secondary',
    };
    return map[status] ?? 'secondary';
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}h ${remainMins}m`;
  }

  // @REVIEW: Export submission as PDF (student view - respects visibility settings)
  exportToPdf(): void {
    const sub = this.submission();
    const student = this.currentStudent();
    if (!sub || !student) return;

    const settings = this.displaySettings();
    const pdfQuestions = this.buildPdfQuestionItems();

    this.pdfExportService.exportSubmissionReport({
      submission: sub,
      student: student,
      questions: pdfQuestions,
      totalTimeSpent: this.totalTimeSpent(),
      subjectName: this.subject()?.name ?? null,
      options: {
        includeQuestions: settings.showQuestionReview,
        includeAnswers: settings.showStudentAnswers,
        includeCorrectAnswers: settings.showCorrectAnswers,
        includeExplanations: settings.showExplanations,
        includeTimeSpent: settings.showTimeSpent,
        includeRemarks: settings.showTeacherRemarks,
      },
    });
  }

  // @REVIEW: Export submission as CSV (student view - respects visibility settings)
  exportToCsv(): void {
    const sub = this.submission();
    const student = this.currentStudent();
    if (!sub || !student) return;

    const settings = this.displaySettings();
    const pdfQuestions = this.buildPdfQuestionItems();

    this.csvExportService.exportSubmissionReport({
      submission: sub,
      student: student,
      questions: pdfQuestions,
      totalTimeSpent: this.totalTimeSpent(),
      subjectName: this.subject()?.name ?? null,
      options: {
        includeQuestionDetails: settings.showQuestionReview,
        includeTimeSpent: settings.showTimeSpent,
      },
    });
  }

  // @REVIEW: Build PdfQuestionItem array from reviewItems
  private buildPdfQuestionItems(): PdfQuestionItem[] {
    return this.reviewItems().map(item => ({
      questionNumber: item.question.sequenceNumber,
      questionText: item.question.questionText,
      options: item.question.options,
      selectedOptionId: item.selectedOption?.id ?? null,
      correctOptionId: item.correctOption.id,
      status: item.status,
      marksObtained: item.marksObtained,
      maxMarks: item.question.marks,
      timeSpentSeconds: item.timeSpent,
      explanation: item.question.explanation ?? null,
    }));
  }
}
