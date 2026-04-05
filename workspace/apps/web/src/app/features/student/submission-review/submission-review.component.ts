// @REVIEW: Student Submission Review - View own exam submission with visibility settings
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
import {
  PdfExportService,
  PdfQuestionItem,
} from '../../../core/services/pdf-export.service';
import { CsvExportService } from '../../../core/services/csv-export.service';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

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
  templateUrl: './submission-review.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmissionReviewComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  // @REVIEW: Export services for PDF and CSV generation
  private readonly pdfExportService = inject(PdfExportService);
  private readonly csvExportService = inject(CsvExportService);
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly submission = signal<ExamSubmissionWithDetails | null>(null);
  readonly exam = signal<Exam | null>(null);
  readonly subject = signal<Subject | null>(null);
  readonly questions = signal<Question[]>([]);
  readonly filterStatus = signal<'all' | 'correct' | 'wrong' | 'skipped'>(
    'all'
  );
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
    return exam
      ? getResultAvailabilityMessage(exam)
      : 'Results are not available.';
  });

  // Computed: Build review items
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
    if (status === 'skipped') {
      return items.filter(
        (i) => i.status === 'skipped' || i.status === 'unanswered'
      );
    }
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
    const studentId = this.authStore.studentId();

    this.db.submissions
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (submission) => {
          if (!submission) {
            this.loading.set(false);
            return;
          }

          // @REVIEW: Security check - ensure student can only view their own submissions
          if (submission.studentId !== studentId) {
            console.warn(
              "Access denied: Student trying to view another student's submission"
            );
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
            student: studentId ? this.db.students.getById(studentId) : of(null),
          })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
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
    this.db.submissions
      .getByExam(examId, { page: 1, pageSize: 1000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const completedSubmissions = response.items.filter(
            (s) =>
              s.status === 'submitted' ||
              s.status === 'auto_submitted' ||
              s.status === 'evaluated'
          );

          this.totalSubmissions.set(completedSubmissions.length);

          // Sort by score descending and find rank
          const sorted = [...completedSubmissions].sort(
            (a, b) => b.score - a.score
          );
          const rankIndex = sorted.findIndex((s) => s.score <= studentScore);
          this.rank.set(rankIndex + 1);
        },
        error: (err) => {
          console.error('Failed to load rank:', err);
        },
      });
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

  getAutoSubmitReasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      tab_blur: 'Left the exam tab',
      window_blur: 'Left the browser window',
      time_expired: 'Time limit reached',
      visibility_change: 'Browser visibility changed',
    };
    return labels[reason] ?? reason;
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
