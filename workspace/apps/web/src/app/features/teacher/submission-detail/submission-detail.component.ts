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
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

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
  templateUrl: './submission-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmissionDetailComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
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
      'td-tone-info',
      'td-tone-danger',
      'td-tone-success',
      'td-tone-warning',
      'td-tone-accent',
      'td-tone-accent',
      'td-tone-info',
      'td-tone-success',
      'td-tone-warning',
      'td-tone-primary',
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
