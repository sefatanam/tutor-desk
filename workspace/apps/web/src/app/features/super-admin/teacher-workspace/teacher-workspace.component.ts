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
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeacherWorkspaceComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
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
        color: 'td-gradient-accent',
      },
      {
        icon: 'pi pi-users',
        label: 'Students',
        value: studentCount.toString(),
        color: 'td-gradient-info',
      },
      {
        icon: 'pi pi-file-edit',
        label: 'Total Exams',
        value: examCount.toString(),
        color: 'td-gradient-warning',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Active Exams',
        value: activeExams.toString(),
        color: 'td-gradient-success',
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
