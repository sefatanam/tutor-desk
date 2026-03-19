// @REVIEW: Subject Form Page - Create/Edit subject as dedicated page (replaces dialog)
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
import { Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { FloatLabelModule } from 'primeng/floatlabel';
import { ColorPickerModule } from 'primeng/colorpicker';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';


@Component({
  selector: 'app-subject-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    FloatLabelModule,
    ColorPickerModule,
    TextareaModule,
    ToastModule,
    SkeletonModule,
  ],
  providers: [MessageService],
  templateUrl: './subject-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectFormComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly messageService = inject(MessageService);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly subjectId = signal<string | null>(null);

  readonly isEditMode = computed(() => !!this.subjectId());
  readonly teacherId = computed(() => this.authStore.teacherId());

  readonly subjectForm = this.fb.group({
    name: ['', Validators.required],
    code: [''],
    description: [''],
    color: ['#4CAF50'],
    icon: ['pi-book'],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.subjectId.set(id);
      this.loadSubject(id);
    }
  }

  private loadSubject(id: string): void {
    this.loading.set(true);

    this.db.subjects
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (subject) => {
          // @REVIEW: Handle null case - subject not found
          if (!subject) {
            this.loading.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Subject not found.',
            });
            this.goBack();
            return;
          }

          this.subjectForm.patchValue({
            name: subject.name,
            code: subject.code ?? '',
            description: subject.description ?? '',
            color: subject.color,
            icon: subject.icon,
          });
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load subject:', err);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load subject details.',
          });
          this.goBack();
        },
      });
  }

  saveSubject(): void {
    if (!this.subjectForm.valid) return;

    const teacherId = this.teacherId();
    if (!teacherId) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Teacher ID not found. Please log in again.',
      });
      return;
    }

    this.saving.set(true);
    const formValue = this.subjectForm.value;

    if (this.isEditMode()) {
      this.db.subjects
        .update(this.subjectId()!, {
          name: formValue.name || undefined,
          code: formValue.code || undefined,
          description: formValue.description || undefined,
          color: formValue.color || undefined,
          icon: formValue.icon || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Subject updated successfully.',
            });
            this.goBack();
          },
          error: (err) => {
            console.error('Failed to update subject:', err);
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update subject.',
            });
          },
        });
    } else {
      this.db.subjects
        .create({
          teacherId,
          name: formValue.name!,
          code: formValue.code || undefined,
          description: formValue.description || undefined,
          color: formValue.color || undefined,
          icon: formValue.icon || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Subject created successfully.',
            });
            this.goBack();
          },
          error: (err) => {
            console.error('Failed to create subject:', err);
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message || 'Failed to create subject.',
            });
          },
        });
    }
  }

  goBack(): void {
    this.router.navigate(['/teacher/subjects']);
  }
}
