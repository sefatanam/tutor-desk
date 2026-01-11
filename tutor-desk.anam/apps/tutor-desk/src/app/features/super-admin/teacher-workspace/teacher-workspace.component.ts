// @REVIEW: SuperAdmin Teacher Workspace Browser - View teacher's subjects, students, exams
import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { forkJoin } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { TeacherWithUser, Subject, StudentWithUser, Exam } from '../../../core/models';

@Component({
  selector: 'app-teacher-workspace',
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TableModule,
    TagModule,
    TabsModule,
    AvatarModule,
    TooltipModule,
    SkeletonModule,
    DividerModule,
  ],
  template: `
    <div class="workspace-page">
      <!-- Breadcrumb & Back -->
      <div class="page-nav">
        <p-button 
          icon="pi pi-arrow-left" 
          label="Back to Teachers" 
          [text]="true" 
          routerLink="/admin/teachers"
        />
      </div>

      @if (loading()) {
        <div class="loading-state">
          <p-skeleton width="300px" height="32px" styleClass="mb-3" />
          <p-skeleton width="200px" height="20px" />
        </div>
      } @else if (!teacher()) {
        <div class="not-found">
          <i class="pi pi-exclamation-circle"></i>
          <h2>Teacher Not Found</h2>
          <p>The teacher you're looking for doesn't exist.</p>
          <p-button label="Go to Teachers" routerLink="/admin/teachers" />
        </div>
      } @else {
        <!-- Teacher Header -->
        <header class="teacher-header">
          <div class="teacher-header__info">
            <p-avatar 
              [label]="getInitials(teacher()!.user.fullName)" 
              size="xlarge"
              shape="circle"
              [style]="{ background: getAvatarColor(teacher()!.id), color: 'white', fontSize: '1.5rem' }"
            />
            <div class="teacher-details">
              <h1 class="teacher-name">{{ teacher()!.user.fullName }}</h1>
              <span class="teacher-email">{{ teacher()!.user.email }}</span>
              @if (teacher()!.qualification) {
                <span class="teacher-qualification">{{ teacher()!.qualification }}</span>
              }
            </div>
          </div>
          <div class="teacher-header__status">
            <p-tag 
              [value]="teacher()!.user.status | titlecase"
              [severity]="getStatusSeverity(teacher()!.user.status)"
              [rounded]="true"
            />
            <span class="joined-date">Joined {{ teacher()!.createdAt | date:'MMM d, yyyy' }}</span>
          </div>
        </header>

        <!-- Stats Cards -->
        <section class="stats-row">
          @for (stat of statsCards(); track stat.label) {
            <p-card styleClass="stat-card">
              <div class="stat-card__content">
                <div class="stat-card__icon" [style.background]="stat.color">
                  <i [class]="stat.icon"></i>
                </div>
                <div class="stat-card__text">
                  <span class="stat-card__value">{{ stat.value }}</span>
                  <span class="stat-card__label">{{ stat.label }}</span>
                </div>
              </div>
            </p-card>
          }
        </section>

        <!-- Tabs for Subjects, Students, Exams -->
        <p-tabs value="0">
          <p-tablist>
            <p-tab value="0">
              <i class="pi pi-book mr-2"></i>
              Subjects ({{ subjects().length }})
            </p-tab>
            <p-tab value="1">
              <i class="pi pi-users mr-2"></i>
              Students ({{ students().length }})
            </p-tab>
            <p-tab value="2">
              <i class="pi pi-file-edit mr-2"></i>
              Exams ({{ exams().length }})
            </p-tab>
          </p-tablist>
          
          <p-tabpanels>
            <!-- Subjects Tab -->
            <p-tabpanel value="0">
              <p-card styleClass="data-card">
                @if (loadingData()) {
                  <div class="skeleton-list">
                    @for (i of [1, 2, 3]; track i) {
                      <p-skeleton width="100%" height="60px" styleClass="mb-2" />
                    }
                  </div>
                } @else if (subjects().length === 0) {
                  <div class="empty-state">
                    <i class="pi pi-book"></i>
                    <p>No subjects created</p>
                  </div>
                } @else {
                  <p-table [value]="subjects()" styleClass="p-datatable-sm" [rowHover]="true">
                    <ng-template #header>
                      <tr>
                        <th style="width: 50px"></th>
                        <th>Subject</th>
                        <th>Code</th>
                        <th class="text-center">Students</th>
                        <th class="text-center">Exams</th>
                        <th>Status</th>
                      </tr>
                    </ng-template>
                    <ng-template #body let-subject>
                      <tr>
                        <td>
                          <div class="subject-color" [style.background]="subject.color">
                            <i [class]="'pi ' + subject.icon"></i>
                          </div>
                        </td>
                        <td>
                          <div class="cell-info">
                            <span class="cell-title">{{ subject.name }}</span>
                            @if (subject.description) {
                              <span class="cell-desc">{{ subject.description | slice:0:50 }}...</span>
                            }
                          </div>
                        </td>
                        <td>{{ subject.code ?? '-' }}</td>
                        <td class="text-center">{{ subject.totalStudents }}</td>
                        <td class="text-center">{{ subject.totalExams }}</td>
                        <td>
                          <p-tag 
                            [value]="subject.isActive ? 'Active' : 'Inactive'"
                            [severity]="subject.isActive ? 'success' : 'secondary'"
                            [rounded]="true"
                          />
                        </td>
                      </tr>
                    </ng-template>
                  </p-table>
                }
              </p-card>
            </p-tabpanel>

            <!-- Students Tab -->
            <p-tabpanel value="1">
              <p-card styleClass="data-card">
                @if (loadingData()) {
                  <div class="skeleton-list">
                    @for (i of [1, 2, 3]; track i) {
                      <p-skeleton width="100%" height="60px" styleClass="mb-2" />
                    }
                  </div>
                } @else if (students().length === 0) {
                  <div class="empty-state">
                    <i class="pi pi-users"></i>
                    <p>No students registered</p>
                  </div>
                } @else {
                  <p-table [value]="students()" styleClass="p-datatable-sm" [rowHover]="true" [paginator]="true" [rows]="10">
                    <ng-template #header>
                      <tr>
                        <th>Student</th>
                        <th>Class</th>
                        <th>Roll Number</th>
                        <th class="text-center">Exams Taken</th>
                        <th class="text-center">Avg Score</th>
                        <th>Status</th>
                      </tr>
                    </ng-template>
                    <ng-template #body let-student>
                      <tr>
                        <td>
                          <div class="user-cell">
                            <p-avatar 
                              [label]="getInitials(student.user.fullName)" 
                              shape="circle"
                              [style]="{ background: getAvatarColor(student.id), color: 'white' }"
                            />
                            <div class="cell-info">
                              <span class="cell-title">{{ student.user.fullName }}</span>
                              <span class="cell-desc">{{ student.user.email }}</span>
                            </div>
                          </div>
                        </td>
                        <td>{{ student.className ?? '-' }} {{ student.section ?? '' }}</td>
                        <td>{{ student.rollNumber ?? '-' }}</td>
                        <td class="text-center">{{ student.totalExamsTaken }}</td>
                        <td class="text-center">
                          @if (student.averageScore > 0) {
                            <span [class]="getScoreClass(student.averageScore)">
                              {{ student.averageScore | number:'1.0-0' }}%
                            </span>
                          } @else {
                            <span class="no-data">-</span>
                          }
                        </td>
                        <td>
                          <p-tag 
                            [value]="student.user.status | titlecase"
                            [severity]="getStatusSeverity(student.user.status)"
                            [rounded]="true"
                          />
                        </td>
                      </tr>
                    </ng-template>
                  </p-table>
                }
              </p-card>
            </p-tabpanel>

            <!-- Exams Tab -->
            <p-tabpanel value="2">
              <p-card styleClass="data-card">
                @if (loadingData()) {
                  <div class="skeleton-list">
                    @for (i of [1, 2, 3]; track i) {
                      <p-skeleton width="100%" height="60px" styleClass="mb-2" />
                    }
                  </div>
                } @else if (exams().length === 0) {
                  <div class="empty-state">
                    <i class="pi pi-file-edit"></i>
                    <p>No exams created</p>
                  </div>
                } @else {
                  <p-table [value]="exams()" styleClass="p-datatable-sm" [rowHover]="true" [paginator]="true" [rows]="10">
                    <ng-template #header>
                      <tr>
                        <th style="min-width: 200px">Exam</th>
                        <th>Subject</th>
                        <th class="text-center">Questions</th>
                        <th class="text-center">Marks</th>
                        <th class="text-center">Submissions</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </ng-template>
                    <ng-template #body let-exam>
                      <tr>
                        <td>
                          <div class="cell-info">
                            <span class="cell-title">{{ exam.title }}</span>
                            @if (exam.description) {
                              <span class="cell-desc">{{ exam.description | slice:0:40 }}...</span>
                            }
                          </div>
                        </td>
                        <td>{{ getSubjectName(exam.subjectId) }}</td>
                        <td class="text-center">{{ exam.totalQuestions }}</td>
                        <td class="text-center">{{ exam.totalMarks }}</td>
                        <td class="text-center">{{ exam.totalSubmissions }}</td>
                        <td>
                          <p-tag 
                            [value]="exam.status | titlecase"
                            [severity]="getExamStatusSeverity(exam.status)"
                            [rounded]="true"
                          />
                        </td>
                        <td>{{ exam.createdAt | date:'MMM d, yyyy' }}</td>
                      </tr>
                    </ng-template>
                  </p-table>
                }
              </p-card>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      }
    </div>
  `,
  styles: `
    .workspace-page { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
    
    .page-nav { margin-bottom: 1rem; }
    
    .loading-state { padding: 2rem; }
    
    .not-found { 
      display: flex; flex-direction: column; align-items: center; 
      padding: 4rem 2rem; text-align: center;
    }
    .not-found i { font-size: 4rem; color: var(--text-color-secondary); margin-bottom: 1rem; }
    .not-found h2 { margin: 0 0 0.5rem; }
    .not-found p { color: var(--text-color-secondary); margin-bottom: 1.5rem; }
    
    .teacher-header { 
      display: flex; justify-content: space-between; align-items: flex-start; 
      margin-bottom: 2rem; gap: 1rem; flex-wrap: wrap;
      padding: 1.5rem; background: var(--surface-card); border-radius: 12px;
      border: 1px solid var(--surface-border);
    }
    .teacher-header__info { display: flex; gap: 1rem; align-items: center; }
    .teacher-details { display: flex; flex-direction: column; gap: 0.25rem; }
    .teacher-name { margin: 0; font-size: 1.5rem; font-weight: 600; }
    .teacher-email { color: var(--text-color-secondary); font-size: 0.875rem; }
    .teacher-qualification { 
      color: var(--primary-color); font-size: 0.75rem; font-weight: 500;
      background: var(--primary-50); padding: 0.25rem 0.5rem; border-radius: 4px;
      width: fit-content;
    }
    .teacher-header__status { 
      display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; 
    }
    .joined-date { font-size: 0.75rem; color: var(--text-color-secondary); }
    
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
    
    :host ::ng-deep .data-card .p-card-body { padding: 0; }
    :host ::ng-deep .data-card .p-card-content { padding: 0; }
    
    .skeleton-list { padding: 1rem; }
    
    .empty-state { 
      display: flex; flex-direction: column; align-items: center; 
      padding: 3rem 2rem; text-align: center; color: var(--text-color-secondary);
    }
    .empty-state i { font-size: 2.5rem; margin-bottom: 0.5rem; opacity: 0.5; }
    .empty-state p { margin: 0; }
    
    .subject-color { 
      display: flex; align-items: center; justify-content: center; 
      width: 32px; height: 32px; border-radius: 6px; color: white; font-size: 0.875rem; 
    }
    
    .user-cell { display: flex; align-items: center; gap: 0.75rem; }
    
    .cell-info { display: flex; flex-direction: column; }
    .cell-title { font-weight: 500; }
    .cell-desc { font-size: 0.75rem; color: var(--text-color-secondary); }
    
    .text-center { text-align: center; }
    
    .no-data { color: var(--text-color-secondary); }
    
    .score-high { color: var(--green-600); font-weight: 600; }
    .score-medium { color: var(--yellow-600); font-weight: 600; }
    .score-low { color: var(--red-600); font-weight: 600; }
    
    .mr-2 { margin-right: 0.5rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherWorkspaceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(SupabaseDatabaseAdapter);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly loadingData = signal(true);
  readonly teacher = signal<TeacherWithUser | null>(null);
  readonly subjects = signal<Subject[]>([]);
  readonly students = signal<StudentWithUser[]>([]);
  readonly exams = signal<Exam[]>([]);

  readonly statsCards = computed(() => {
    const subjectCount = this.subjects().length;
    const studentCount = this.students().length;
    const examCount = this.exams().length;
    const activeExams = this.exams().filter(e => e.status === 'active').length;

    return [
      { icon: 'pi pi-book', label: 'Subjects', value: subjectCount.toString(), color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' },
      { icon: 'pi pi-users', label: 'Students', value: studentCount.toString(), color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
      { icon: 'pi pi-file-edit', label: 'Total Exams', value: examCount.toString(), color: 'linear-gradient(135deg, #f59e0b, #d97706)' },
      { icon: 'pi pi-check-circle', label: 'Active Exams', value: activeExams.toString(), color: 'linear-gradient(135deg, #10b981, #059669)' },
    ];
  });

  ngOnInit(): void {
    const teacherId = this.route.snapshot.paramMap.get('id');
    if (!teacherId) {
      this.loading.set(false);
      return;
    }
    this.loadTeacher(teacherId);
  }

  private loadTeacher(id: string): void {
    this.db.teachers.getById(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (teacher) => {
        this.teacher.set(teacher);
        this.loading.set(false);
        this.loadTeacherData(id);
      },
      error: (err) => {
        console.error('Failed to load teacher:', err);
        this.loading.set(false);
      },
    });
  }

  private loadTeacherData(teacherId: string): void {
    this.loadingData.set(true);

    forkJoin({
      subjects: this.db.subjects.getByTeacher(teacherId, { page: 1, pageSize: 100 }),
      students: this.db.students.getByTeacher(teacherId, { page: 1, pageSize: 500 }),
      exams: this.db.exams.getByTeacher(teacherId, { page: 1, pageSize: 100 }),
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ subjects, students, exams }) => {
        this.subjects.set(subjects.items);
        this.students.set(students.items);
        this.exams.set(exams.items);
        this.loadingData.set(false);
      },
      error: (err) => {
        console.error('Failed to load teacher data:', err);
        this.loadingData.set(false);
      },
    });
  }

  getSubjectName(subjectId: string): string {
    const subject = this.subjects().find(s => s.id === subjectId);
    return subject?.name ?? '-';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(id: string): string {
    const colors = [
      '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80',
      '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6',
    ];
    const index = id.charCodeAt(0) % colors.length;
    return colors[index];
  }

  getStatusSeverity(status: string): 'success' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'warn' | 'danger' | 'secondary'> = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
    };
    return map[status] ?? 'secondary';
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

  getScoreClass(score: number): string {
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }
}
