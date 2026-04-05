// @REVIEW: Student Subjects - View enrolled subjects with assets and upcoming exams
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
import { Router, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';
import { DividerModule } from 'primeng/divider';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { Subject, Asset, Exam, ExamWithSubject } from '../../../core/models';
import { forkJoin, of } from 'rxjs';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';


interface SubjectWithDetails {
  subject: Subject;
  assets: Asset[];
  upcomingExams: Exam[];
}

@Component({
  selector: 'app-subjects',
  imports: [
    CommonModule,
    RouterLink,
    CardModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    DialogModule,
    DividerModule,
  ],
  templateUrl: './subjects.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectsComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly subjects = signal<SubjectWithDetails[]>([]);
  readonly selectedSubject = signal<SubjectWithDetails | null>(null);

  showDialog = false;

  readonly studentId = computed(() => this.authStore.studentId());

  ngOnInit(): void {
    this.loadSubjects();
  }

  private loadSubjects(): void {
    const studentId = this.studentId();
    if (!studentId) {
      this.loading.set(false);
      return;
    }

    this.db.subjects
      .getByStudent(studentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (subjectsList) => {
          if (subjectsList.length === 0) {
            this.subjects.set([]);
            this.loading.set(false);
            return;
          }

          // Load assets and upcoming exams for each subject
          const requests = subjectsList.map((subject) =>
            forkJoin({
              subject: of(subject),
              assets: this.db.assets.getBySubject(subject.id, {
                page: 1,
                pageSize: 50,
              }),
              exams: this.db.exams.getBySubject(subject.id, {
                page: 1,
                pageSize: 50,
              }),
            })
          );

          forkJoin(requests)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (results) => {
                const subjectsWithDetails: SubjectWithDetails[] = results.map(
                  (r) => ({
                    subject: r.subject,
                    assets: r.assets.items.filter((a) => a.isPublished),
                    upcomingExams: r.exams.items.filter(
                      (e) => e.status === 'active' || e.status === 'scheduled'
                    ),
                  })
                );
                this.subjects.set(subjectsWithDetails);
                this.loading.set(false);
              },
              error: (err) => {
                console.error('Failed to load subject details:', err);
                // Fallback: show subjects without details
                this.subjects.set(
                  subjectsList.map((s) => ({
                    subject: s,
                    assets: [],
                    upcomingExams: [],
                  }))
                );
                this.loading.set(false);
              },
            });
        },
        error: (err) => {
          console.error('Failed to load subjects:', err);
          this.loading.set(false);
        },
      });
  }

  openSubjectDialog(item: SubjectWithDetails): void {
    this.selectedSubject.set(item);
    this.showDialog = true;
  }

  closeDialog(): void {
    this.showDialog = false;
  }

  openAsset(asset: Asset): void {
    const url = asset.externalUrl || asset.fileUrl;
    if (url) {
      window.open(url, '_blank');
    }
  }

  getAssetIcon(type: string): string {
    const icons: Record<string, string> = {
      document: 'pi pi-file',
      image: 'pi pi-image',
      video: 'pi pi-video',
      link: 'pi pi-link',
      other: 'pi pi-paperclip',
    };
    return icons[type] ?? 'pi pi-file';
  }

  // @REVIEW: Navigate to subject assets page with comments feature
  goToSubjectAssets(subjectId: string): void {
    this.closeDialog();
    this.router.navigate(['/student/subjects', subjectId, 'assets']);
  }
}
