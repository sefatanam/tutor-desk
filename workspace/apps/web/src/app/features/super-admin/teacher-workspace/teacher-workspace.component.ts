// @REVIEW: SuperAdmin Teacher Workspace Browser - View teacher's subjects, students, exams
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
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TabsModule } from 'primeng/tabs';
import { AvatarModule } from 'primeng/avatar';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { forkJoin } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import {
  TeacherWithUser,
  Subject,
  StudentWithUser,
  Exam,
} from '../../../core/models';

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
  templateUrl: './teacher-workspace.component.html',
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
    const activeExams = this.exams().filter(
      (e) => e.status === 'active'
    ).length;

    return [
      {
        icon: 'pi pi-book',
        label: 'Subjects',
        value: subjectCount.toString(),
        color: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      },
      {
        icon: 'pi pi-users',
        label: 'Students',
        value: studentCount.toString(),
        color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      },
      {
        icon: 'pi pi-file-edit',
        label: 'Total Exams',
        value: examCount.toString(),
        color: 'linear-gradient(135deg, #f59e0b, #d97706)',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Active Exams',
        value: activeExams.toString(),
        color: 'linear-gradient(135deg, #10b981, #059669)',
      },
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
    this.db.teachers
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
      subjects: this.db.subjects.getByTeacher(teacherId, {
        page: 1,
        pageSize: 100,
      }),
      students: this.db.students.getByTeacher(teacherId, {
        page: 1,
        pageSize: 500,
      }),
      exams: this.db.exams.getByTeacher(teacherId, { page: 1, pageSize: 100 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
    const subject = this.subjects().find((s) => s.id === subjectId);
    return subject?.name ?? '-';
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getAvatarColor(id: string): string {
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
    const index = id.charCodeAt(0) % colors.length;
    return colors[index];
  }

  getStatusSeverity(
    status: string
  ): 'success' | 'warn' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'warn' | 'danger' | 'secondary'> = {
      active: 'success',
      pending: 'warn',
      disabled: 'danger',
    };
    return map[status] ?? 'secondary';
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

  getScoreClass(score: number): string {
    if (score >= 70) return 'score-high';
    if (score >= 50) return 'score-medium';
    return 'score-low';
  }
}
