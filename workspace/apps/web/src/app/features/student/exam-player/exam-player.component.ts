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
import {
  interval,
  switchMap,
  forkJoin,
  of,
  tap,
  catchError,
  Observable,
  Subscription,
} from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

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

type ExamPhase =
  | 'loading'
  | 'ready'
  | 'in_progress'
  | 'submitting'
  | 'completed'
  | 'error';

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
  templateUrl: './exam-player.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamPlayerComponent implements OnInit, OnDestroy {
  readonly getThemeToneClass = getThemeToneClass;
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
  readonly currentQuestion = computed(
    () => this.questionStates()[this.currentIndex()] ?? null
  );
  readonly selectedOption = computed(
    () => this.currentQuestion()?.selectedOptionId ?? null
  );
  readonly isLastQuestion = computed(
    () => this.currentIndex() >= this.questions().length - 1
  );
  readonly answeredCount = computed(
    () =>
      this.questionStates().filter((s) => s.selectedOptionId !== null).length
  );
  readonly skippedCount = computed(
    () =>
      this.questionStates().filter(
        (s) => s.wasSkipped && s.selectedOptionId === null
      ).length
  );
  readonly unansweredCount = computed(
    () => this.questions().length - this.answeredCount()
  );

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
    if (
      this.phase() === 'in_progress' &&
      this.exam()?.fullscreenRequired &&
      !document.fullscreenElement
    ) {
      this.autoSubmit('Exited fullscreen mode');
    }
  }

  // @REVIEW: Listen for visibility changes (tab switch)
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (
      this.phase() === 'in_progress' &&
      this.exam()?.autoSubmitOnBlur &&
      document.hidden
    ) {
      this.autoSubmit('Switched away from exam tab');
    }
  }

  // @REVIEW: Warn before leaving page
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.phase() === 'in_progress') {
      event.preventDefault();
      event.returnValue =
        'You have an exam in progress. Are you sure you want to leave?';
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
      existingSubmission: this.db.submissions.getByStudentAndExam(
        studentId,
        examId
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
          const states: QuestionState[] = questions.map((q) => ({
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
    this.db.submissions
      .getById(submissionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (submission) => {
          if (!submission) {
            this.phase.set('ready');
            return;
          }

          // Update question states with existing answers
          const states = this.questionStates().map((state) => {
            const answer = submission.answers.find(
              (a) => a.questionId === state.question.id
            );
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
          const firstUnanswered = states.findIndex(
            (s) => s.selectedOptionId === null && !s.wasSkipped
          );
          this.currentIndex.set(firstUnanswered >= 0 ? firstUnanswered : 0);

          this.phase.set('ready');
        },
        error: () => {
          this.phase.set('ready');
        },
      });
  }

  enterFullscreenAndStart(): void {
    document.documentElement
      .requestFullscreen()
      .then(() => {
        this.startExamTimer();
      })
      .catch(() => {
        this.messageService.add({
          severity: 'error',
          summary: 'Fullscreen Required',
          detail: 'Please allow fullscreen to start the exam',
        });
      });
  }

  startExamTimer(): void {
    // Resuming an in-progress exam — submission already set
    if (this.submission()) {
      this.phase.set('in_progress');
      this.resetQuestionTimer();
      this.startTimer();
      return;
    }

    // New attempt — create submission first
    const exam = this.exam();
    if (!exam) return;

    this.db.submissions
      .startExam(exam.id, this.authStore.studentId() ?? '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (submission) => {
          this.submission.set(submission);
          this.phase.set('in_progress');
          this.resetQuestionTimer();
          this.startTimer();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to start exam. Please try again.',
          });
        },
      });
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
    const timeLimit =
      question?.timeLimitSeconds ?? this.exam()?.timePerQuestionSeconds ?? 60;
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
    this.stopTimer();
    this.timeRemaining.set(0);
    const exam = this.exam();
    if (!exam) return;

    this.saveCurrentAnswer()
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isLastQuestion()) {
          this.autoSubmit('Time expired on last question');
        } else {
          if (exam.allowSkipReturn) {
            const idx = this.currentIndex();
            const states = [...this.questionStates()];
            if (states[idx]) {
              states[idx] = { ...states[idx], wasSkipped: true };
              this.questionStates.set(states);
            }
          }
          this.currentIndex.update((i) => i + 1);
          this.resetQuestionTimer();
          this.startTimer();
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
    this.saveCurrentAnswer()
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.isLastQuestion()) {
          this.currentIndex.update((i) => i + 1);
          this.resetQuestionTimer();
          this.stopTimer();
          this.startTimer();
        }
      });
  }

  goToPrevious(): void {
    if (this.currentIndex() > 0 && this.exam()?.allowSkipReturn) {
      this.saveCurrentAnswer()
        .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.currentIndex.update((i) => i - 1);
          const idx = this.currentIndex();
          const states = [...this.questionStates()];
          if (states[idx]) {
            states[idx] = { ...states[idx], returnedTo: true };
            this.questionStates.set(states);
          }
          this.resetQuestionTimer();
          this.stopTimer();
          this.startTimer();
        });
    }
  }

  goToQuestion(index: number): void {
    if (!this.exam()?.allowSkipReturn && index !== this.currentIndex()) return;

    this.saveCurrentAnswer()
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const oldIdx = this.currentIndex();
        this.currentIndex.set(index);

        if (index < oldIdx) {
          const states = [...this.questionStates()];
          if (states[index]) {
            states[index] = { ...states[index], returnedTo: true };
            this.questionStates.set(states);
          }
        }
        this.resetQuestionTimer();
        this.stopTimer();
        this.startTimer();
      });
  }

  skipQuestion(): void {
    if (!this.exam()?.allowSkipReturn) return;

    const idx = this.currentIndex();
    const states = [...this.questionStates()];
    if (states[idx]) {
      states[idx] = { ...states[idx], wasSkipped: true };
      this.questionStates.set(states);
    }

    this.saveCurrentAnswer()
      .pipe(catchError(() => of(null)), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.isLastQuestion()) {
          this.currentIndex.update((i) => i + 1);
          this.resetQuestionTimer();
          this.stopTimer();
          this.startTimer();
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
      return this.db.submissions
        .updateAnswer(state.answer.id, {
          selectedOptionId: state.selectedOptionId ?? undefined,
          timeSpentSeconds: state.timeSpent,
          returnedTo: state.returnedTo,
        })
        .pipe(
          tap((answer: SubmissionAnswer) => {
            const states = [...this.questionStates()];
            states[idx] = { ...states[idx], answer };
            this.questionStates.set(states);
          })
        );
    } else {
      // Create new answer
      return this.db.submissions
        .submitAnswer({
          submissionId: submission.id,
          questionId: state.question.id,
          selectedOptionId: state.selectedOptionId ?? undefined,
          timeSpentSeconds: state.timeSpent,
          timeRemainingSeconds: this.timeRemaining(),
          wasSkipped: state.wasSkipped,
          sequenceAnswered: idx + 1,
        })
        .pipe(
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
      message:
        unanswered > 0
          ? `You have ${unanswered} unanswered question(s). Are you sure you want to submit?`
          : 'Are you sure you want to submit your exam?',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Submit',
      rejectLabel: 'Cancel',
      accept: () => this.submitExam(),
    });
  }

  // @REVIEW: Submit exam
  submitExam(): void {
    const submission = this.submission();
    if (!submission) return;

    this.stopTimer();
    this.phase.set('submitting');

    this.saveCurrentAnswer()
      .pipe(
        catchError(() => of(null)),
        switchMap(() => this.db.submissions.submitExam(submission.id)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
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

    this.saveCurrentAnswer()
      .pipe(
        catchError(() => of(null)),
        switchMap(() =>
          this.db.submissions.autoSubmitExam(submission.id, reason)
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
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
