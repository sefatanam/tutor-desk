// @REVIEW: Subject Detail Page - View subject info and manage student enrollments
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
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { Subject, StudentWithUser, Exam } from '../../../core/models';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';


// @REVIEW: Exam stats for display in list
interface ExamStats {
  readonly totalSubmissions: number;
  readonly completedSubmissions: number;
  readonly avgScore: number;
}

@Component({
  selector: 'app-subject-detail',
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
    ConfirmDialogModule,
    ToastModule,
    SkeletonModule,
    DividerModule,
    CheckboxModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './subject-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectDetailComponent implements OnInit {
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
  readonly loadingStudents = signal(true);
  readonly loadingExams = signal(true);
  readonly subject = signal<Subject | null>(null);
  readonly allStudents = signal<StudentWithUser[]>([]);
  readonly enrolledStudents = signal<StudentWithUser[]>([]);
  readonly exams = signal<Exam[]>([]);
  readonly enrollingStudentId = signal<string | null>(null);
  // @REVIEW: Exam stats map for submission counts
  readonly examStatsMap = signal<Record<string, ExamStats>>({});

  studentSearchFilter = '';

  readonly teacherId = computed(() => this.authStore.teacherId());
  // @REVIEW: User ID for enrolled_by field (references users table, not teachers table)
  readonly userId = computed(() => this.authStore.user()?.id ?? null);

  // @REVIEW: Compute available (not enrolled) students
  readonly availableStudents = computed(() => {
    const enrolled = new Set(this.enrolledStudents().map((s) => s.id));
    return this.allStudents().filter((s) => !enrolled.has(s.id));
  });

  // @REVIEW: Filter available students by search
  readonly filteredAvailableStudents = computed(() => {
    const filter = this.studentSearchFilter.toLowerCase().trim();
    if (!filter) return this.availableStudents();
    return this.availableStudents().filter(
      (s) =>
        s.user.fullName.toLowerCase().includes(filter) ||
        s.user.email.toLowerCase().includes(filter)
    );
  });

  readonly activeExamsCount = computed(
    () => this.exams().filter((e) => e.status === 'active').length
  );

  ngOnInit(): void {
    const subjectId = this.route.snapshot.paramMap.get('id');
    if (!subjectId) {
      this.loading.set(false);
      return;
    }
    this.loadSubject(subjectId);
    this.loadStudents(subjectId);
    this.loadExams(subjectId);
  }

  private loadSubject(id: string): void {
    this.db.subjects
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (subject) => {
          this.subject.set(subject);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load subject:', err);
          this.loading.set(false);
        },
      });
  }

  private loadStudents(subjectId: string): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.loadingStudents.set(true);

    // Load all teacher's students and enrolled students in parallel
    forkJoin({
      all: this.db.students.getByTeacher(teacherId, { page: 1, pageSize: 500 }),
      enrolled: this.db.subjects.getEnrolledStudents(subjectId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ all, enrolled }) => {
          this.allStudents.set(all.items);
          this.enrolledStudents.set(enrolled);
          this.loadingStudents.set(false);
        },
        error: (err) => {
          console.error('Failed to load students:', err);
          this.loadingStudents.set(false);
        },
      });
  }

  private loadExams(subjectId: string): void {
    this.loadingExams.set(true);
    this.db.exams
      .getBySubject(subjectId, { page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.exams.set(response.items);
          this.loadingExams.set(false);
          // @REVIEW: Load stats for each exam
          this.loadExamStats(response.items);
        },
        error: (err) => {
          console.error('Failed to load exams:', err);
          this.loadingExams.set(false);
        },
      });
  }

  // @REVIEW: Load submission stats for each exam
  private loadExamStats(examList: Exam[]): void {
    if (examList.length === 0) return;

    const statRequests = examList.map((exam) =>
      this.db.submissions.getByExam(exam.id, { page: 1, pageSize: 500 }).pipe()
    );

    forkJoin(statRequests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (responses) => {
          const statsMap: Record<string, ExamStats> = {};

          examList.forEach((exam, index) => {
            const submissions = responses[index].items;
            const completed = submissions.filter(
              (s) =>
                s.status === 'submitted' ||
                s.status === 'auto_submitted' ||
                s.status === 'evaluated'
            );

            const avgScore =
              completed.length > 0
                ? Math.round(
                    completed.reduce((sum, s) => sum + s.percentage, 0) /
                      completed.length
                  )
                : 0;

            statsMap[exam.id] = {
              totalSubmissions: submissions.length,
              completedSubmissions: completed.length,
              avgScore,
            };
          });

          this.examStatsMap.set(statsMap);
        },
        error: (err) => {
          console.error('Failed to load exam stats:', err);
        },
      });
  }

  enrollStudent(student: StudentWithUser): void {
    const subject = this.subject();
    const userId = this.userId();
    if (!subject || !userId) return;

    this.enrollingStudentId.set(student.id);

    // @REVIEW: Use userId (not teacherId) for enrolled_by - references users table
    this.db.subjects
      .enrollStudent(student.id, subject.id, userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Move student from available to enrolled
          this.enrolledStudents.update((list) => [...list, student]);
          this.enrollingStudentId.set(null);
          this.messageService.add({
            severity: 'success',
            summary: 'Enrolled',
            detail: `${student.user.fullName} has been enrolled in ${subject.name}`,
          });
        },
        error: (err) => {
          console.error('Failed to enroll student:', err);
          this.enrollingStudentId.set(null);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to enroll student',
          });
        },
      });
  }

  confirmUnenroll(student: StudentWithUser): void {
    const subject = this.subject();
    if (!subject) return;

    this.confirmationService.confirm({
      message: `Remove ${student.user.fullName} from ${subject.name}? They will lose access to exams in this subject.`,
      header: 'Confirm Removal',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.unenrollStudent(student),
    });
  }

  private unenrollStudent(student: StudentWithUser): void {
    const subject = this.subject();
    if (!subject) return;

    this.db.subjects
      .unenrollStudent(student.id, subject.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          // Remove student from enrolled list
          this.enrolledStudents.update((list) =>
            list.filter((s) => s.id !== student.id)
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
            detail: 'Failed to remove student',
          });
        },
      });
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

  getExamStatusSeverity(
    status: string
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<
      string,
      'success' | 'info' | 'warn' | 'danger' | 'secondary'
    > = {
      draft: 'secondary',
      scheduled: 'info',
      active: 'success',
      completed: 'warn',
      cancelled: 'danger',
    };
    return map[status] ?? 'secondary';
  }
}
