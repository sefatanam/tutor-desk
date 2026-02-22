// @REVIEW: Submission Detail - View individual student's exam answers with full question details
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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { ProgressBarModule } from 'primeng/progressbar';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { AccordionModule } from 'primeng/accordion';
import { MenuModule } from 'primeng/menu';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import {
  PdfExportService,
  PdfQuestionItem,
} from '../../../core/services/pdf-export.service';
import { CsvExportService } from '../../../core/services/csv-export.service';
import {
  ExamSubmissionWithDetails,
  Question,
  SubmissionAnswer,
  StudentWithUser,
  QuestionOption,
  Subject,
} from '../../../core/models';

// @REVIEW: Question review item combining question, answer, and evaluation
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
  selector: 'app-submission-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    SkeletonModule,
    DividerModule,
    ProgressBarModule,
    TextareaModule,
    ToastModule,
    ConfirmDialogModule,
    AccordionModule,
    MenuModule,
  ],
  providers: [MessageService, ConfirmationService],
  template: `
    <div class="submission-detail-page">
      <!-- Navigation -->
      <div class="page-nav">
        @if (submission()) {
        <p-button
          icon="pi pi-arrow-left"
          label="Back to Exam Results"
          [text]="true"
          [routerLink]="['/teacher/exams', submission()!.examId, 'results']"
        />
        } @else {
        <p-button
          icon="pi pi-arrow-left"
          label="Back"
          [text]="true"
          routerLink="/teacher/exams"
        />
        }
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
        <p>The submission you're looking for doesn't exist.</p>
        <p-button label="Go to Exams" routerLink="/teacher/exams" />
      </div>
      } @else {
      <!-- Header -->
      <header class="page-header">
        <div class="header-info">
          <div class="student-section">
            <div
              class="student-avatar"
              [style.background]="
                getAvatarColor(student()?.user?.fullName ?? 'S')
              "
            >
              {{ getInitials(student()?.user?.fullName ?? 'Student') }}
            </div>
            <div class="student-details">
              <h1 class="student-name">
                {{ student()?.user?.fullName ?? 'Unknown Student' }}
              </h1>
              <span class="student-email">{{
                student()?.user?.email ?? ''
              }}</span>
            </div>
          </div>
          <div class="exam-info">
            <h2 class="exam-title">{{ submission()!.exam.title }}</h2>
            @if (subject()) {
            <span class="subject-badge" [style.background]="subject()!.color">
              {{ subject()!.name }}
            </span>
            }
          </div>
        </div>
        <div class="header-actions">
          <p-tag
            [value]="
              submission()!.score >= submission()!.exam.passingMarks
                ? 'PASSED'
                : 'FAILED'
            "
            [severity]="
              submission()!.score >= submission()!.exam.passingMarks
                ? 'success'
                : 'danger'
            "
            styleClass="result-tag"
          />
          @if (submission()!.status !== 'retake_allowed') {
          <p-button
            icon="pi pi-refresh"
            label="Allow Retake"
            severity="warn"
            (click)="confirmAllowRetake()"
          />
          } @else {
          <p-tag value="Retake Allowed" severity="warn" />
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
        </div>
      </header>

      <!-- Score Summary -->
      <section class="score-section">
        <div class="score-display">
          <div class="score-main-block">
            <span
              class="score-value"
              [class.passed]="
                submission()!.score >= submission()!.exam.passingMarks
              "
            >
              {{ submission()!.score }}
            </span>
            <span class="score-divider">/</span>
            <span class="score-total">{{ submission()!.exam.totalMarks }}</span>
          </div>
          <div class="percentage-block">
            <span class="percentage-value"
              >{{ submission()!.percentage }}%</span
            >
            <p-progressBar
              [value]="submission()!.percentage"
              [showValue]="false"
              styleClass="score-progress"
            />
          </div>
        </div>
      </section>

      <!-- Stats Cards -->
      <section class="stats-row">
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
        <p-card styleClass="stat-card info">
          <div class="stat-content">
            <i class="pi pi-clock"></i>
            <div class="stat-text">
              <span class="stat-value">{{
                formatDuration(totalTimeSpent())
              }}</span>
              <span class="stat-label">Time Spent</span>
            </div>
          </div>
        </p-card>
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
            <span class="info-value">{{
              submission()!.startedAt | date : 'medium'
            }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Submitted</span>
            <span class="info-value">
              @if (submission()!.submittedAt) {
              {{ submission()!.submittedAt | date : 'medium' }}
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
            <span class="info-value warning">{{
              submission()!.autoSubmitReason
            }}</span>
          </div>
          }
        </div>
      </p-card>

      <!-- Teacher Remarks -->
      <p-card styleClass="remarks-card">
        <ng-template #header>
          <div class="card-header">
            <h3><i class="pi pi-comment"></i> Teacher Remarks</h3>
          </div>
        </ng-template>
        <div class="remarks-content">
          <textarea
            pTextarea
            [(ngModel)]="remarksInput"
            rows="3"
            placeholder="Add feedback or remarks for the student..."
            class="remarks-textarea"
          ></textarea>
          <p-button
            label="Save Remarks"
            icon="pi pi-save"
            (click)="saveRemarks()"
            [loading]="savingRemarks()"
          />
        </div>
      </p-card>

      <!-- Questions Review -->
      <p-card styleClass="questions-card">
        <ng-template #header>
          <div class="card-header">
            <h3>
              <i class="pi pi-list-check"></i> Question-by-Question Review
            </h3>
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
          @for (item of filteredItems(); track item.question.id; let i = $index)
          {
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
                <span class="marks-obtained" [class]="item.status">
                  {{ item.marksObtained > 0 ? '+' : ''
                  }}{{ item.marksObtained }}
                </span>
                <span class="marks-total">/ {{ item.question.marks }}</span>
                @if (item.timeSpent > 0) {
                <span class="time-spent">
                  <i class="pi pi-clock"></i>
                  {{ formatDuration(item.timeSpent) }}
                </span>
                }
              </div>
            </div>

            <div class="question-content">
              <p class="question-text">{{ item.question.questionText }}</p>
              @if (item.question.questionImageUrl) {
              <img
                [src]="item.question.questionImageUrl"
                alt="Question image"
                class="question-image"
              />
              }
            </div>

            <div class="options-list">
              @for (option of item.question.options; track option.id) {
              <div
                class="option-item"
                [class.selected]="item.selectedOption?.id === option.id"
                [class.correct]="item.correctOption.id === option.id"
                [class.wrong]="
                  item.selectedOption?.id === option.id &&
                  item.correctOption.id !== option.id
                "
              >
                <div class="option-marker">
                  @if (item.correctOption.id === option.id) {
                  <i class="pi pi-check-circle correct-icon"></i>
                  } @else if (item.selectedOption?.id === option.id) {
                  <i class="pi pi-times-circle wrong-icon"></i>
                  } @else {
                  <span class="option-bullet"></span>
                  }
                </div>
                <span class="option-text">{{ option.text }}</span>
                @if (item.selectedOption?.id === option.id) {
                <span class="selected-label">Student's Answer</span>
                } @if (item.correctOption.id === option.id) {
                <span class="correct-label">Correct Answer</span>
                }
              </div>
              }
            </div>

            @if (item.question.explanation) {
            <div class="explanation">
              <strong><i class="pi pi-info-circle"></i> Explanation:</strong>
              <p>{{ item.question.explanation }}</p>
            </div>
            }
          </div>
          } @if (filteredItems().length === 0) {
          <div class="empty-filter">
            <i class="pi pi-filter-slash"></i>
            <p>No questions match the selected filter</p>
          </div>
          }
        </div>
      </p-card>
      }
    </div>

    <p-toast />
    <p-confirmDialog />
  `,
  styles: `
    .submission-detail-page { padding: 1.5rem; max-width: 1200px; margin: 0 auto; }

    .page-nav { margin-bottom: 1.5rem; }

    .loading-container { padding: 2rem 0; }

    .not-found {
      display: flex; flex-direction: column; align-items: center;
      padding: 4rem 2rem; text-align: center;
    }
    .not-found i { font-size: 4rem; color: var(--text-color-secondary); margin-bottom: 1rem; }
    .not-found h2 { margin: 0 0 0.5rem; }
    .not-found p { color: var(--text-color-secondary); margin-bottom: 1.5rem; }

    /* Header */
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;
    }
    .header-info { display: flex; flex-direction: column; gap: 1rem; }
    .student-section { display: flex; align-items: center; gap: 1rem; }
    .student-avatar {
      width: 56px; height: 56px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 1.25rem;
    }
    .student-details { display: flex; flex-direction: column; }
    .student-name { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .student-email { color: var(--text-color-secondary); font-size: 0.875rem; }
    .exam-info { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .exam-title { margin: 0; font-size: 1.125rem; font-weight: 500; color: var(--text-color-secondary); }
    .subject-badge {
      padding: 0.25rem 0.75rem; border-radius: 16px;
      color: white; font-size: 0.8125rem; font-weight: 500;
    }
    .header-actions { display: flex; align-items: center; gap: 1rem; }
    :host ::ng-deep .result-tag { font-size: 1rem; padding: 0.5rem 1rem; }

    /* Score Section */
    .score-section {
      background: var(--surface-card); border-radius: 12px;
      padding: 2rem; margin-bottom: 1.5rem;
      display: flex; justify-content: center;
    }
    .score-display { display: flex; align-items: center; gap: 3rem; }
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
      display: grid; grid-template-columns: repeat(4, 1fr);
      gap: 1rem; margin-bottom: 1.5rem;
    }
    @media (max-width: 768px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
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
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;
    }
    @media (max-width: 768px) { .info-grid { grid-template-columns: repeat(2, 1fr); } }
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
    .remarks-content { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
    .remarks-textarea { width: 100%; }

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
      margin-bottom: 1rem;
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
      border-color: var(--primary-300);
    }
    .option-marker { width: 24px; display: flex; justify-content: center; }
    .option-bullet {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid var(--surface-400);
    }
    .correct-icon { color: var(--green-600); font-size: 1.25rem; }
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmissionDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  // @REVIEW: Export services for PDF and CSV generation
  private readonly pdfExportService = inject(PdfExportService);
  private readonly csvExportService = inject(CsvExportService);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly submission = signal<ExamSubmissionWithDetails | null>(null);
  readonly student = signal<StudentWithUser | null>(null);
  readonly subject = signal<Subject | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly savingRemarks = signal(false);
  readonly filterStatus = signal<'all' | 'correct' | 'wrong' | 'skipped'>(
    'all'
  );

  remarksInput = '';

  // Computed: Build review items combining questions and answers
  readonly reviewItems = computed<QuestionReviewItem[]>(() => {
    const sub = this.submission();
    const qs = this.questions();
    if (!sub || qs.length === 0) return [];

    const answerMap = new Map(sub.answers.map((a) => [a.questionId, a]));

    return qs
      .map((question) => {
        const answer = answerMap.get(question.id) ?? null;
        const correctOption = question.options.find(
          (o) => o.id === question.correctOptionId
        )!;
        const selectedOption = answer?.selectedOptionId
          ? question.options.find((o) => o.id === answer.selectedOptionId) ??
            null
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
      })
      .sort((a, b) => a.question.sequenceNumber - b.question.sequenceNumber);
  });

  readonly filteredItems = computed(() => {
    const status = this.filterStatus();
    const items = this.reviewItems();
    if (status === 'all') return items;
    return items.filter((i) => i.status === status);
  });

  readonly correctCount = computed(
    () => this.reviewItems().filter((i) => i.status === 'correct').length
  );
  readonly wrongCount = computed(
    () => this.reviewItems().filter((i) => i.status === 'wrong').length
  );
  readonly skippedCount = computed(
    () =>
      this.reviewItems().filter(
        (i) => i.status === 'skipped' || i.status === 'unanswered'
      ).length
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
    this.db.submissions
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (submission) => {
          if (!submission) {
            this.loading.set(false);
            return;
          }

          this.submission.set(submission);
          this.remarksInput = submission.remarks ?? '';

          // Load questions, student, and subject in parallel
          forkJoin({
            questions: this.db.questions.getByExam(submission.examId),
            student: this.db.students.getById(submission.studentId),
            subject: submission.exam.subjectId
              ? this.db.subjects.getById(submission.exam.subjectId)
              : of(null),
          })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: ({ questions, student, subject }) => {
                this.questions.set(questions);
                this.student.set(student);
                this.subject.set(subject);
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

  saveRemarks(): void {
    const sub = this.submission();
    if (!sub) return;

    this.savingRemarks.set(true);

    this.db.submissions
      .evaluate(
        sub.id,
        this.authStore.user()?.id ?? '',
        this.remarksInput || undefined
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.submission.update((s) => (s ? { ...s, ...updated } : null));
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

  confirmAllowRetake(): void {
    const student = this.student();
    this.confirmationService.confirm({
      message: `Allow ${
        student?.user?.fullName ?? 'this student'
      } to retake this exam?`,
      header: 'Allow Retake',
      icon: 'pi pi-refresh',
      acceptLabel: 'Allow Retake',
      rejectLabel: 'Cancel',
      accept: () => this.allowRetake(),
    });
  }

  private allowRetake(): void {
    const sub = this.submission();
    if (!sub) return;

    this.db.submissions
      .allowRetake(sub.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.submission.update((s) => (s ? { ...s, ...updated } : null));
          this.messageService.add({
            severity: 'success',
            summary: 'Retake Allowed',
            detail: 'Student can now retake this exam',
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

  getAvatarColor(name: string): string {
    const colors = [
      '#3b82f6',
      '#ef4444',
      '#10b981',
      '#f59e0b',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
      '#84cc16',
      '#f97316',
      '#6366f1',
    ];
    const index = name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      in_progress: 'In Progress',
      submitted: 'Submitted',
      auto_submitted: 'Auto-Submitted',
      evaluated: 'Evaluated',
      retake_allowed: 'Retake Allowed',
    };
    return labels[status] ?? status;
  }

  getStatusSeverity(
    status: string
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const severities: Record<
      string,
      'success' | 'info' | 'warn' | 'danger' | 'secondary'
    > = {
      in_progress: 'warn',
      submitted: 'info',
      auto_submitted: 'secondary',
      evaluated: 'success',
      retake_allowed: 'warn',
    };
    return severities[status] ?? 'secondary';
  }

  getAnswerSeverity(
    status: string
  ): 'success' | 'danger' | 'warn' | 'secondary' {
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

  // @REVIEW: Export submission as PDF
  exportToPdf(): void {
    const sub = this.submission();
    const stud = this.student();
    if (!sub || !stud) return;

    const pdfQuestions = this.buildPdfQuestionItems();

    this.pdfExportService.exportSubmissionReport({
      submission: sub,
      student: stud,
      questions: pdfQuestions,
      totalTimeSpent: this.totalTimeSpent(),
      subjectName: this.subject()?.name ?? null,
      options: {
        includeQuestions: true,
        includeAnswers: true,
        includeCorrectAnswers: true,
        includeExplanations: true,
        includeTimeSpent: true,
        includeRemarks: true,
      },
    });
  }

  // @REVIEW: Export submission as CSV
  exportToCsv(): void {
    const sub = this.submission();
    const stud = this.student();
    if (!sub || !stud) return;

    const pdfQuestions = this.buildPdfQuestionItems();

    this.csvExportService.exportSubmissionReport({
      submission: sub,
      student: stud,
      questions: pdfQuestions,
      totalTimeSpent: this.totalTimeSpent(),
      subjectName: this.subject()?.name ?? null,
      options: {
        includeQuestionDetails: true,
        includeTimeSpent: true,
      },
    });
  }

  // @REVIEW: Build PdfQuestionItem array from reviewItems
  private buildPdfQuestionItems(): PdfQuestionItem[] {
    return this.reviewItems().map((item) => ({
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
