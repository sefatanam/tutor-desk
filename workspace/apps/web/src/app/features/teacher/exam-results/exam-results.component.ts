// @REVIEW: Exam Results - View all student submissions for an exam
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
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

import {
  ExamSubmission,
  ExamWithSubject,
  StudentWithUser,
} from '../../../core/models';

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
  templateUrl: './exam-results.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExamResultsComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

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
    return this.submissions().filter(
      (row) =>
        (row.student?.user?.fullName?.toLowerCase().includes(search) ??
          false) ||
        (row.student?.user?.email?.toLowerCase().includes(search) ?? false)
    );
  });

  readonly statsCards = computed(() => {
    const items = this.submissions();
    const completed = items.filter(
      (r) => r.submission.status !== 'in_progress'
    );
    const total = completed.length;
    const passed = completed.filter(
      (r) => r.submission.score >= (this.exam()?.passingMarks ?? 0)
    ).length;
    const avgScore =
      total > 0
        ? Math.round(
            completed.reduce((sum, r) => sum + r.submission.percentage, 0) /
              total
          )
        : 0;
    const highestScore =
      total > 0 ? Math.max(...completed.map((r) => r.submission.score)) : 0;
    const inProgress = items.filter(
      (r) => r.submission.status === 'in_progress'
    ).length;

    return [
      {
        icon: 'pi pi-users',
        label: 'Total Submissions',
        value: items.length,
        color: 'var(--primary-color)',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Passed',
        value: passed,
        color: 'var(--green-500)',
      },
      {
        icon: 'pi pi-times-circle',
        label: 'Failed',
        value: total - passed,
        color: 'var(--red-500)',
      },
      {
        icon: 'pi pi-chart-line',
        label: 'Avg Score',
        value: `${avgScore}%`,
        color: 'var(--blue-500)',
      },
      {
        icon: 'pi pi-clock',
        label: 'In Progress',
        value: inProgress,
        color: 'var(--orange-500)',
      },
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
      submissions: this.db.submissions.getByExam(examId, {
        page: 1,
        pageSize: 500,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ exam, submissions }) => {
          this.exam.set(exam);

          if (submissions.items.length === 0) {
            this.submissions.set([]);
            this.loading.set(false);
            return;
          }

          // Fetch student details for each submission
          const studentIds = [
            ...new Set(submissions.items.map((s) => s.studentId)),
          ];
          const studentRequests = studentIds.map((id) =>
            this.db.students.getById(id)
          );

          forkJoin(studentRequests)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (students) => {
                const studentMap = new Map<string, StudentWithUser | null>();
                studentIds.forEach((id, index) => {
                  studentMap.set(id, students[index]);
                });

                const rows: SubmissionRow[] = submissions.items.map((sub) => ({
                  submission: sub,
                  student: studentMap.get(sub.studentId) ?? null,
                }));

                // Sort by submitted date desc, in_progress first
                rows.sort((a, b) => {
                  if (
                    a.submission.status === 'in_progress' &&
                    b.submission.status !== 'in_progress'
                  )
                    return -1;
                  if (
                    a.submission.status !== 'in_progress' &&
                    b.submission.status === 'in_progress'
                  )
                    return 1;
                  return (
                    (b.submission.submittedAt?.getTime() ?? 0) -
                    (a.submission.submittedAt?.getTime() ?? 0)
                  );
                });

                this.submissions.set(rows);
                this.loading.set(false);
              },
              error: (err) => {
                console.error('Failed to load students:', err);
                // Still show submissions without student details
                this.submissions.set(
                  submissions.items.map((sub) => ({
                    submission: sub,
                    student: null,
                  }))
                );
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
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  viewDetails(row: SubmissionRow): void {
    this.selectedRow.set(row);
    this.remarksInput = row.submission.remarks ?? '';
    this.showDetailsDialog = true;
  }

  saveRemarks(): void {
    const row = this.selectedRow();
    if (!row) return;

    this.savingRemarks.set(true);

    this.db.submissions
      .evaluate(
        row.submission.id,
        this.authStore.user()?.id ?? '',
        this.remarksInput || undefined
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          // Update the submission in the list
          this.submissions.update((list) =>
            list.map((r) =>
              r.submission.id === updated.id ? { ...r, submission: updated } : r
            )
          );
          this.selectedRow.update((r) =>
            r ? { ...r, submission: updated } : null
          );
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
      message: `Allow ${
        row.student?.user?.fullName ?? 'this student'
      } to retake this exam?`,
      header: 'Allow Retake',
      icon: 'pi pi-refresh',
      acceptLabel: 'Allow Retake',
      rejectLabel: 'Cancel',
      accept: () => this.allowRetake(row),
    });
  }

  private allowRetake(row: SubmissionRow): void {
    this.db.submissions
      .allowRetake(row.submission.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.submissions.update((list) =>
            list.map((r) =>
              r.submission.id === updated.id ? { ...r, submission: updated } : r
            )
          );
          this.messageService.add({
            severity: 'success',
            summary: 'Retake Allowed',
            detail: `${
              row.student?.user?.fullName ?? 'Student'
            } can now retake this exam`,
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
      message: `Cancel retake permission for ${
        row.student?.user?.fullName ?? 'this student'
      }? Their previous result will be restored.`,
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
    this.db.submissions
      .cancelRetake(row.submission.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.submissions.update((list) =>
            list.map((r) =>
              r.submission.id === updated.id ? { ...r, submission: updated } : r
            )
          );
          this.messageService.add({
            severity: 'success',
            summary: 'Retake Cancelled',
            detail: `${
              row.student?.user?.fullName ?? 'Student'
            }'s retake permission has been revoked`,
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
