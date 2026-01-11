// @REVIEW: Subject Detail Page - View subject info and manage student enrollments
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
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
  template: `
    <div class="subject-detail-page">
      <!-- Breadcrumb & Back -->
      <div class="page-nav">
        <p-button 
          icon="pi pi-arrow-left" 
          label="Back to Subjects" 
          [text]="true" 
          routerLink="/teacher/subjects"
        />
      </div>

      @if (loading()) {
        <div class="loading-container">
          <p-skeleton width="300px" height="32px" styleClass="mb-3" />
          <p-skeleton width="200px" height="20px" />
        </div>
      } @else if (!subject()) {
        <div class="not-found">
          <i class="pi pi-exclamation-circle"></i>
          <h2>Subject Not Found</h2>
          <p>The subject you're looking for doesn't exist or has been deleted.</p>
          <p-button label="Go to Subjects" routerLink="/teacher/subjects" />
        </div>
      } @else {
        <!-- Subject Header -->
        <header class="subject-header">
          <div class="subject-header__info">
            <div class="subject-icon" [style.background]="subject()!.color">
              <i [class]="'pi ' + subject()!.icon"></i>
            </div>
            <div class="subject-details">
              <h1 class="subject-name">{{ subject()!.name }}</h1>
              @if (subject()!.code) {
                <span class="subject-code">{{ subject()!.code }}</span>
              }
              @if (subject()!.description) {
                <p class="subject-description">{{ subject()!.description }}</p>
              }
            </div>
          </div>
          <div class="subject-header__actions">
            <!-- @REVIEW: Manage learning materials -->
            <p-button 
              icon="pi pi-folder-open" 
              label="Assets" 
              severity="secondary"
              [routerLink]="['/teacher/subjects', subject()!.id, 'assets']"
            />
            <!-- @REVIEW: View comprehensive subject report -->
            <p-button 
              icon="pi pi-chart-bar" 
              label="View Report" 
              severity="info"
              [routerLink]="['/teacher/subjects', subject()!.id, 'report']"
            />
            <p-button 
              icon="pi pi-pencil" 
              label="Edit Subject" 
              severity="secondary"
              [routerLink]="['/teacher/subjects', subject()!.id, 'edit']"
            />
            <p-tag 
              [value]="subject()!.isActive ? 'Active' : 'Inactive'"
              [severity]="subject()!.isActive ? 'success' : 'danger'"
            />
          </div>
        </header>

        <!-- Stats -->
        <section class="stats-row">
          <p-card styleClass="stat-card">
            <div class="stat-card__content">
              <div class="stat-card__icon" style="background: linear-gradient(135deg, #3b82f6, #1d4ed8)">
                <i class="pi pi-users"></i>
              </div>
              <div class="stat-card__text">
                <span class="stat-card__value">{{ enrolledStudents().length }}</span>
                <span class="stat-card__label">Enrolled Students</span>
              </div>
            </div>
          </p-card>
          <p-card styleClass="stat-card">
            <div class="stat-card__content">
              <div class="stat-card__icon" style="background: linear-gradient(135deg, #8b5cf6, #6d28d9)">
                <i class="pi pi-file-edit"></i>
              </div>
              <div class="stat-card__text">
                <span class="stat-card__value">{{ exams().length }}</span>
                <span class="stat-card__label">Exams</span>
              </div>
            </div>
          </p-card>
          <p-card styleClass="stat-card">
            <div class="stat-card__content">
              <div class="stat-card__icon" style="background: linear-gradient(135deg, #10b981, #059669)">
                <i class="pi pi-check-circle"></i>
              </div>
              <div class="stat-card__text">
                <span class="stat-card__value">{{ activeExamsCount() }}</span>
                <span class="stat-card__label">Active Exams</span>
              </div>
            </div>
          </p-card>
        </section>

        <!-- Two Column Layout -->
        <div class="content-grid">
          <!-- Enrolled Students Section -->
          <p-card styleClass="enrolled-card">
            <ng-template #header>
              <div class="card-header">
                <h2 class="card-header__title">
                  <i class="pi pi-users"></i>
                  Enrolled Students
                </h2>
              </div>
            </ng-template>

            @if (loadingStudents()) {
              <div class="skeleton-list">
                @for (i of [1, 2, 3]; track i) {
                  <p-skeleton width="100%" height="50px" styleClass="mb-2" />
                }
              </div>
            } @else if (enrolledStudents().length === 0) {
              <div class="empty-state-small">
                <i class="pi pi-user-plus"></i>
                <p>No students enrolled yet</p>
              </div>
            } @else {
              <div class="enrolled-list">
                @for (student of enrolledStudents(); track student.id) {
                  <div class="enrolled-item">
                    <div class="enrolled-item__avatar" [style.background]="getAvatarColor(student.user.fullName)">
                      {{ getInitials(student.user.fullName) }}
                    </div>
                    <div class="enrolled-item__info">
                      <span class="enrolled-item__name">{{ student.user.fullName }}</span>
                      <span class="enrolled-item__email">{{ student.user.email }}</span>
                    </div>
                    <p-button 
                      icon="pi pi-times" 
                      severity="danger" 
                      [text]="true" 
                      [rounded]="true"
                      size="small"
                      pTooltip="Remove from subject"
                      (click)="confirmUnenroll(student)"
                    />
                  </div>
                }
              </div>
            }
          </p-card>

          <!-- Available Students Section -->
          <p-card styleClass="available-card">
            <ng-template #header>
              <div class="card-header">
                <h2 class="card-header__title">
                  <i class="pi pi-user-plus"></i>
                  Available Students
                </h2>
                <p-iconfield>
                  <p-inputicon styleClass="pi pi-search" />
                  <input 
                    type="text" 
                    pInputText 
                    placeholder="Search students..." 
                    [(ngModel)]="studentSearchFilter"
                  />
                </p-iconfield>
              </div>
            </ng-template>

            @if (loadingStudents()) {
              <div class="skeleton-list">
                @for (i of [1, 2, 3]; track i) {
                  <p-skeleton width="100%" height="50px" styleClass="mb-2" />
                }
              </div>
            } @else if (filteredAvailableStudents().length === 0) {
              <div class="empty-state-small">
                <i class="pi pi-check-circle"></i>
                <p>{{ allStudents().length === 0 ? 'No students created yet' : 'All students are enrolled' }}</p>
              </div>
            } @else {
              <div class="available-list">
                @for (student of filteredAvailableStudents(); track student.id) {
                  <div class="available-item">
                    <div class="available-item__avatar" [style.background]="getAvatarColor(student.user.fullName)">
                      {{ getInitials(student.user.fullName) }}
                    </div>
                    <div class="available-item__info">
                      <span class="available-item__name">{{ student.user.fullName }}</span>
                      <span class="available-item__email">{{ student.user.email }}</span>
                    </div>
                    <p-button 
                      icon="pi pi-plus" 
                      severity="success" 
                      [text]="true" 
                      [rounded]="true"
                      size="small"
                      pTooltip="Enroll in subject"
                      (click)="enrollStudent(student)"
                      [loading]="enrollingStudentId() === student.id"
                    />
                  </div>
                }
              </div>
            }
          </p-card>
        </div>

        <!-- Exams Section -->
        <p-card styleClass="exams-card">
          <ng-template #header>
            <div class="card-header">
              <h2 class="card-header__title">
                <i class="pi pi-file-edit"></i>
                Exams in this Subject
              </h2>
              <p-button 
                icon="pi pi-plus" 
                label="Create Exam" 
                size="small"
                [routerLink]="['/teacher/exams/create']"
                [queryParams]="{ subjectId: subject()!.id }"
              />
            </div>
          </ng-template>

          @if (loadingExams()) {
            <div class="skeleton-list">
              @for (i of [1, 2, 3]; track i) {
                <p-skeleton width="100%" height="60px" styleClass="mb-2" />
              }
            </div>
          } @else if (exams().length === 0) {
            <div class="empty-state-small">
              <i class="pi pi-file-edit"></i>
              <p>No exams created for this subject yet</p>
              <p-button 
                label="Create First Exam" 
                icon="pi pi-plus"
                [routerLink]="['/teacher/exams/create']"
                [queryParams]="{ subjectId: subject()!.id }"
              />
            </div>
          } @else {
            <div class="exams-list">
              @for (exam of exams(); track exam.id) {
                <div class="exam-item">
                  <div class="exam-item__info">
                    <span class="exam-item__title">{{ exam.title }}</span>
                    <div class="exam-item__meta">
                      <span><i class="pi pi-list"></i> {{ exam.totalQuestions }} questions</span>
                      <span><i class="pi pi-star"></i> {{ exam.totalMarks }} marks</span>
                      <span><i class="pi pi-clock"></i> {{ exam.timePerQuestionSeconds }}s/question</span>
                      @if (examStatsMap()[exam.id]; as stats) {
                        <span class="submissions-badge">
                          <i class="pi pi-users"></i> {{ stats.completedSubmissions }} submissions
                          @if (stats.avgScore > 0) {
                            ({{ stats.avgScore }}% avg)
                          }
                        </span>
                      }
                    </div>
                  </div>
                  <div class="exam-item__actions">
                    <p-tag 
                      [value]="exam.status" 
                      [severity]="getExamStatusSeverity(exam.status)"
                    />
                    <p-button 
                      icon="pi pi-chart-bar" 
                      severity="info" 
                      [text]="true" 
                      [rounded]="true"
                      size="small"
                      pTooltip="View Results"
                      [routerLink]="['/teacher/exams', exam.id, 'results']"
                    />
                    <p-button 
                      icon="pi pi-eye" 
                      severity="secondary" 
                      [text]="true" 
                      [rounded]="true"
                      size="small"
                      pTooltip="View Exam"
                      [routerLink]="['/teacher/exams', exam.id]"
                    />
                  </div>
                </div>
              }
            </div>
          }
        </p-card>
      }
    </div>

    <p-confirmDialog />
    <p-toast />
  `,
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
    const enrolled = new Set(this.enrolledStudents().map(s => s.id));
    return this.allStudents().filter(s => !enrolled.has(s.id));
  });

  // @REVIEW: Filter available students by search
  readonly filteredAvailableStudents = computed(() => {
    const filter = this.studentSearchFilter.toLowerCase().trim();
    if (!filter) return this.availableStudents();
    return this.availableStudents().filter(s =>
      s.user.fullName.toLowerCase().includes(filter) ||
      s.user.email.toLowerCase().includes(filter)
    );
  });

  readonly activeExamsCount = computed(() => 
    this.exams().filter(e => e.status === 'active').length
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
    this.db.subjects.getById(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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
    this.db.exams.getBySubject(subjectId, { page: 1, pageSize: 100 }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
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

    const statRequests = examList.map(exam =>
      this.db.submissions.getByExam(exam.id, { page: 1, pageSize: 500 }).pipe()
    );

    forkJoin(statRequests).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (responses) => {
        const statsMap: Record<string, ExamStats> = {};
        
        examList.forEach((exam, index) => {
          const submissions = responses[index].items;
          const completed = submissions.filter(s =>
            s.status === 'submitted' || s.status === 'auto_submitted' || s.status === 'evaluated'
          );
          
          const avgScore = completed.length > 0
            ? Math.round(completed.reduce((sum, s) => sum + s.percentage, 0) / completed.length)
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
    this.db.subjects.enrollStudent(student.id, subject.id, userId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        // Move student from available to enrolled
        this.enrolledStudents.update(list => [...list, student]);
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

    this.db.subjects.unenrollStudent(student.id, subject.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        // Remove student from enrolled list
        this.enrolledStudents.update(list => list.filter(s => s.id !== student.id));
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
      '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80',
      '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getExamStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
      draft: 'secondary',
      scheduled: 'info',
      active: 'success',
      completed: 'warn',
      cancelled: 'danger',
    };
    return map[status] ?? 'secondary';
  }
}
