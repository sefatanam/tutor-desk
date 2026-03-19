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
  styles: `
    .page { padding: 1.5rem; }
    .page__header { margin-bottom: 2rem; }
    .page__header h1 { margin: 0 0 0.5rem; font-size: 1.75rem; font-weight: 600; }
    .page__header p { margin: 0; color: var(--text-color-secondary); }

    .empty-state { text-align: center; padding: 4rem 2rem; }
    .empty-state i { font-size: 4rem; color: var(--primary-color); opacity: 0.5; margin-bottom: 1rem; }
    .empty-state h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
    .empty-state p { margin: 0; color: var(--text-color-secondary); }

    .subjects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    :host ::ng-deep .subject-card { cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
    :host ::ng-deep .subject-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    :host ::ng-deep .subject-card .p-card-body { padding: 0; }
    :host ::ng-deep .subject-card .p-card-content { padding: 0; }

    .subject-card__header {
      height: 100px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 6px 6px 0 0;
    }
    .subject-card__header i { font-size: 2.5rem; color: white; opacity: 0.9; }

    .subject-card__body { padding: 1rem; }
    .subject-card__title { margin: 0 0 0.25rem; font-size: 1.125rem; font-weight: 600; }
    .subject-card__code {
      font-size: 0.75rem; color: var(--text-color-secondary);
      background: var(--surface-ground); padding: 0.125rem 0.5rem; border-radius: 4px;
    }
    .subject-card__desc {
      margin: 0.5rem 0; font-size: 0.875rem; color: var(--text-color-secondary);
      line-height: 1.4;
    }
    .subject-card__stats {
      display: flex; gap: 1rem; font-size: 0.75rem; color: var(--text-color-secondary);
      margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--surface-border);
    }
    .subject-card__stats span { display: flex; align-items: center; gap: 0.25rem; }

    .dialog-content { max-height: 60vh; overflow-y: auto; }

    .subject-info { display: flex; gap: 1rem; align-items: flex-start; }
    .subject-badge {
      width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 1.25rem;
    }
    .subject-code {
      font-size: 0.75rem; background: var(--surface-ground);
      padding: 0.125rem 0.5rem; border-radius: 4px;
    }
    .subject-desc { margin: 0.5rem 0 0; color: var(--text-color-secondary); font-size: 0.875rem; }

    .section { margin-bottom: 0.5rem; }
    .section-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 1rem;
    }
    .section-title {
      margin: 0; font-size: 1rem; font-weight: 600;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .section-title i { color: var(--primary-color); }
    .section-empty { color: var(--text-color-secondary); font-size: 0.875rem; font-style: italic; }

    .exam-list, .asset-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .exam-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.75rem; background: var(--surface-ground); border-radius: 8px;
    }
    .exam-item__info { display: flex; flex-direction: column; }
    .exam-item__title { font-weight: 500; }
    .exam-item__meta { font-size: 0.75rem; color: var(--text-color-secondary); }

    .asset-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.75rem; background: var(--surface-ground); border-radius: 8px;
      cursor: pointer; transition: background 0.2s;
    }
    .asset-item:hover { background: var(--surface-hover); }
    .asset-item__icon { font-size: 1.25rem; color: var(--primary-color); }
    .asset-item__info { flex: 1; min-width: 0; }
    .asset-item__title { font-weight: 500; display: block; }
    .asset-item__desc { font-size: 0.75rem; color: var(--text-color-secondary); display: block; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectsComponent implements OnInit {
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
