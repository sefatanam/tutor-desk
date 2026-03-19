// @REVIEW: Teacher Subjects - Refactored to use navigation instead of dialogs
import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Table } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { Subject } from '../../../core/models';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';


@Component({
  selector: 'app-subjects',
  // @NOT-NEED: Removed dialog, form-related imports (DialogModule, FloatLabelModule, ColorPickerModule, TextareaModule, ReactiveFormsModule)
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    TableModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ConfirmDialogModule,
    ToastModule,
    SkeletonModule,
  ],
  providers: [ConfirmationService, MessageService],
  templateUrl: './subjects.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectsComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly authStore = inject(AuthStore);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);

  // @REVIEW: Table reference for global filtering
  readonly dt = viewChild<Table>('dt');

  // State
  readonly loading = signal(true);
  readonly loadingStats = signal(true);
  readonly subjects = signal<Subject[]>([]);

  globalFilter = '';

  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly statsCards = computed(() => {
    const allSubjects = this.subjects();
    const activeCount = allSubjects.filter((s) => s.isActive).length;
    const totalStudents = allSubjects.reduce(
      (sum, s) => sum + s.totalStudents,
      0
    );

    return [
      {
        icon: 'pi pi-book',
        label: 'Total Subjects',
        value: allSubjects.length.toString(),
        color: 'td-gradient-accent',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Active',
        value: activeCount.toString(),
        color: 'td-gradient-success',
      },
      {
        icon: 'pi pi-users',
        label: 'Total Enrollments',
        value: totalStudents.toString(),
        color: 'td-gradient-info',
      },
    ];
  });

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    const teacherId = this.teacherId();
    if (!teacherId) return;

    this.loading.set(true);
    this.loadingStats.set(true);

    this.db.subjects
      .getByTeacher(teacherId, { page: 1, pageSize: 100 })
      .subscribe({
        next: (response) => {
          this.subjects.set(response.items);
          this.loading.set(false);
          this.loadingStats.set(false);
        },
        error: (err) => {
          console.error('Failed to load subjects:', err);
          this.loading.set(false);
          this.loadingStats.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load subjects.',
          });
        },
      });
  }

  // @REVIEW: Navigation methods (replaces dialog methods)
  navigateToCreate(): void {
    this.router.navigate(['/teacher/subjects/create']);
  }

  navigateToDetail(subject: Subject): void {
    this.router.navigate(['/teacher/subjects', subject.id]);
  }

  navigateToEdit(subject: Subject): void {
    this.router.navigate(['/teacher/subjects', subject.id, 'edit']);
  }

  confirmDeactivate(subject: Subject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to deactivate "${subject.name}"? Students will no longer see this subject.`,
      header: 'Confirm Deactivate',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-warning',
      accept: () => {
        this.db.subjects.update(subject.id, { isActive: false }).subscribe({
          next: () => {
            this.loadSubjects();
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Subject deactivated.',
            });
          },
          error: (err) => {
            console.error('Failed to deactivate subject:', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to deactivate subject.',
            });
          },
        });
      },
    });
  }

  confirmActivate(subject: Subject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to activate "${subject.name}"?`,
      header: 'Confirm Activate',
      icon: 'pi pi-check-circle',
      acceptButtonStyleClass: 'p-button-success',
      accept: () => {
        this.db.subjects.update(subject.id, { isActive: true }).subscribe({
          next: () => {
            this.loadSubjects();
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Subject activated.',
            });
          },
          error: (err) => {
            console.error('Failed to activate subject:', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to activate subject.',
            });
          },
        });
      },
    });
  }

  confirmDelete(subject: Subject): void {
    this.confirmationService.confirm({
      message: `Are you sure you want to delete "${subject.name}"? This will also delete all associated exams and enrollments. This action cannot be undone.`,
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.db.subjects.delete(subject.id).subscribe({
          next: () => {
            this.loadSubjects();
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Subject deleted.',
            });
          },
          error: (err) => {
            console.error('Failed to delete subject:', err);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to delete subject.',
            });
          },
        });
      },
    });
  }
}
