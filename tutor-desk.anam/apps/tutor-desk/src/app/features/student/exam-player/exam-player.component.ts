// @REVIEW: Exam Player - Full exam-taking interface with timer, navigation, and anti-cheat
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  HostListener,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';
import { interval, switchMap, forkJoin, of, tap, Observable, Subscription } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import {
  ExamWithSubject,
  Question,
  ExamSubmission,
  SubmissionAnswer,
} from '../../../core/models';

// @REVIEW: Question state during exam
interface QuestionState {
  readonly question: Question;
  readonly answer: SubmissionAnswer | null;
  readonly selectedOptionId: string | null;
  readonly timeSpent: number;
  readonly wasSkipped: boolean;
  readonly returnedTo: boolean;
}

type ExamPhase = 'loading' | 'ready' | 'in_progress' | 'submitting' | 'completed' | 'error';

@Component({
  selector: 'app-exam-player',
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    ButtonModule,
    RadioButtonModule,
    ProgressBarModule,
    DialogModule,
    ToastModule,
    ConfirmDialogModule,
    TooltipModule,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <div class="exam-player" [class.exam-player--fullscreen]="isFullscreen()">
      <!-- Loading State -->
      @if (phase() === 'loading') {
        <div class="loading-screen">
          <div class="loading-content">
            <i class="pi pi-spin pi-spinner loading-icon"></i>
            <h2>Loading Exam...</h2>
            <p>Please wait while we prepare your exam</p>
          </div>
        </div>
      }

      <!-- Error State -->
      @if (phase() === 'error') {
        <div class="error-screen">
          <div class="error-content">
            <i class="pi pi-exclamation-triangle error-icon"></i>
            <h2>Unable to Load Exam</h2>
            <p>{{ errorMessage() }}</p>
            <p-button label="Back to Exams" icon="pi pi-arrow-left" (click)="navigateToExams()" />
          </div>
        </div>
      }

      <!-- Exam Ready State -->
      @if (phase() === 'ready' && exam()) {
        <div class="ready-screen">
          <div class="ready-content">
            <div class="ready-header">
              <h1>{{ exam()!.title }}</h1>
              <!-- @REVIEW: Handle nullable subject for independent exams -->
              @if (exam()!.subject) {
                <span class="subject-badge" [style.background]="exam()!.subject!.color">
                  {{ exam()!.subject!.name }}
                </span>
              } @else {
                <span class="subject-badge" style="background: #6b7280">
                  Independent Exam
                </span>
              }
            </div>

            <div class="ready-stats">
              <div class="stat-card">
                <i class="pi pi-question-circle"></i>
                <div>
                  <span class="stat-value">{{ questions().length }}</span>
                  <span class="stat-label">Questions</span>
                </div>
              </div>
              <div class="stat-card">
                <i class="pi pi-star"></i>
                <div>
                  <span class="stat-value">{{ exam()!.totalMarks }}</span>
                  <span class="stat-label">Total Marks</span>
                </div>
              </div>
              <div class="stat-card">
                <i class="pi pi-clock"></i>
                <div>
                  <span class="stat-value">{{ exam()!.timePerQuestionSeconds }}s</span>
                  <span class="stat-label">Per Question</span>
                </div>
              </div>
            </div>

            @if (exam()!.fullscreenRequired && !isFullscreen()) {
              <div class="fullscreen-warning">
                <i class="pi pi-expand"></i>
                <p>This exam requires fullscreen mode. Click the button below to enter fullscreen and start.</p>
              </div>
            }

            <div class="ready-actions">
              @if (exam()!.fullscreenRequired && !isFullscreen()) {
                <p-button 
                  label="Enter Fullscreen & Start" 
                  icon="pi pi-expand" 
                  size="large"
                  (click)="enterFullscreenAndStart()" 
                />
              } @else {
                <p-button 
                  label="Start Exam" 
                  icon="pi pi-play" 
                  size="large"
                  (click)="startExamTimer()" 
                />
              }
            </div>
          </div>
        </div>
      }

      <!-- Exam In Progress -->
      @if (phase() === 'in_progress' && currentQuestion()) {
        <div class="exam-container">
          <!-- Top Bar -->
          <header class="exam-header">
            <div class="exam-header__left">
              <span class="exam-title">{{ exam()!.title }}</span>
              <!-- @REVIEW: Handle nullable subject for independent exams -->
              @if (exam()!.subject) {
                <span class="subject-badge" [style.background]="exam()!.subject!.color">
                  {{ exam()!.subject!.name }}
                </span>
              } @else {
                <span class="subject-badge" style="background: #6b7280">
                  Independent Exam
                </span>
              }
            </div>
            <div class="exam-header__center">
              <div class="timer" [class.timer--warning]="timeRemaining() <= 10" [class.timer--danger]="timeRemaining() <= 5">
                <i class="pi pi-clock"></i>
                <span class="timer__value">{{ formatTime(timeRemaining()) }}</span>
              </div>
            </div>
            <div class="exam-header__right">
              <span class="progress-text">
                Question {{ currentIndex() + 1 }} of {{ questions().length }}
              </span>
              <p-button 
                icon="pi pi-send" 
                label="Submit Exam" 
                severity="danger"
                [outlined]="true"
                (click)="confirmSubmit()" 
              />
            </div>
          </header>

          <!-- Main Content -->
          <div class="exam-body">
            <!-- Question Panel -->
            <main class="question-panel">
              <div class="question-card">
                <div class="question-header">
                  <span class="question-number">Question {{ currentIndex() + 1 }}</span>
                  <span class="question-marks">{{ currentQuestion()!.question.marks }} marks</span>
                </div>

                <div class="question-text">
                  <p>{{ currentQuestion()!.question.questionText }}</p>
                  @if (currentQuestion()!.question.questionImageUrl) {
                    <img [src]="currentQuestion()!.question.questionImageUrl" alt="Question image" class="question-image" />
                  }
                </div>

                <div class="options-list">
                  @for (option of currentQuestion()!.question.options; track option.id; let i = $index) {
                    <label 
                      class="option-item" 
                      [class.option-item--selected]="selectedOption() === option.id"
                    >
                      <p-radioButton
                        [name]="'question-' + currentQuestion()!.question.id"
                        [value]="option.id"
                        [(ngModel)]="selectedOptionValue"
                        (ngModelChange)="onOptionSelect($event)"
                      />
                      <span class="option-label">{{ getOptionLetter(i) }}.</span>
                      <span class="option-text">{{ option.text }}</span>
                    </label>
                  }
                </div>

                @if (currentQuestion()!.question.negativeMarks > 0) {
                  <div class="negative-marks-warning">
                    <i class="pi pi-exclamation-triangle"></i>
                    <span>Wrong answer: -{{ currentQuestion()!.question.negativeMarks }} marks</span>
                  </div>
                }
              </div>

              <div class="question-actions">
                @if (exam()!.allowSkipReturn && !isLastQuestion()) {
                  <p-button 
                    label="Skip" 
                    icon="pi pi-forward" 
                    severity="secondary"
                    [outlined]="true"
                    (click)="skipQuestion()" 
                  />
                }
                
                @if (currentIndex() > 0 && exam()!.allowSkipReturn) {
                  <p-button 
                    label="Previous" 
                    icon="pi pi-arrow-left" 
                    severity="secondary"
                    (click)="goToPrevious()" 
                  />
                }

                @if (!isLastQuestion()) {
                  <p-button 
                    label="Next" 
                    icon="pi pi-arrow-right" 
                    iconPos="right"
                    (click)="goToNext()" 
                    [disabled]="!selectedOption() && !exam()!.allowSkipReturn"
                  />
                } @else {
                  <p-button 
                    label="Submit Exam" 
                    icon="pi pi-check" 
                    severity="success"
                    (click)="confirmSubmit()" 
                  />
                }
              </div>
            </main>

            <!-- Navigation Panel -->
            <aside class="nav-panel">
              <h3 class="nav-panel__title">Questions</h3>
              <div class="nav-grid">
                @for (state of questionStates(); track state.question.id; let i = $index) {
                  <button 
                    class="nav-item"
                    [class.nav-item--current]="i === currentIndex()"
                    [class.nav-item--answered]="state.selectedOptionId !== null"
                    [class.nav-item--skipped]="state.wasSkipped && state.selectedOptionId === null"
                    [class.nav-item--returned]="state.returnedTo"
                    (click)="goToQuestion(i)"
                    [disabled]="!exam()!.allowSkipReturn && i !== currentIndex()"
                    [pTooltip]="getQuestionTooltip(state, i)"
                  >
                    {{ i + 1 }}
                  </button>
                }
              </div>

              <div class="nav-legend">
                <div class="legend-item">
                  <span class="legend-dot legend-dot--current"></span>
                  <span>Current</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot legend-dot--answered"></span>
                  <span>Answered</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot legend-dot--skipped"></span>
                  <span>Skipped</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot legend-dot--unanswered"></span>
                  <span>Not Visited</span>
                </div>
              </div>

              <div class="nav-summary">
                <div class="summary-item">
                  <span class="summary-value">{{ answeredCount() }}</span>
                  <span class="summary-label">Answered</span>
                </div>
                <div class="summary-item">
                  <span class="summary-value">{{ skippedCount() }}</span>
                  <span class="summary-label">Skipped</span>
                </div>
                <div class="summary-item">
                  <span class="summary-value">{{ unansweredCount() }}</span>
                  <span class="summary-label">Remaining</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      }

      <!-- Submitting State -->
      @if (phase() === 'submitting') {
        <div class="loading-screen">
          <div class="loading-content">
            <i class="pi pi-spin pi-spinner loading-icon"></i>
            <h2>Submitting Exam...</h2>
            <p>Please wait while we save your answers</p>
          </div>
        </div>
      }

      <!-- Completed State -->
      @if (phase() === 'completed' && submission()) {
        <div class="completed-screen">
          <div class="completed-content">
            <div class="completed-icon">
              @if (submission()!.score >= (exam()?.passingMarks ?? 0)) {
                <i class="pi pi-check-circle success-icon"></i>
              } @else {
                <i class="pi pi-times-circle fail-icon"></i>
              }
            </div>
            <h1>Exam Completed!</h1>
            
            <div class="result-card">
              <div class="result-score">
                <span class="score-value">{{ submission()!.score }}</span>
                <span class="score-total">/ {{ exam()!.totalMarks }}</span>
              </div>
              <span class="percentage">{{ submission()!.percentage }}%</span>
            </div>

            <div class="result-stats">
              <div class="result-stat">
                <span class="stat-value correct">{{ submission()!.totalCorrect }}</span>
                <span class="stat-label">Correct</span>
              </div>
              <div class="result-stat">
                <span class="stat-value wrong">{{ submission()!.totalWrong }}</span>
                <span class="stat-label">Wrong</span>
              </div>
              <div class="result-stat">
                <span class="stat-value skipped">{{ submission()!.totalSkipped }}</span>
                <span class="stat-label">Skipped</span>
              </div>
            </div>

            @if (submission()!.autoSubmitReason) {
              <div class="auto-submit-notice">
                <i class="pi pi-info-circle"></i>
                <span>Auto-submitted: {{ submission()!.autoSubmitReason }}</span>
              </div>
            }

            <div class="completed-actions">
              <p-button label="View Results" icon="pi pi-chart-bar" (click)="navigateToResults()" />
              <p-button label="Back to Exams" icon="pi pi-arrow-left" severity="secondary" (click)="navigateToExams()" />
            </div>
          </div>
        </div>
      }

      <p-toast />
      <p-confirmDialog />
    </div>
  `,
  styles: `
    .exam-player {
      min-height: 100vh;
      background: var(--surface-ground);
    }
    .exam-player--fullscreen {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
    }

    /* Loading/Error/Ready Screens */
    .loading-screen, .error-screen, .ready-screen, .completed-screen {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .loading-content, .error-content, .ready-content, .completed-content {
      text-align: center;
      max-width: 600px;
    }
    .loading-icon { font-size: 4rem; color: var(--primary-color); margin-bottom: 1.5rem; }
    .error-icon { font-size: 4rem; color: var(--red-500); margin-bottom: 1.5rem; }

    /* Ready Screen */
    .ready-header { margin-bottom: 2rem; }
    .ready-header h1 { margin: 0 0 0.75rem; font-size: 2rem; }
    .subject-badge {
      display: inline-block;
      padding: 0.375rem 0.75rem;
      border-radius: 16px;
      color: white;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .ready-stats {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      background: var(--surface-card);
      border-radius: 12px;
      box-shadow: var(--card-shadow);
    }
    .stat-card i { font-size: 1.5rem; color: var(--primary-color); }
    .stat-value { display: block; font-size: 1.25rem; font-weight: 600; }
    .stat-label { font-size: 0.875rem; color: var(--text-color-secondary); }
    .fullscreen-warning {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      background: var(--yellow-100);
      border: 1px solid var(--yellow-300);
      border-radius: 8px;
      color: var(--yellow-900);
      margin-bottom: 2rem;
    }
    .fullscreen-warning i { font-size: 1.25rem; }
    .fullscreen-warning p { margin: 0; }
    .ready-actions { display: flex; justify-content: center; }

    /* Exam Container */
    .exam-container { display: flex; flex-direction: column; min-height: 100vh; }

    /* Exam Header */
    .exam-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.5rem;
      background: var(--surface-card);
      border-bottom: 1px solid var(--surface-200);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .exam-header__left { display: flex; align-items: center; gap: 0.75rem; }
    .exam-title { font-weight: 600; font-size: 1rem; }
    .exam-header__center { flex: 1; display: flex; justify-content: center; }
    .timer {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem;
      background: var(--surface-100);
      border-radius: 24px;
      font-weight: 600;
      font-size: 1.25rem;
    }
    .timer--warning { background: var(--yellow-100); color: var(--yellow-900); }
    .timer--danger { background: var(--red-100); color: var(--red-700); animation: pulse 0.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
    .exam-header__right { display: flex; align-items: center; gap: 1rem; }
    .progress-text { font-size: 0.875rem; color: var(--text-color-secondary); }

    /* Exam Body */
    .exam-body {
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 1.5rem;
      padding: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }

    /* Question Panel */
    .question-panel { display: flex; flex-direction: column; gap: 1.5rem; }
    .question-card {
      background: var(--surface-card);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: var(--card-shadow);
    }
    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--surface-200);
    }
    .question-number { font-weight: 600; font-size: 1rem; }
    .question-marks {
      padding: 0.25rem 0.75rem;
      background: var(--primary-100);
      color: var(--primary-700);
      border-radius: 16px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .question-text { margin-bottom: 1.5rem; }
    .question-text p { margin: 0; font-size: 1.125rem; line-height: 1.6; }
    .question-image { max-width: 100%; margin-top: 1rem; border-radius: 8px; }
    .options-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .option-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--surface-50);
      border: 2px solid var(--surface-200);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .option-item:hover { border-color: var(--primary-300); background: var(--primary-50); }
    .option-item--selected { border-color: var(--primary-color); background: var(--primary-50); }
    .option-label { font-weight: 600; color: var(--primary-color); min-width: 1.5rem; }
    .option-text { flex: 1; }
    .negative-marks-warning {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
      padding: 0.75rem;
      background: var(--red-50);
      border-radius: 6px;
      color: var(--red-700);
      font-size: 0.875rem;
    }
    .question-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    /* Navigation Panel */
    .nav-panel {
      background: var(--surface-card);
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: var(--card-shadow);
      position: sticky;
      top: 80px;
      height: fit-content;
    }
    .nav-panel__title { margin: 0 0 1rem; font-size: 1rem; font-weight: 600; }
    .nav-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .nav-item {
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--surface-300);
      border-radius: 8px;
      background: var(--surface-50);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .nav-item:hover:not(:disabled) { border-color: var(--primary-color); }
    .nav-item:disabled { opacity: 0.5; cursor: not-allowed; }
    .nav-item--current { border-color: var(--primary-color); background: var(--primary-color); color: white; }
    .nav-item--answered { border-color: var(--green-500); background: var(--green-100); color: var(--green-700); }
    .nav-item--skipped { border-color: var(--orange-500); background: var(--orange-100); color: var(--orange-700); }
    .nav-item--returned { border-style: dashed; }

    .nav-legend { margin-bottom: 1.25rem; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.375rem; font-size: 0.8125rem; }
    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 4px;
      border: 2px solid var(--surface-300);
      background: var(--surface-50);
    }
    .legend-dot--current { border-color: var(--primary-color); background: var(--primary-color); }
    .legend-dot--answered { border-color: var(--green-500); background: var(--green-100); }
    .legend-dot--skipped { border-color: var(--orange-500); background: var(--orange-100); }
    .legend-dot--unanswered { border-color: var(--surface-300); background: var(--surface-50); }

    .nav-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--surface-200);
    }
    .summary-item { text-align: center; }
    .summary-value { display: block; font-size: 1.25rem; font-weight: 600; }
    .summary-label { font-size: 0.75rem; color: var(--text-color-secondary); }

    /* Completed Screen */
    .completed-icon { margin-bottom: 1rem; }
    .success-icon { font-size: 5rem; color: var(--green-500); }
    .fail-icon { font-size: 5rem; color: var(--red-500); }
    .completed-content h1 { margin: 0 0 1.5rem; }
    .result-card {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 1rem;
      padding: 1.5rem 2rem;
      background: var(--surface-card);
      border-radius: 12px;
      margin-bottom: 1.5rem;
    }
    .result-score { display: flex; align-items: baseline; }
    .score-value { font-size: 3rem; font-weight: 700; color: var(--primary-color); }
    .score-total { font-size: 1.5rem; color: var(--text-color-secondary); }
    .percentage { font-size: 2rem; font-weight: 600; color: var(--text-color-secondary); }
    .result-stats {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 1.5rem;
    }
    .result-stat { text-align: center; }
    .result-stat .stat-value { font-size: 1.5rem; font-weight: 600; }
    .result-stat .stat-value.correct { color: var(--green-500); }
    .result-stat .stat-value.wrong { color: var(--red-500); }
    .result-stat .stat-value.skipped { color: var(--orange-500); }
    .result-stat .stat-label { font-size: 0.875rem; color: var(--text-color-secondary); }
    .auto-submit-notice {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem;
      background: var(--yellow-100);
      border-radius: 8px;
      color: var(--yellow-900);
      margin-bottom: 1.5rem;
    }
    .completed-actions { display: flex; justify-content: center; gap: 1rem; }

    @media (max-width: 900px) {
      .exam-body { grid-template-columns: 1fr; }
      .nav-panel { position: static; order: -1; }
      .nav-grid { grid-template-columns: repeat(8, 1fr); }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamPlayerComponent implements OnInit, OnDestroy {
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);

  // @REVIEW: Using DestroyRef for automatic subscription cleanup
  private readonly destroyRef = inject(DestroyRef);
  private timerSubscription: Subscription | null = null;

  // State
  readonly phase = signal<ExamPhase>('loading');
  readonly errorMessage = signal('');
  readonly exam = signal<ExamWithSubject | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly submission = signal<ExamSubmission | null>(null);
  readonly questionStates = signal<QuestionState[]>([]);
  readonly currentIndex = signal(0);
  readonly timeRemaining = signal(0);
  readonly isFullscreen = signal(false);
  selectedOptionValue: string | null = null;

  // Computed
  readonly currentQuestion = computed(() => this.questionStates()[this.currentIndex()] ?? null);
  readonly selectedOption = computed(() => this.currentQuestion()?.selectedOptionId ?? null);
  readonly isLastQuestion = computed(() => this.currentIndex() >= this.questions().length - 1);
  readonly answeredCount = computed(() => this.questionStates().filter(s => s.selectedOptionId !== null).length);
  readonly skippedCount = computed(() => this.questionStates().filter(s => s.wasSkipped && s.selectedOptionId === null).length);
  readonly unansweredCount = computed(() => this.questions().length - this.answeredCount());

  // @REVIEW: Sync selectedOptionValue with current question
  private syncSelectedOption = effect(() => {
    const current = this.currentQuestion();
    this.selectedOptionValue = current?.selectedOptionId ?? null;
  });

  // @REVIEW: Listen for fullscreen changes
  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
    
    // Auto-submit if fullscreen required and exited during exam
    if (this.phase() === 'in_progress' && this.exam()?.fullscreenRequired && !document.fullscreenElement) {
      this.autoSubmit('Exited fullscreen mode');
    }
  }

  // @REVIEW: Listen for visibility changes (tab switch)
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (this.phase() === 'in_progress' && this.exam()?.autoSubmitOnBlur && document.hidden) {
      this.autoSubmit('Switched away from exam tab');
    }
  }

  // @REVIEW: Warn before leaving page
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.phase() === 'in_progress') {
      event.preventDefault();
      event.returnValue = 'You have an exam in progress. Are you sure you want to leave?';
    }
  }

  ngOnInit(): void {
    const examId = this.route.snapshot.paramMap.get('id');
    if (!examId) {
      this.phase.set('error');
      this.errorMessage.set('Invalid exam ID');
      return;
    }
    this.loadExam(examId);
  }

  ngOnDestroy(): void {
    this.stopTimer();
    
    // Exit fullscreen on destroy
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  // @REVIEW: Load exam data and existing submission
  private loadExam(examId: string): void {
    const studentId = this.authStore.studentId();
    if (!studentId) {
      this.phase.set('error');
      this.errorMessage.set('Student not found');
      return;
    }

    forkJoin({
      exam: this.db.exams.getById(examId),
      questions: this.db.questions.getByExam(examId),
      existingSubmission: this.db.submissions.getByStudentAndExam(studentId, examId),
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ exam, questions, existingSubmission }) => {
        if (!exam) {
          this.phase.set('error');
          this.errorMessage.set('Exam not found');
          return;
        }

        if (exam.status !== 'active') {
          this.phase.set('error');
          this.errorMessage.set('This exam is not currently active');
          return;
        }

        if (questions.length === 0) {
          this.phase.set('error');
          this.errorMessage.set('This exam has no questions');
          return;
        }

        this.exam.set(exam);
        this.questions.set(questions);

        // Initialize question states
        const states: QuestionState[] = questions.map(q => ({
          question: q,
          answer: null,
          selectedOptionId: null,
          timeSpent: 0,
          wasSkipped: false,
          returnedTo: false,
        }));
        this.questionStates.set(states);

        // Check if resuming an in-progress submission
        if (existingSubmission?.status === 'in_progress') {
          this.submission.set(existingSubmission);
          this.loadExistingAnswers(existingSubmission.id);
        } else {
          this.phase.set('ready');
        }
      },
      error: (err) => {
        console.error('Failed to load exam:', err);
        this.phase.set('error');
        this.errorMessage.set('Failed to load exam data');
      },
    });
  }

  // @REVIEW: Load existing answers for resumed exam
  private loadExistingAnswers(submissionId: string): void {
    this.db.submissions.getById(submissionId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (submission) => {
        if (!submission) {
          this.phase.set('ready');
          return;
        }

        // Update question states with existing answers
        const states = this.questionStates().map(state => {
          const answer = submission.answers.find(a => a.questionId === state.question.id);
          if (answer) {
            return {
              ...state,
              answer,
              selectedOptionId: answer.selectedOptionId,
              timeSpent: answer.timeSpentSeconds,
              wasSkipped: answer.wasSkipped,
              returnedTo: answer.returnedTo,
            };
          }
          return state;
        });
        this.questionStates.set(states);

        // Find first unanswered question
        const firstUnanswered = states.findIndex(s => s.selectedOptionId === null && !s.wasSkipped);
        this.currentIndex.set(firstUnanswered >= 0 ? firstUnanswered : 0);

        this.phase.set('ready');
      },
      error: () => {
        this.phase.set('ready');
      },
    });
  }

  enterFullscreenAndStart(): void {
    document.documentElement.requestFullscreen().then(() => {
      this.startExamTimer();
    }).catch(() => {
      this.messageService.add({
        severity: 'error',
        summary: 'Fullscreen Required',
        detail: 'Please allow fullscreen to start the exam',
      });
    });
  }

  startExamTimer(): void {
    this.phase.set('in_progress');
    this.resetQuestionTimer();
    this.startTimer();
  }

  // @REVIEW: Timer management with takeUntilDestroyed
  private startTimer(): void {
    this.stopTimer();
    this.timerSubscription = interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const remaining = this.timeRemaining();
        if (remaining <= 1) {
          this.onTimeUp();
        } else {
          this.timeRemaining.set(remaining - 1);
          // Track time spent on current question
          this.updateTimeSpent();
        }
      });
  }

  private stopTimer(): void {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
      this.timerSubscription = null;
    }
  }

  private resetQuestionTimer(): void {
    const question = this.currentQuestion()?.question;
    const timeLimit = question?.timeLimitSeconds ?? this.exam()?.timePerQuestionSeconds ?? 60;
    this.timeRemaining.set(timeLimit);
  }

  private updateTimeSpent(): void {
    const idx = this.currentIndex();
    const states = [...this.questionStates()];
    if (states[idx]) {
      states[idx] = { ...states[idx], timeSpent: states[idx].timeSpent + 1 };
      this.questionStates.set(states);
    }
  }

  // @REVIEW: Time up - auto move or auto submit
  private onTimeUp(): void {
    const exam = this.exam();
    if (!exam) return;

    // Save current answer (even if not selected)
    this.saveCurrentAnswer().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (this.isLastQuestion()) {
        // Auto-submit on last question timeout
        this.autoSubmit('Time expired on last question');
      } else if (exam.allowSkipReturn) {
        // Skip to next if allowed
        this.skipQuestion();
      } else {
        // Move to next question
        this.goToNext();
      }
    });
  }

  // @REVIEW: Option selection
  onOptionSelect(optionId: string): void {
    const idx = this.currentIndex();
    const states = [...this.questionStates()];
    if (states[idx]) {
      states[idx] = { ...states[idx], selectedOptionId: optionId };
      this.questionStates.set(states);
    }
  }

  // @REVIEW: Get option letter (A, B, C, D) from index
  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  // @REVIEW: Navigation
  goToNext(): void {
    this.saveCurrentAnswer().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (!this.isLastQuestion()) {
        this.currentIndex.update(i => i + 1);
        this.resetQuestionTimer();
      }
    });
  }

  goToPrevious(): void {
    if (this.currentIndex() > 0 && this.exam()?.allowSkipReturn) {
      this.saveCurrentAnswer().pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(() => {
        this.currentIndex.update(i => i - 1);
        // Mark as returned
        const idx = this.currentIndex();
        const states = [...this.questionStates()];
        if (states[idx]) {
          states[idx] = { ...states[idx], returnedTo: true };
          this.questionStates.set(states);
        }
        this.resetQuestionTimer();
      });
    }
  }

  goToQuestion(index: number): void {
    if (!this.exam()?.allowSkipReturn && index !== this.currentIndex()) return;
    
    this.saveCurrentAnswer().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      const oldIdx = this.currentIndex();
      this.currentIndex.set(index);
      
      // Mark as returned if going back
      if (index < oldIdx) {
        const states = [...this.questionStates()];
        if (states[index]) {
          states[index] = { ...states[index], returnedTo: true };
          this.questionStates.set(states);
        }
      }
      this.resetQuestionTimer();
    });
  }

  skipQuestion(): void {
    if (!this.exam()?.allowSkipReturn) return;
    
    // Mark as skipped
    const idx = this.currentIndex();
    const states = [...this.questionStates()];
    if (states[idx]) {
      states[idx] = { ...states[idx], wasSkipped: true };
      this.questionStates.set(states);
    }
    
    this.saveCurrentAnswer().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => {
      if (!this.isLastQuestion()) {
        this.currentIndex.update(i => i + 1);
        this.resetQuestionTimer();
      }
    });
  }

  // @REVIEW: Save answer to database
  // Returns Observable<SubmissionAnswer | null> to unify return types
  private saveCurrentAnswer(): Observable<SubmissionAnswer | null> {
    const submission = this.submission();
    const state = this.currentQuestion();
    
    if (!submission || !state) return of(null);

    const idx = this.currentIndex();
    
    if (state.answer) {
      // Update existing answer
      return this.db.submissions.updateAnswer(state.answer.id, {
        selectedOptionId: state.selectedOptionId ?? undefined,
        timeSpentSeconds: state.timeSpent,
        returnedTo: state.returnedTo,
      }).pipe(
        tap((answer: SubmissionAnswer) => {
          const states = [...this.questionStates()];
          states[idx] = { ...states[idx], answer };
          this.questionStates.set(states);
        })
      );
    } else {
      // Create new answer
      return this.db.submissions.submitAnswer({
        submissionId: submission.id,
        questionId: state.question.id,
        selectedOptionId: state.selectedOptionId ?? undefined,
        timeSpentSeconds: state.timeSpent,
        timeRemainingSeconds: this.timeRemaining(),
        wasSkipped: state.wasSkipped,
        sequenceAnswered: idx + 1,
      }).pipe(
        tap((answer: SubmissionAnswer) => {
          const states = [...this.questionStates()];
          states[idx] = { ...states[idx], answer };
          this.questionStates.set(states);
        })
      );
    }
  }

  // @REVIEW: Confirm submit dialog
  confirmSubmit(): void {
    const unanswered = this.unansweredCount();
    
    this.confirmService.confirm({
      header: 'Submit Exam?',
      message: unanswered > 0 
        ? `You have ${unanswered} unanswered question(s). Are you sure you want to submit?`
        : 'Are you sure you want to submit your exam?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Submit',
      rejectLabel: 'Cancel',
      accept: () => this.submitExam(),
    });
  }

  // @REVIEW: Submit exam
  private submitExam(): void {
    const submission = this.submission();
    if (!submission) return;

    this.stopTimer();
    this.phase.set('submitting');

    // Save final answer first
    this.saveCurrentAnswer().pipe(
      switchMap(() => this.db.submissions.submitExam(submission.id)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result: ExamSubmission) => {
        this.submission.set(result);
        this.phase.set('completed');
        
        // Exit fullscreen
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      },
      error: (err: Error) => {
        console.error('Failed to submit exam:', err);
        this.phase.set('in_progress');
        this.startTimer();
        this.messageService.add({
          severity: 'error',
          summary: 'Submission Failed',
          detail: 'Failed to submit exam. Please try again.',
        });
      },
    });
  }

  // @REVIEW: Auto-submit (blur, fullscreen exit, etc.)
  private autoSubmit(reason: string): void {
    const submission = this.submission();
    if (!submission || this.phase() !== 'in_progress') return;

    this.stopTimer();
    this.phase.set('submitting');

    this.saveCurrentAnswer().pipe(
      switchMap(() => this.db.submissions.autoSubmitExam(submission.id, reason)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result: ExamSubmission) => {
        this.submission.set(result);
        this.phase.set('completed');
        
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      },
      error: (_err: Error) => {
        this.phase.set('completed');
      },
    });
  }

  // Helpers
  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getQuestionTooltip(state: QuestionState, index: number): string {
    if (state.selectedOptionId) return `Q${index + 1}: Answered`;
    if (state.wasSkipped) return `Q${index + 1}: Skipped`;
    return `Q${index + 1}: Not visited`;
  }

  navigateToExams(): void {
    this.router.navigate(['/student/exams']);
  }

  navigateToResults(): void {
    this.router.navigate(['/student/results']);
  }
}
