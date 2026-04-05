// @REVIEW: CSV Export Service - Generates CSV reports for exam submissions
import { Injectable } from '@angular/core';
import { ExamSubmissionWithDetails, StudentWithUser } from '../models';
import { PdfQuestionItem } from './pdf-export.service';

// @REVIEW: CSV export options
export interface CsvExportOptions {
  readonly includeQuestionDetails: boolean;
  readonly includeTimeSpent: boolean;
}

// @REVIEW: Data for single submission CSV export
export interface CsvSubmissionExportData {
  readonly submission: ExamSubmissionWithDetails;
  readonly student: StudentWithUser;
  readonly questions: readonly PdfQuestionItem[];
  readonly totalTimeSpent: number;
  readonly subjectName: string | null;
  readonly options: CsvExportOptions;
}

// @REVIEW: Data for bulk results CSV export
export interface CsvBulkExportData {
  readonly results: readonly CsvResultRow[];
  readonly examTitle?: string;
  readonly subjectName?: string;
}

// @REVIEW: Row data for bulk export
export interface CsvResultRow {
  readonly studentName: string;
  readonly studentEmail: string;
  readonly rollNumber: string | null;
  readonly className: string | null;
  readonly examTitle: string;
  readonly subjectName: string;
  readonly score: number;
  readonly totalMarks: number;
  readonly percentage: number;
  readonly status: string;
  readonly passed: boolean;
  readonly correctAnswers: number;
  readonly wrongAnswers: number;
  readonly skippedQuestions: number;
  readonly attemptNumber: number;
  readonly submittedAt: Date | null;
  readonly timeSpentSeconds?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CsvExportService {
  // @REVIEW: Export single submission to CSV
  exportSubmissionReport(data: CsvSubmissionExportData): void {
    const {
      submission,
      student,
      questions,
      totalTimeSpent,
      subjectName,
      options,
    } = data;
    const exam = submission.exam;
    const passed = submission.score >= exam.passingMarks;

    const rows: string[][] = [];

    // Header section
    rows.push(['EXAM REPORT']);
    rows.push([]);
    rows.push(['Exam Title', exam.title]);
    rows.push(['Subject', subjectName ?? 'Independent Exam']);
    rows.push([]);

    // Student info
    rows.push(['STUDENT INFORMATION']);
    rows.push(['Name', student.user.fullName]);
    rows.push(['Email', student.user.email]);
    if (student.rollNumber) rows.push(['Roll Number', student.rollNumber]);
    if (student.className)
      rows.push([
        'Class',
        `${student.className}${student.section ? ` - ${student.section}` : ''}`,
      ]);
    rows.push([]);

    // Submission info
    rows.push(['SUBMISSION DETAILS']);
    rows.push(['Attempt', `#${submission.attemptNumber}`]);
    rows.push(['Started', this.formatDate(submission.startedAt)]);
    rows.push([
      'Submitted',
      submission.submittedAt
        ? this.formatDate(submission.submittedAt)
        : 'In Progress',
    ]);
    rows.push(['Status', submission.status.replace('_', ' ').toUpperCase()]);
    if (options.includeTimeSpent) {
      rows.push(['Time Spent', this.formatTime(totalTimeSpent)]);
    }
    rows.push([]);

    // Results
    rows.push(['RESULTS']);
    rows.push(['Score', `${submission.score} / ${exam.totalMarks}`]);
    rows.push(['Percentage', `${submission.percentage}%`]);
    rows.push(['Result', passed ? 'PASSED' : 'FAILED']);
    rows.push(['Passing Marks', exam.passingMarks.toString()]);
    rows.push(['Correct Answers', submission.totalCorrect.toString()]);
    rows.push(['Wrong Answers', submission.totalWrong.toString()]);
    rows.push(['Skipped Questions', submission.totalSkipped.toString()]);
    rows.push([]);

    // Teacher remarks
    if (submission.remarks) {
      rows.push(['TEACHER REMARKS']);
      rows.push([submission.remarks]);
      rows.push([]);
    }

    // Question details
    if (options.includeQuestionDetails && questions.length > 0) {
      rows.push(['QUESTION DETAILS']);

      const headers = [
        'Q#',
        'Question',
        'Status',
        'Marks Obtained',
        'Max Marks',
      ];
      if (options.includeTimeSpent) headers.push('Time Spent');
      headers.push('Your Answer', 'Correct Answer');
      rows.push(headers);

      questions.forEach((q) => {
        const selectedOption = q.options.find(
          (o) => o.id === q.selectedOptionId
        );
        const correctOption = q.options.find((o) => o.id === q.correctOptionId);

        const row = [
          q.questionNumber.toString(),
          q.questionText,
          q.status.charAt(0).toUpperCase() + q.status.slice(1),
          q.marksObtained.toString(),
          q.maxMarks.toString(),
        ];

        if (options.includeTimeSpent) {
          row.push(this.formatTime(q.timeSpentSeconds));
        }

        row.push(selectedOption?.text ?? '-');
        row.push(correctOption?.text ?? '-');

        rows.push(row);
      });
    }

    // Generate and download
    const filename = `${this.sanitizeFilename(
      student.user.fullName
    )}_${this.sanitizeFilename(exam.title)}_report.csv`;
    this.downloadCsv(rows, filename);
  }

  // @REVIEW: Export bulk results to CSV
  exportBulkResults(data: CsvBulkExportData): void {
    const { results, examTitle, subjectName } = data;
    const rows: string[][] = [];

    // Title row
    if (examTitle || subjectName) {
      rows.push([
        `Results Report${examTitle ? ` - ${examTitle}` : ''}${
          subjectName ? ` (${subjectName})` : ''
        }`,
      ]);
      rows.push([`Generated: ${this.formatDate(new Date())}`]);
      rows.push([]);
    }

    // Headers
    const headers = [
      'Student Name',
      'Email',
      'Roll Number',
      'Class',
      'Exam',
      'Subject',
      'Score',
      'Total Marks',
      'Percentage',
      'Result',
      'Status',
      'Correct',
      'Wrong',
      'Skipped',
      'Attempt',
      'Submitted',
    ];

    // Check if any result has time spent
    const hasTimeSpent = results.some((r) => r.timeSpentSeconds !== undefined);
    if (hasTimeSpent) {
      headers.push('Time Spent');
    }

    rows.push(headers);

    // Data rows
    results.forEach((r) => {
      const row = [
        r.studentName,
        r.studentEmail,
        r.rollNumber ?? '',
        r.className ?? '',
        r.examTitle,
        r.subjectName,
        r.score.toString(),
        r.totalMarks.toString(),
        `${r.percentage}%`,
        r.passed ? 'PASSED' : 'FAILED',
        r.status.replace('_', ' '),
        r.correctAnswers.toString(),
        r.wrongAnswers.toString(),
        r.skippedQuestions.toString(),
        `#${r.attemptNumber}`,
        r.submittedAt ? this.formatDate(r.submittedAt) : 'In Progress',
      ];

      if (hasTimeSpent) {
        row.push(
          r.timeSpentSeconds !== undefined
            ? this.formatTime(r.timeSpentSeconds)
            : '-'
        );
      }

      rows.push(row);
    });

    // Summary row
    rows.push([]);
    rows.push(['SUMMARY']);
    rows.push(['Total Submissions', results.length.toString()]);
    rows.push(['Passed', results.filter((r) => r.passed).length.toString()]);
    rows.push(['Failed', results.filter((r) => !r.passed).length.toString()]);

    const avgPercentage =
      results.length > 0
        ? Math.round(
            results.reduce((sum, r) => sum + r.percentage, 0) / results.length
          )
        : 0;
    rows.push(['Average Percentage', `${avgPercentage}%`]);

    // Generate filename
    let filename = 'results_export';
    if (examTitle) filename = this.sanitizeFilename(examTitle) + '_results';
    else if (subjectName)
      filename = this.sanitizeFilename(subjectName) + '_results';
    filename += `_${new Date().toISOString().split('T')[0]}.csv`;

    this.downloadCsv(rows, filename);
  }

  // @REVIEW: Convert rows to CSV and trigger download
  private downloadCsv(rows: string[][], filename: string): void {
    const csvContent = rows
      .map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // @REVIEW: Escape CSV cell content
  private escapeCsvCell(cell: string): string {
    if (
      cell.includes(',') ||
      cell.includes('"') ||
      cell.includes('\n') ||
      cell.includes('\r')
    ) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  }

  // @REVIEW: Sanitize filename
  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);
  }

  // @REVIEW: Format date for display
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  // @REVIEW: Format time in seconds to readable format
  private formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  }
}
