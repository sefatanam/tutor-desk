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
  styles: `
    .subject-detail-page { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
    
    .page-nav { margin-bottom: 1rem; }
    
    .loading-container { padding: 2rem; }
    
    .not-found { 
      display: flex; flex-direction: column; align-items: center; justify-content: center; 
      padding: 4rem 2rem; text-align: center;
    }
    .not-found i { font-size: 4rem; color: var(--text-color-secondary); margin-bottom: 1rem; }
    .not-found h2 { margin: 0 0 0.5rem; }
    .not-found p { color: var(--text-color-secondary); margin-bottom: 1.5rem; }
    
    .subject-header { 
      display: flex; justify-content: space-between; align-items: flex-start; 
      margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;
    }
    .subject-header__info { display: flex; gap: 1rem; align-items: flex-start; }
    .subject-icon { 
      width: 64px; height: 64px; border-radius: 16px; 
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.5rem; flex-shrink: 0;
    }
    .subject-details { display: flex; flex-direction: column; gap: 0.25rem; }
    .subject-name { margin: 0; font-size: 1.75rem; font-weight: 600; }
    .subject-code { 
      font-size: 0.875rem; color: var(--text-color-secondary); 
      background: var(--surface-ground); padding: 0.25rem 0.5rem; border-radius: 4px;
      width: fit-content;
    }
    .subject-description { margin: 0.5rem 0 0; color: var(--text-color-secondary); max-width: 500px; }
    .subject-header__actions { display: flex; align-items: center; gap: 1rem; }
    
    .stats-row { 
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
      gap: 1rem; margin-bottom: 2rem; 
    }
    :host ::ng-deep .stat-card .p-card-body { padding: 1rem; }
    .stat-card__content { display: flex; align-items: center; gap: 1rem; }
    .stat-card__icon { 
      display: flex; align-items: center; justify-content: center; 
      width: 48px; height: 48px; border-radius: 12px; color: white; font-size: 1.25rem; 
    }
    .stat-card__text { display: flex; flex-direction: column; }
    .stat-card__value { font-size: 1.5rem; font-weight: 700; }
    .stat-card__label { font-size: 0.875rem; color: var(--text-color-secondary); }
    
    .content-grid { 
      display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; 
    }
    @media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }
    
    .card-header { 
      display: flex; justify-content: space-between; align-items: center; 
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--surface-border);
    }
    .card-header__title { 
      margin: 0; font-size: 1.125rem; font-weight: 600; 
      display: flex; align-items: center; gap: 0.5rem;
    }
    .card-header__title i { color: var(--primary-color); }
    
    .empty-state-small { 
      display: flex; flex-direction: column; align-items: center; 
      padding: 2rem; text-align: center; color: var(--text-color-secondary);
    }
    .empty-state-small i { font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5; }
    .empty-state-small p { margin: 0 0 1rem; }
    
    .skeleton-list { padding: 1rem; }
    
    .enrolled-list, .available-list { 
      display: flex; flex-direction: column; max-height: 400px; overflow-y: auto; 
    }
    .enrolled-item, .available-item { 
      display: flex; align-items: center; gap: 0.75rem; 
      padding: 0.75rem 1rem; border-bottom: 1px solid var(--surface-border);
    }
    .enrolled-item:last-child, .available-item:last-child { border-bottom: none; }
    .enrolled-item__avatar, .available-item__avatar { 
      width: 40px; height: 40px; border-radius: 50%; 
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 600; font-size: 0.875rem; flex-shrink: 0;
    }
    .enrolled-item__info, .available-item__info { 
      flex: 1; display: flex; flex-direction: column; min-width: 0; 
    }
    .enrolled-item__name, .available-item__name { 
      font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
    }
    .enrolled-item__email, .available-item__email { 
      font-size: 0.75rem; color: var(--text-color-secondary); 
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    
    .exams-list { display: flex; flex-direction: column; }
    .exam-item { 
      display: flex; justify-content: space-between; align-items: center;
      padding: 1rem 1.5rem; border-bottom: 1px solid var(--surface-border);
    }
    .exam-item:last-child { border-bottom: none; }
    .exam-item__info { display: flex; flex-direction: column; gap: 0.25rem; }
    .exam-item__title { font-weight: 500; }
    .exam-item__meta { 
      display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-color-secondary); 
      flex-wrap: wrap;
    }
    .exam-item__meta span { display: flex; align-items: center; gap: 0.25rem; }
    .exam-item__meta .submissions-badge { 
      color: var(--primary-color); font-weight: 500;
      background: var(--primary-50); padding: 0.125rem 0.5rem; border-radius: 4px;
    }
    .exam-item__actions { display: flex; align-items: center; gap: 0.5rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectDetailComponent implements OnInit {
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
      '#f87171',
      '#fb923c',
      '#fbbf24',
      '#a3e635',
      '#4ade80',
      '#2dd4bf',
      '#38bdf8',
      '#818cf8',
      '#c084fc',
      '#f472b6',
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
