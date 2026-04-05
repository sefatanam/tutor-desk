// @REVIEW: Student Form Page - Create/Edit student as dedicated page (replaces dialog)
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
import { DatePickerModule } from 'primeng/datepicker';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { PasswordModule } from 'primeng/password';
import { MessageService } from 'primeng/api';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';

@Component({
  selector: 'app-student-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    FloatLabelModule,
    DatePickerModule,
    TextareaModule,
    ToastModule,
    SkeletonModule,
    DividerModule,
    PasswordModule,
  ],
  providers: [MessageService],
  templateUrl: './student-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudentFormComponent implements OnInit {
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
  readonly studentId = signal<string | null>(null);

  readonly isEditMode = computed(() => !!this.studentId());
  readonly teacherId = computed(() => this.authStore.teacherId());

  // Max date for date of birth (must be at least 5 years old)
  readonly maxDate = new Date(
    new Date().setFullYear(new Date().getFullYear() - 5)
  );

  readonly studentForm = this.fb.group({
    // Account fields (only for create)
    fullName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    // Student details
    rollNumber: [''],
    className: [''],
    section: [''],
    dateOfBirth: [null as Date | null],
    // Guardian info
    guardianName: [''],
    guardianPhone: [''],
    address: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.studentId.set(id);
      this.loadStudent(id);
      // Clear validators for account fields in edit mode
      this.studentForm.get('fullName')?.clearValidators();
      this.studentForm.get('email')?.clearValidators();
      this.studentForm.get('password')?.clearValidators();
      this.studentForm.updateValueAndValidity();
    }
  }

  private loadStudent(id: string): void {
    this.loading.set(true);

    this.db.students
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (student) => {
          // @REVIEW: Handle null case - student not found
          if (!student) {
            this.loading.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Student not found.',
            });
            this.goBack();
            return;
          }

          this.studentForm.patchValue({
            fullName: student.user.fullName,
            email: student.user.email,
            rollNumber: student.rollNumber ?? '',
            className: student.className ?? '',
            section: student.section ?? '',
            dateOfBirth: student.dateOfBirth
              ? new Date(student.dateOfBirth)
              : null,
            guardianName: student.guardianName ?? '',
            guardianPhone: student.guardianPhone ?? '',
            address: student.address ?? '',
          });
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load student:', err);
          this.loading.set(false);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to load student details.',
          });
          this.goBack();
        },
      });
  }

  isFormValid(): boolean {
    if (this.isEditMode()) {
      // In edit mode, we don't need account fields
      return true;
    }
    return this.studentForm.valid;
  }

  saveStudent(): void {
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
    const formValue = this.studentForm.value;

    if (this.isEditMode()) {
      this.db.students
        .update(this.studentId()!, {
          fullName: formValue.fullName || undefined,
          rollNumber: formValue.rollNumber || undefined,
          className: formValue.className || undefined,
          section: formValue.section || undefined,
          dateOfBirth: formValue.dateOfBirth || undefined,
          guardianName: formValue.guardianName || undefined,
          guardianPhone: formValue.guardianPhone || undefined,
          address: formValue.address || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Student updated successfully.',
            });
            this.goBack();
          },
          error: (err) => {
            console.error('Failed to update student:', err);
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: 'Failed to update student.',
            });
          },
        });
    } else {
      if (!this.studentForm.valid) {
        this.messageService.add({
          severity: 'error',
          summary: 'Validation Error',
          detail: 'Please fill in all required fields.',
        });
        this.saving.set(false);
        return;
      }

      this.db.students
        .create({
          email: formValue.email!,
          password: formValue.password!,
          fullName: formValue.fullName!,
          teacherId,
          rollNumber: formValue.rollNumber || undefined,
          className: formValue.className || undefined,
          section: formValue.section || undefined,
          dateOfBirth: formValue.dateOfBirth || undefined,
          guardianName: formValue.guardianName || undefined,
          guardianPhone: formValue.guardianPhone || undefined,
          address: formValue.address || undefined,
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.saving.set(false);
            this.messageService.add({
              severity: 'success',
              summary: 'Success',
              detail: 'Student created successfully.',
            });
            this.goBack();
          },
          error: (err) => {
            console.error('Failed to create student:', err);
            this.saving.set(false);
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message || 'Failed to create student.',
            });
          },
        });
    }
  }

  goBack(): void {
    this.router.navigate(['/teacher/students']);
  }
}
