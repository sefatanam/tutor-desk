// @REVIEW: Subject Report - Comprehensive report of all students' exam performance in a subject
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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { SupabaseDatabaseAdapter } from '../../../core/adapters/supabase-database.adapter';
import { getThemeToneClass } from '../../../core/utils/theme-tone.util';

import {
  Subject,
  Exam,
  StudentWithUser,
  ExamSubmission,
} from '../../../core/models';

// @REVIEW: Student performance summary across all exams in subject
interface StudentPerformance {
  readonly student: StudentWithUser;
  readonly totalExams: number;
  readonly examsTaken: number;
  readonly totalScore: number;
  readonly totalMarks: number;
  readonly averagePercentage: number;
  readonly passed: number;
  readonly failed: number;
  readonly submissions: ExamSubmissionSummary[];
}

// @REVIEW: Summary of a single submission
interface ExamSubmissionSummary {
  readonly examId: string;
  readonly examTitle: string;
  readonly submission: ExamSubmission | null;
  readonly totalMarks: number;
  readonly passingMarks: number;
}

// @REVIEW: Exam performance stats
interface ExamPerformanceStats {
  readonly exam: Exam;
  readonly totalStudents: number;
  readonly submitted: number;
  readonly passed: number;
  readonly failed: number;
  readonly averageScore: number;
  readonly highestScore: number;
  readonly lowestScore: number;
}

@Component({
  selector: 'app-subject-report',
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
    SkeletonModule,
    ProgressBarModule,
    SelectModule,
    TabsModule,
  ],
  templateUrl: './subject-report.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubjectReportComponent implements OnInit {
  readonly getThemeToneClass = getThemeToneClass;
  private readonly route = inject(ActivatedRoute);
  private readonly db = inject(SupabaseDatabaseAdapter);
  // @REVIEW: DestroyRef for subscription cleanup
  private readonly destroyRef = inject(DestroyRef);

  // State
  readonly loading = signal(true);
  readonly subject = signal<Subject | null>(null);
  readonly exams = signal<Exam[]>([]);
  readonly enrolledStudents = signal<StudentWithUser[]>([]);
  readonly studentPerformance = signal<StudentPerformance[]>([]);
  readonly examStats = signal<ExamPerformanceStats[]>([]);

  studentSearchTerm = '';

  // Computed
  readonly filteredStudentPerformance = computed(() => {
    const search = this.studentSearchTerm.toLowerCase().trim();
    if (!search) return this.studentPerformance();
    return this.studentPerformance().filter(
      (p) =>
        p.student.user.fullName.toLowerCase().includes(search) ||
        p.student.user.email.toLowerCase().includes(search)
    );
  });

  readonly overallPassRate = computed(() => {
    const perfs = this.studentPerformance();
    const totalPassed = perfs.reduce((sum, p) => sum + p.passed, 0);
    const totalTaken = perfs.reduce((sum, p) => sum + p.examsTaken, 0);
    return totalTaken > 0 ? Math.round((totalPassed / totalTaken) * 100) : 0;
  });

  readonly overallAverageScore = computed(() => {
    const perfs = this.studentPerformance().filter((p) => p.examsTaken > 0);
    if (perfs.length === 0) return 0;
    return Math.round(
      perfs.reduce((sum, p) => sum + p.averagePercentage, 0) / perfs.length
    );
  });

  readonly participationRate = computed(() => {
    const totalStudents = this.enrolledStudents().length;
    const totalExams = this.exams().length;
    if (totalStudents === 0 || totalExams === 0) return 0;

    const totalPossible = totalStudents * totalExams;
    const totalTaken = this.studentPerformance().reduce(
      (sum, p) => sum + p.examsTaken,
      0
    );
    return Math.round((totalTaken / totalPossible) * 100);
  });

  ngOnInit(): void {
    const subjectId = this.route.snapshot.paramMap.get('id');
    if (subjectId) {
      this.loadReport(subjectId);
    } else {
      this.loading.set(false);
    }
  }

  private loadReport(subjectId: string): void {
    // Load subject, exams, and enrolled students
    forkJoin({
      subject: this.db.subjects.getById(subjectId),
      exams: this.db.exams.getBySubject(subjectId, { page: 1, pageSize: 100 }),
      students: this.db.subjects.getEnrolledStudents(subjectId),
    })
      .pipe(
        switchMap(({ subject, exams, students }) => {
          if (!subject) {
            return of({
              subject: null,
              exams: [],
              students: [],
              submissions: [],
            });
          }

          this.subject.set(subject);
          this.exams.set(exams.items);
          this.enrolledStudents.set(students);

          if (exams.items.length === 0 || students.length === 0) {
            return of({
              subject,
              exams: exams.items,
              students,
              submissions: [] as ExamSubmission[][],
            });
          }

          // Load submissions for each exam
          const submissionRequests = exams.items.map((exam) =>
            this.db.submissions.getByExam(exam.id, { page: 1, pageSize: 500 })
          );

          return forkJoin(submissionRequests).pipe(
            switchMap((submissionResponses) => {
              const allSubmissions = submissionResponses.flatMap(
                (r) => r.items
              );
              return of({
                subject,
                exams: exams.items,
                students,
                submissions: allSubmissions,
              });
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ subject, exams, students, submissions }) => {
          if (!subject) {
            this.loading.set(false);
            return;
          }

          // Build student performance data
          const submissionsByStudent = new Map<string, ExamSubmission[]>();
          (submissions as ExamSubmission[]).forEach((sub) => {
            const existing = submissionsByStudent.get(sub.studentId) ?? [];
            existing.push(sub);
            submissionsByStudent.set(sub.studentId, existing);
          });

          const studentPerfs: StudentPerformance[] = students.map((student) => {
            const studentSubs = submissionsByStudent.get(student.id) ?? [];
            const completedSubs = studentSubs.filter(
              (s) =>
                s.status === 'submitted' ||
                s.status === 'auto_submitted' ||
                s.status === 'evaluated'
            );

            const examSubmissions: ExamSubmissionSummary[] = exams.map(
              (exam) => {
                const sub =
                  completedSubs.find((s) => s.examId === exam.id) ?? null;
                return {
                  examId: exam.id,
                  examTitle: exam.title,
                  submission: sub,
                  totalMarks: exam.totalMarks,
                  passingMarks: exam.passingMarks,
                };
              }
            );

            const passed = examSubmissions.filter(
              (es) => es.submission && es.submission.score >= es.passingMarks
            ).length;

            const totalScore = completedSubs.reduce(
              (sum, s) => sum + s.score,
              0
            );
            const totalMarks = examSubmissions
              .filter((es) => es.submission)
              .reduce((sum, es) => sum + es.totalMarks, 0);

            const avgPercentage =
              completedSubs.length > 0
                ? Math.round(
                    completedSubs.reduce((sum, s) => sum + s.percentage, 0) /
                      completedSubs.length
                  )
                : 0;

            return {
              student,
              totalExams: exams.length,
              examsTaken: completedSubs.length,
              totalScore,
              totalMarks,
              averagePercentage: avgPercentage,
              passed,
              failed: completedSubs.length - passed,
              submissions: examSubmissions,
            };
          });

          this.studentPerformance.set(studentPerfs);

          // Build exam stats
          const examStatsData: ExamPerformanceStats[] = exams.map((exam) => {
            const examSubs = (submissions as ExamSubmission[]).filter(
              (s) =>
                s.examId === exam.id &&
                (s.status === 'submitted' ||
                  s.status === 'auto_submitted' ||
                  s.status === 'evaluated')
            );

            const passed = examSubs.filter(
              (s) => s.score >= exam.passingMarks
            ).length;
            const avgScore =
              examSubs.length > 0
                ? Math.round(
                    examSubs.reduce((sum, s) => sum + s.percentage, 0) /
                      examSubs.length
                  )
                : 0;
            const highestScore =
              examSubs.length > 0
                ? Math.max(...examSubs.map((s) => s.percentage))
                : 0;
            const lowestScore =
              examSubs.length > 0
                ? Math.min(...examSubs.map((s) => s.percentage))
                : 0;

            return {
              exam,
              totalStudents: students.length,
              submitted: examSubs.length,
              passed,
              failed: examSubs.length - passed,
              averageScore: avgScore,
              highestScore,
              lowestScore,
            };
          });

          this.examStats.set(examStatsData);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load report:', err);
          this.loading.set(false);
        },
      });
  }

  getPassRate(stat: ExamPerformanceStats): number {
    return stat.submitted > 0
      ? Math.round((stat.passed / stat.submitted) * 100)
      : 0;
  }

  exportReport(): void {
    // Generate CSV export
    const subject = this.subject();
    const perfs = this.studentPerformance();
    const examList = this.exams();

    if (!subject || perfs.length === 0) return;

    // Build CSV header
    const headers = [
      'Student Name',
      'Email',
      'Exams Taken',
      'Average %',
      'Passed',
      'Failed',
    ];
    examList.forEach((e) => headers.push(e.title));

    // Build CSV rows
    const rows = perfs.map((p) => {
      const row = [
        p.student.user.fullName,
        p.student.user.email,
        p.examsTaken.toString(),
        p.averagePercentage.toString() + '%',
        p.passed.toString(),
        p.failed.toString(),
      ];
      p.submissions.forEach((es) => {
        row.push(es.submission ? es.submission.percentage + '%' : '-');
      });
      return row;
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(',')),
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${subject.name}_report_${
      new Date().toISOString().split('T')[0]
    }.csv`;
    link.click();
  }

  getAvatarColor(name: string): string {
    const colors = [
      'td-tone-info',
      'td-tone-danger',
      'td-tone-success',
      'td-tone-warning',
      'td-tone-accent',
      'td-tone-accent',
      'td-tone-info',
      'td-tone-success',
      'td-tone-warning',
      'td-tone-primary',
    ];
    const index = name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
}
