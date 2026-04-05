// @REVIEW: Student Detail Page - View student info and manage subject enrollments
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
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { DialogModule } from 'primeng/dialog';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin, of, switchMap } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { StudentWithUser, Subject, ExamSubmission } from '../../../core/models';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';


// @REVIEW: Exam history item with exam details
interface ExamHistoryItem {
  readonly submission: ExamSubmission;
  readonly examTitle: string;
  readonly subjectName: string;
  readonly subjectColor: string;
  readonly totalMarks: number;
  readonly passingMarks: number;
  readonly passed: boolean;
}

@Component({
  selector: 'app-student-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ConfirmDialogModule,
    ToastModule,
    SkeletonModule,
    DividerModule,
    TableModule,
    DialogModule,
    ProgressBarModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './student-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentDetailComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly loadingSubjects = signal(true);
  readonly student = signal<StudentWithUser | null>(null);
  readonly allSubjects = signal<Subject[]>([]);
  readonly enrolledSubjects = signal<Subject[]>([]);
  readonly enrollingSubjectId = signal<string | null>(null);

  // @REVIEW: Exam history state
  readonly loadingExamHistory = signal(true);
  readonly examHistory = signal<ExamHistoryItem[]>([]);
  readonly selectedExamHistory = signal<ExamHistoryItem | null>(null);
  showExamDetailsDialog = false;

  subjectSearchFilter = '';

  readonly teacherId = computed(() => this.authStore.teacherId());
  // @REVIEW: User ID for enrolled_by field (references users table, not teachers table)
  readonly userId = computed(() => this.authStore.user()?.id ?? null);

  // @REVIEW: Compute available (not enrolled) subjects
  readonly availableSubjects = computed(() => {
    const enrolled = new Set(this.enrolledSubjects().map((s) => s.id));
    return this.allSubjects().filter((s) => !enrolled.has(s.id) && s.isActive);
  });

  // @REVIEW: Filter available subjects by search
  readonly filteredAvailableSubjects = computed(() => {
    const filter = this.subjectSearchFilter.toLowerCase().trim();
    if (!filter) return this.availableSubjects();
    return this.availableSubjects().filter(
      (s) =>
        s.name.toLowerCase().includes(filter) ||
        (s.code?.toLowerCase().includes(filter) ?? false)
    );
  });

  ngOnInit(): void {
    const studentId = this.route.snapshot.paramMap.get('id');
    if (!studentId) {
      this.loading.set(false);
      return;
    }
    this.loadStudent(studentId);
    this.loadSubjects(studentId);
    this.loadExamHistory(studentId);
  }

  private loadStudent(id: string): void {
    this.db.students
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (student) => {
          this.student.set(student);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load student:', err);
          this.loading.set(false);
        },
      });
  }

  private loadSubjects(studentId: string): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.loadingSubjects.set(true);

    // Load all teacher's subjects and student's enrolled subjects in parallel
    forkJoin({
      all: this.db.subjects.getByTeacher(teacherId, { page: 1, pageSize: 500 }),
      enrolled: this.db.subjects.getByStudent(studentId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ all, enrolled }) => {
          this.allSubjects.set(all.items);
          this.enrolledSubjects.set(enrolled);
          this.loadingSubjects.set(false);
        },
        error: (err) => {
          console.error('Failed to load subjects:', err);
          this.loadingSubjects.set(false);
        },
      });
  }

  enrollInSubject(subject: Subject): void {
    const student = this.student();
    const userId = this.userId();
    if (!student || !userId) return;

    this.enrollingSubjectId.set(subject.id);

    // @REVIEW: Use userId (not teacherId) for enrolled_by - references users table
    this.db.subjects
      .enrollStudent(student.id, subject.id, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Move subject from available to enrolled
          this.enrolledSubjects.update((list) => [...list, subject]);
          this.enrollingSubjectId.set(null);
          this.messageService.add({
            severity: 'success',
            summary: 'Enrolled',
            detail: `${student.user.fullName} has been enrolled in ${subject.name}`,
          });
        },
        error: (err) => {
          console.error('Failed to enroll student:', err);
          this.enrollingSubjectId.set(null);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to enroll in subject',
          });
        },
      });
  }

  confirmUnenroll(subject: Subject): void {
    const student = this.student();
    if (!student) return;

    this.confirmationService.confirm({
      message: `Remove ${student.user.fullName} from ${subject.name}? They will lose access to exams in this subject.`,
      header: 'Confirm Removal',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.unenrollFromSubject(subject),
    });
  }

  private unenrollFromSubject(subject: Subject): void {
    const student = this.student();
    if (!student) return;

    this.db.subjects
      .unenrollStudent(student.id, subject.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Remove subject from enrolled list
          this.enrolledSubjects.update((list) =>
            list.filter((s) => s.id !== subject.id)
          );
          this.messageService.add({
            severity: 'success',
            summary: 'Removed',
            detail: `${student.user.fullName} has been removed from ${subject.name}`,
          });
        },
        error: (err) => {
          console.error('Failed to unenroll student:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to remove from subject',
          });
        },
      });
  }

  // @REVIEW: Load student's exam history with exam details
  private loadExamHistory(studentId: string): void {
    this.loadingExamHistory.set(true);

    this.db.submissions
      .getByStudent(studentId, { page: 1, pageSize: 100 })
      .pipe(
        switchMap((response) => {
          // Filter to completed submissions only
          const completedSubmissions = response.items.filter(
            (s) =>
              s.status === 'submitted' ||
              s.status === 'auto_submitted' ||
              s.status === 'evaluated'
          );

          if (completedSubmissions.length === 0) {
            return of([]);
          }

          // Get exam details for each submission
          const examRequests = completedSubmissions.map((sub) =>
            this.db.exams.getById(sub.examId).pipe(
              switchMap((exam) => {
                if (!exam) return of(null);
                return of({
                  submission: sub,
                  examTitle: exam.title,
                  subjectName: exam.subject?.name ?? 'Independent Exam',
                  subjectColor: exam.subject?.color ?? '#6b7280',
                  totalMarks: exam.totalMarks,
                  passingMarks: exam.passingMarks,
                  passed: sub.score >= exam.passingMarks,
                } as ExamHistoryItem);
              })
            )
          );

          return forkJoin(examRequests);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          const validItems = (items ?? []).filter(
            (item): item is ExamHistoryItem => item !== null
          );
          // Sort by submitted date descending
          validItems.sort(
            (a, b) =>
              (b.submission.submittedAt?.getTime() ?? 0) -
              (a.submission.submittedAt?.getTime() ?? 0)
          );
          this.examHistory.set(validItems);
          this.loadingExamHistory.set(false);
        },
        error: (err) => {
          console.error('Failed to load exam history:', err);
          this.loadingExamHistory.set(false);
        },
      });
  }

  // @REVIEW: View exam details in dialog
  viewExamDetails(item: ExamHistoryItem): void {
    this.selectedExamHistory.set(item);
    this.showExamDetailsDialog = true;
  }

  getAvatarColor(name: string): string {
    const colors = [
      'td-tone-danger',
      'td-tone-warning',
      'td-tone-warning',
      'td-tone-success',
      'td-tone-success',
      'td-tone-info',
      'td-tone-info',
      'td-tone-primary',
      'td-tone-accent',
      'td-tone-accent',
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

  getStatusSeverity(
    status: string
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<
      string,
      'success' | 'info' | 'warn' | 'danger' | 'secondary'
    > = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
      suspended: 'danger',
    };
    return map[status] ?? 'secondary';
  }
}
