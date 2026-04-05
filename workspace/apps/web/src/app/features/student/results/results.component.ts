// @REVIEW: Student Results - View exam results and scores
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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { forkJoin, of, switchMap } from 'rxjs';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { AuthStore } from '../../../core/store/auth.store';
import { ExamSubmission } from '../../../core/models';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';


// @REVIEW: Result item with exam details
interface ResultItem {
  readonly submission: ExamSubmission;
  readonly examTitle: string;
  readonly subjectName: string;
  readonly subjectColor: string;
  readonly totalMarks: number;
  readonly passingMarks: number;
  readonly passed: boolean;
}

@Component({
  selector: 'app-results',
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
    SkeletonModule,
    ProgressBarModule,
  ],
  templateUrl: './results.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly db = inject(SupabaseDatabaseAdapter);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly results = signal<ResultItem[]>([]);
  searchTerm = '';

  // Computed
  readonly filteredResults = computed(() => {
    const search = this.searchTerm.toLowerCase().trim();
    if (!search) return this.results();
    return this.results().filter(
      (r) =>
        r.examTitle.toLowerCase().includes(search) ||
        r.subjectName.toLowerCase().includes(search)
    );
  });

  readonly statsCards = computed(() => {
    const items = this.results();
    const total = items.length;
    const passed = items.filter((r) => r.passed).length;
    const avgScore =
      total > 0
        ? Math.round(
            items.reduce((sum, r) => sum + r.submission.percentage, 0) / total
          )
        : 0;
    const bestScore =
      total > 0 ? Math.max(...items.map((r) => r.submission.percentage)) : 0;

    return [
      {
        icon: 'pi pi-file-edit',
        label: 'Total Exams',
        value: total,
        color: 'var(--primary-color)',
      },
      {
        icon: 'pi pi-check-circle',
        label: 'Passed',
        value: passed,
        color: 'var(--green-500)',
      },
      {
        icon: 'pi pi-chart-line',
        label: 'Avg Score',
        value: `${avgScore}%`,
        color: 'var(--blue-500)',
      },
      {
        icon: 'pi pi-star',
        label: 'Best Score',
        value: `${bestScore}%`,
        color: 'var(--orange-500)',
      },
    ];
  });

  ngOnInit(): void {
    this.loadResults();
  }

  // @REVIEW: Load all student results with exam details
  private loadResults(): void {
    const studentId = this.authStore.studentId();
    if (!studentId) {
      this.loading.set(false);
      return;
    }

    // Get all submissions (paginated, but fetch more)
    this.db.submissions
      .getByStudent(studentId, { page: 1, pageSize: 100 })
      .pipe(
        switchMap((response) => {
          const completedSubmissions = response.items.filter(
            (s) =>
              s.status === 'submitted' ||
              s.status === 'auto_submitted' ||
              s.status === 'evaluated'
          );

          if (completedSubmissions.length === 0) {
            return of([]);
          }

          // Get exam details for each submission
          const examRequests = completedSubmissions.map((sub) =>
            this.db.exams.getById(sub.examId).pipe(
              switchMap((exam) => {
                if (!exam) return of(null);
                // @REVIEW: Handle nullable subject for independent exams
                return of({
                  submission: sub,
                  examTitle: exam.title,
                  subjectName: exam.subject?.name ?? 'Independent Exam',
                  subjectColor: exam.subject?.color ?? '#6b7280',
                  totalMarks: exam.totalMarks,
                  passingMarks: exam.passingMarks,
                  passed: sub.score >= exam.passingMarks,
                } as ResultItem);
              })
            )
          );

          return forkJoin(examRequests);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (items) => {
          const validItems = (items ?? []).filter(
            (item): item is ResultItem => item !== null
          );
          // Sort by submitted date descending
          validItems.sort(
            (a, b) =>
              (b.submission.submittedAt?.getTime() ?? 0) -
              (a.submission.submittedAt?.getTime() ?? 0)
          );
          this.results.set(validItems);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load results:', err);
          this.loading.set(false);
        },
      });
  }

  // @REVIEW: Navigate to submission review page instead of showing dialog
  viewDetails(result: ResultItem): void {
    this.router.navigate(['/student/results', result.submission.id]);
  }
}
