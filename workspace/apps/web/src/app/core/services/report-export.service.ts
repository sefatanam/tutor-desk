// @REVIEW: Report Export Service
// Generates comprehensive PDF reports for exam-wise and subject-wise student results
// Features: Deduplication (last attempt only), retake indication, statistics

import { Injectable } from '@angular/core';

// =============================================
// INTERFACES
// =============================================

// @REVIEW: Student result entry for reports
export interface StudentResultEntry {
  readonly studentId: string;
  readonly studentName: string;
  readonly studentEmail: string;
  readonly rollNumber: string | null;
  readonly className: string | null;
  readonly section: string | null;
  readonly score: number;
  readonly totalMarks: number;
  readonly percentage: number;
  readonly passed: boolean;
  readonly totalCorrect: number;
  readonly totalWrong: number;
  readonly totalSkipped: number;
  readonly attemptNumber: number;
  readonly hasRetake: boolean; // @REVIEW: Indicates if student has taken multiple attempts
  readonly submittedAt: Date | null;
  readonly status: string;
}

// @REVIEW: Exam report data structure
export interface ExamReportData {
  readonly examTitle: string;
  readonly examDescription: string | null;
  readonly subjectName: string | null;
  readonly subjectColor: string | null;
  readonly teacherName: string;
  readonly totalMarks: number;
  readonly passingMarks: number;
  readonly totalQuestions: number;
  readonly scheduledStart: Date | null;
  readonly scheduledEnd: Date | null;
  readonly students: readonly StudentResultEntry[];
}

// @REVIEW: Subject report data structure (aggregates multiple exams)
export interface SubjectReportData {
  readonly subjectName: string;
  readonly subjectColor: string;
  readonly teacherName: string;
  readonly exams: readonly ExamSummaryForSubject[];
  readonly students: readonly StudentSubjectSummary[];
}

// @REVIEW: Exam summary within subject report
export interface ExamSummaryForSubject {
  readonly examId: string;
  readonly examTitle: string;
  readonly totalMarks: number;
  readonly passingMarks: number;
  readonly totalQuestions: number;
  readonly averageScore: number;
  readonly passRate: number;
  readonly totalSubmissions: number;
}

// @REVIEW: Student summary across all exams in a subject
export interface StudentSubjectSummary {
  readonly studentId: string;
  readonly studentName: string;
  readonly studentEmail: string;
  readonly rollNumber: string | null;
  readonly className: string | null;
  readonly section: string | null;
  readonly examResults: readonly ExamResultForStudent[];
  readonly totalScore: number;
  readonly totalMaxScore: number;
  readonly overallPercentage: number;
  readonly examsTaken: number;
  readonly examsPassed: number;
}

// @REVIEW: Individual exam result for a student in subject report
export interface ExamResultForStudent {
  readonly examId: string;
  readonly score: number | null; // null if not attempted
  readonly totalMarks: number;
  readonly percentage: number | null;
  readonly passed: boolean | null;
  readonly hasRetake: boolean;
  readonly attemptNumber: number | null;
}

// @REVIEW: Report export options
export interface ReportExportOptions {
  readonly includeStatistics?: boolean;
  readonly includeRanking?: boolean;
  readonly sortBy?: 'name' | 'roll' | 'score' | 'percentage';
  readonly sortOrder?: 'asc' | 'desc';
}

// =============================================
// SERVICE
// =============================================

@Injectable({
  providedIn: 'root',
})
export class ReportExportService {
  // =============================================
  // EXAM-WISE REPORT
  // =============================================

  // @REVIEW: Export exam-wise student results as PDF
  exportExamReport(
    data: ExamReportData,
    options: ReportExportOptions = {}
  ): void {
    console.log(
      '[ReportExportService] exportExamReport called with:',
      data.examTitle,
      'students:',
      data.students.length
    );
    const sortedStudents = this.sortStudents(data.students, options);
    const rankedStudents =
      options.includeRanking !== false
        ? this.assignRanks(sortedStudents)
        : sortedStudents.map((s) => ({ ...s, rank: null }));

    const html = this.generateExamReportHtml(data, rankedStudents, options);
    console.log('[ReportExportService] HTML generated, length:', html.length);
    this.openPrintWindow(html, `${data.examTitle} - Results Report`);
  }

  // @REVIEW: Generate HTML for exam report
  private generateExamReportHtml(
    data: ExamReportData,
    students: readonly (StudentResultEntry & { rank: number | null })[],
    options: ReportExportOptions
  ): string {
    const stats = this.calculateExamStats(data.students);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.examTitle} - Results Report</title>
  <style>
    ${this.getReportStyles()}
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>${this.escapeHtml(data.examTitle)}</h1>
    <div class="subtitle">
      ${
        data.subjectName
          ? `<span class="subject-badge" style="background: ${
              data.subjectColor ?? '#6b7280'
            }">${this.escapeHtml(data.subjectName)}</span>`
          : '<span class="subject-badge" style="background: #6b7280">Independent Exam</span>'
      }
      <span class="separator">|</span>
      <span>Exam Results Report</span>
    </div>
  </div>

  <!-- Exam Info -->
  <div class="info-section">
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Teacher</span>
        <span class="info-value">${this.escapeHtml(data.teacherName)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Marks</span>
        <span class="info-value">${data.totalMarks}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Passing Marks</span>
        <span class="info-value">${data.passingMarks}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Questions</span>
        <span class="info-value">${data.totalQuestions}</span>
      </div>
      ${
        data.scheduledStart
          ? `
      <div class="info-item">
        <span class="info-label">Exam Date</span>
        <span class="info-value">${this.formatDate(data.scheduledStart)}</span>
      </div>
      `
          : ''
      }
      <div class="info-item">
        <span class="info-label">Total Students</span>
        <span class="info-value">${students.length}</span>
      </div>
    </div>
  </div>

  ${
    options.includeStatistics !== false
      ? `
  <!-- Statistics -->
  <div class="stats-section">
    <h2>Statistics</h2>
    <div class="stats-grid">
      <div class="stat-box passed">
        <div class="stat-value">${stats.passCount}</div>
        <div class="stat-label">Passed</div>
        <div class="stat-percent">${stats.passRate.toFixed(1)}%</div>
      </div>
      <div class="stat-box failed">
        <div class="stat-value">${stats.failCount}</div>
        <div class="stat-label">Failed</div>
        <div class="stat-percent">${(100 - stats.passRate).toFixed(1)}%</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats.averageScore.toFixed(1)}</div>
        <div class="stat-label">Avg Score</div>
        <div class="stat-percent">${stats.averagePercentage.toFixed(1)}%</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats.highestScore}</div>
        <div class="stat-label">Highest</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${stats.lowestScore}</div>
        <div class="stat-label">Lowest</div>
      </div>
      <div class="stat-box retake">
        <div class="stat-value">${stats.retakeCount}</div>
        <div class="stat-label">Retakes</div>
      </div>
    </div>
  </div>
  `
      : ''
  }

  <!-- Results Table -->
  <div class="table-section">
    <h2>Student Results</h2>
    <table class="results-table">
      <thead>
        <tr>
          ${
            options.includeRanking !== false
              ? '<th class="center">Rank</th>'
              : ''
          }
          <th>Student Name</th>
          <th>Roll No.</th>
          <th>Class</th>
          <th class="center">Score</th>
          <th class="center">%</th>
          <th class="center">Correct</th>
          <th class="center">Wrong</th>
          <th class="center">Skip</th>
          <th class="center">Result</th>
          <th class="center">Attempt</th>
        </tr>
      </thead>
      <tbody>
        ${students
          .map(
            (s, i) => `
        <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
          ${
            options.includeRanking !== false
              ? `<td class="center rank">${s.rank ?? '-'}</td>`
              : ''
          }
          <td>
            <div class="student-name">${this.escapeHtml(s.studentName)}</div>
            <div class="student-email">${this.escapeHtml(s.studentEmail)}</div>
          </td>
          <td>${s.rollNumber ?? '-'}</td>
          <td>${
            s.className
              ? `${s.className}${s.section ? `-${s.section}` : ''}`
              : '-'
          }</td>
          <td class="center score">${s.score}/${s.totalMarks}</td>
          <td class="center">${s.percentage.toFixed(1)}%</td>
          <td class="center correct">${s.totalCorrect}</td>
          <td class="center wrong">${s.totalWrong}</td>
          <td class="center skipped">${s.totalSkipped}</td>
          <td class="center">
            <span class="result-badge ${s.passed ? 'passed' : 'failed'}">${
              s.passed ? 'PASS' : 'FAIL'
            }</span>
          </td>
          <td class="center">
            ${
              s.hasRetake
                ? `<span class="retake-badge">#${s.attemptNumber}</span>`
                : `#${s.attemptNumber}`
            }
          </td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>Generated on ${this.formatDate(
      new Date()
    )} | Tutor Desk - Empowering Education</p>
    <p class="note">* Students with multiple attempts are marked with attempt number. Only the latest attempt is shown.</p>
  </div>
</body>
</html>
    `;
  }

  // =============================================
  // SUBJECT-WISE REPORT
  // =============================================

  // @REVIEW: Export subject-wise student results as PDF
  exportSubjectReport(
    data: SubjectReportData,
    options: ReportExportOptions = {}
  ): void {
    const sortedStudents = this.sortSubjectStudents(data.students, options);
    const html = this.generateSubjectReportHtml(data, sortedStudents, options);
    this.openPrintWindow(html, `${data.subjectName} - Subject Report`);
  }

  // @REVIEW: Generate HTML for subject report
  private generateSubjectReportHtml(
    data: SubjectReportData,
    students: readonly StudentSubjectSummary[],
    options: ReportExportOptions
  ): string {
    const subjectStats = this.calculateSubjectStats(data);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.subjectName} - Subject Report</title>
  <style>
    ${this.getReportStyles()}
    
    /* Subject report specific styles */
    .exam-summary-table { margin-bottom: 24px; }
    .exam-summary-table th, .exam-summary-table td { padding: 8px 12px; }
    .student-exams-table { width: 100%; }
    .student-exams-table th { font-size: 10px; white-space: nowrap; }
    .student-exams-table td { font-size: 11px; text-align: center; }
    .exam-score { font-weight: 500; }
    .exam-score.passed { color: #16a34a; }
    .exam-score.failed { color: #dc2626; }
    .exam-score.not-taken { color: #9ca3af; font-style: italic; }
    .overall-cell { background: #f0f9ff !important; font-weight: 600; }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>${this.escapeHtml(data.subjectName)}</h1>
    <div class="subtitle">
      <span class="subject-badge" style="background: ${
        data.subjectColor
      }">${this.escapeHtml(data.subjectName)}</span>
      <span class="separator">|</span>
      <span>Subject Progress Report</span>
    </div>
  </div>

  <!-- Subject Info -->
  <div class="info-section">
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Teacher</span>
        <span class="info-value">${this.escapeHtml(data.teacherName)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Exams</span>
        <span class="info-value">${data.exams.length}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Total Students</span>
        <span class="info-value">${students.length}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Report Date</span>
        <span class="info-value">${this.formatDate(new Date())}</span>
      </div>
    </div>
  </div>

  ${
    options.includeStatistics !== false
      ? `
  <!-- Subject Statistics -->
  <div class="stats-section">
    <h2>Subject Overview</h2>
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-value">${subjectStats.totalSubmissions}</div>
        <div class="stat-label">Total Submissions</div>
      </div>
      <div class="stat-box passed">
        <div class="stat-value">${subjectStats.overallPassRate.toFixed(
          1
        )}%</div>
        <div class="stat-label">Overall Pass Rate</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${subjectStats.overallAveragePercentage.toFixed(
          1
        )}%</div>
        <div class="stat-label">Avg Percentage</div>
      </div>
      <div class="stat-box retake">
        <div class="stat-value">${subjectStats.totalRetakes}</div>
        <div class="stat-label">Total Retakes</div>
      </div>
    </div>
  </div>
  `
      : ''
  }

  <!-- Exam Summary -->
  <div class="table-section">
    <h2>Exam Summary</h2>
    <table class="results-table exam-summary-table">
      <thead>
        <tr>
          <th>Exam Title</th>
          <th class="center">Total Marks</th>
          <th class="center">Pass Marks</th>
          <th class="center">Submissions</th>
          <th class="center">Avg Score</th>
          <th class="center">Pass Rate</th>
        </tr>
      </thead>
      <tbody>
        ${data.exams
          .map(
            (e, i) => `
        <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
          <td>${this.escapeHtml(e.examTitle)}</td>
          <td class="center">${e.totalMarks}</td>
          <td class="center">${e.passingMarks}</td>
          <td class="center">${e.totalSubmissions}</td>
          <td class="center">${e.averageScore.toFixed(1)}</td>
          <td class="center">${e.passRate.toFixed(1)}%</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <!-- Student Progress Table -->
  <div class="table-section">
    <h2>Student Progress</h2>
    <table class="results-table student-exams-table">
      <thead>
        <tr>
          <th>Student Name</th>
          <th>Roll No.</th>
          ${data.exams
            .map(
              (e) =>
                `<th class="center" title="${this.escapeHtml(
                  e.examTitle
                )}">${this.truncateText(e.examTitle, 12)}</th>`
            )
            .join('')}
          <th class="center overall-cell">Overall %</th>
          <th class="center overall-cell">Exams Passed</th>
        </tr>
      </thead>
      <tbody>
        ${students
          .map(
            (s, i) => `
        <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
          <td>
            <div class="student-name">${this.escapeHtml(s.studentName)}</div>
            <div class="student-email">${this.escapeHtml(s.studentEmail)}</div>
          </td>
          <td>${s.rollNumber ?? '-'}</td>
          ${data.exams
            .map((exam) => {
              const result = s.examResults.find(
                (r) => r.examId === exam.examId
              );
              if (!result || result.score === null) {
                return '<td class="center exam-score not-taken">-</td>';
              }
              const className = result.passed ? 'passed' : 'failed';
              const retakeIndicator = result.hasRetake
                ? `<sup title="Attempt #${result.attemptNumber}">(${result.attemptNumber})</sup>`
                : '';
              return `<td class="center exam-score ${className}">${result.score}${retakeIndicator}</td>`;
            })
            .join('')}
          <td class="center overall-cell">${s.overallPercentage.toFixed(
            1
          )}%</td>
          <td class="center overall-cell">${s.examsPassed}/${s.examsTaken}</td>
        </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <p>Generated on ${this.formatDate(
      new Date()
    )} | Tutor Desk - Empowering Education</p>
    <p class="note">* Numbers in parentheses indicate attempt number for students with retakes. Only the latest attempt is shown.</p>
  </div>
</body>
</html>
    `;
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  // @REVIEW: Sort students by specified criteria
  private sortStudents(
    students: readonly StudentResultEntry[],
    options: ReportExportOptions
  ): StudentResultEntry[] {
    const sorted = [...students];
    const sortBy = options.sortBy ?? 'score';
    const sortOrder = options.sortOrder ?? 'desc';
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return multiplier * a.studentName.localeCompare(b.studentName);
        case 'roll':
          return (
            multiplier * (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '')
          );
        case 'percentage':
          return multiplier * (a.percentage - b.percentage);
        case 'score':
        default:
          return multiplier * (a.score - b.score);
      }
    });

    return sorted;
  }

  // @REVIEW: Sort subject students
  private sortSubjectStudents(
    students: readonly StudentSubjectSummary[],
    options: ReportExportOptions
  ): StudentSubjectSummary[] {
    const sorted = [...students];
    const sortBy = options.sortBy ?? 'percentage';
    const sortOrder = options.sortOrder ?? 'desc';
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return multiplier * a.studentName.localeCompare(b.studentName);
        case 'roll':
          return (
            multiplier * (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '')
          );
        case 'score':
          return multiplier * (a.totalScore - b.totalScore);
        case 'percentage':
        default:
          return multiplier * (a.overallPercentage - b.overallPercentage);
      }
    });

    return sorted;
  }

  // @REVIEW: Assign ranks based on score (same score = same rank)
  private assignRanks(
    students: readonly StudentResultEntry[]
  ): (StudentResultEntry & { rank: number | null })[] {
    // Sort by score descending for ranking
    const sortedByScore = [...students].sort((a, b) => b.score - a.score);

    let currentRank = 1;
    let previousScore = -1;
    let sameRankCount = 0;

    return sortedByScore.map((student, index) => {
      if (student.score !== previousScore) {
        currentRank = index + 1;
        sameRankCount = 1;
      } else {
        sameRankCount++;
      }
      previousScore = student.score;

      return { ...student, rank: currentRank };
    });
  }

  // @REVIEW: Calculate exam statistics
  private calculateExamStats(students: readonly StudentResultEntry[]): {
    passCount: number;
    failCount: number;
    passRate: number;
    averageScore: number;
    averagePercentage: number;
    highestScore: number;
    lowestScore: number;
    retakeCount: number;
  } {
    if (students.length === 0) {
      return {
        passCount: 0,
        failCount: 0,
        passRate: 0,
        averageScore: 0,
        averagePercentage: 0,
        highestScore: 0,
        lowestScore: 0,
        retakeCount: 0,
      };
    }

    const passCount = students.filter((s) => s.passed).length;
    const totalScores = students.reduce((sum, s) => sum + s.score, 0);
    const totalPercentages = students.reduce((sum, s) => sum + s.percentage, 0);
    const retakeCount = students.filter((s) => s.hasRetake).length;

    return {
      passCount,
      failCount: students.length - passCount,
      passRate: (passCount / students.length) * 100,
      averageScore: totalScores / students.length,
      averagePercentage: totalPercentages / students.length,
      highestScore: Math.max(...students.map((s) => s.score)),
      lowestScore: Math.min(...students.map((s) => s.score)),
      retakeCount,
    };
  }

  // @REVIEW: Calculate subject-level statistics
  private calculateSubjectStats(data: SubjectReportData): {
    totalSubmissions: number;
    overallPassRate: number;
    overallAveragePercentage: number;
    totalRetakes: number;
  } {
    let totalSubmissions = 0;
    let totalPassed = 0;
    let totalPercentage = 0;
    let totalRetakes = 0;
    let submissionCount = 0;

    data.students.forEach((student) => {
      student.examResults.forEach((result) => {
        if (result.score !== null) {
          totalSubmissions++;
          submissionCount++;
          if (result.passed) totalPassed++;
          totalPercentage += result.percentage ?? 0;
          if (result.hasRetake) totalRetakes++;
        }
      });
    });

    return {
      totalSubmissions,
      overallPassRate:
        submissionCount > 0 ? (totalPassed / submissionCount) * 100 : 0,
      overallAveragePercentage:
        submissionCount > 0 ? totalPercentage / submissionCount : 0,
      totalRetakes,
    };
  }

  // @REVIEW: Common report styles
  private getReportStyles(): string {
    return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      color: #1f2937;
      padding: 20px;
      max-width: 1100px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      text-align: center;
      border-bottom: 3px solid #3b82f6;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 8px;
    }
    .subtitle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 13px;
      color: #6b7280;
    }
    .subject-badge {
      padding: 4px 12px;
      border-radius: 16px;
      color: white;
      font-size: 12px;
      font-weight: 500;
    }
    .separator { color: #d1d5db; }

    /* Info Section */
    .info-section {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .info-label {
      font-size: 10px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      font-size: 13px;
      font-weight: 500;
      color: #1f2937;
    }

    /* Stats Section */
    .stats-section {
      margin-bottom: 24px;
    }
    .stats-section h2 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
      gap: 12px;
    }
    .stat-box {
      text-align: center;
      padding: 12px 8px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .stat-box.passed { border-left: 4px solid #16a34a; }
    .stat-box.failed { border-left: 4px solid #dc2626; }
    .stat-box.retake { border-left: 4px solid #f59e0b; }
    .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
    }
    .stat-box.passed .stat-value { color: #16a34a; }
    .stat-box.failed .stat-value { color: #dc2626; }
    .stat-box.retake .stat-value { color: #f59e0b; }
    .stat-label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .stat-percent {
      font-size: 11px;
      color: #9ca3af;
    }

    /* Table Section */
    .table-section {
      margin-bottom: 24px;
    }
    .table-section h2 {
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 6px;
    }

    /* Results Table */
    .results-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .results-table th {
      background: #f3f4f6;
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #d1d5db;
      white-space: nowrap;
    }
    .results-table th.center { text-align: center; }
    .results-table td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: middle;
    }
    .results-table tr.even { background: #ffffff; }
    .results-table tr.odd { background: #f9fafb; }
    .results-table tr:hover { background: #f0f9ff; }

    .student-name {
      font-weight: 500;
      color: #1f2937;
    }
    .student-email {
      font-size: 10px;
      color: #6b7280;
    }
    .center { text-align: center; }
    .rank { font-weight: 700; color: #3b82f6; }
    .score { font-weight: 600; }
    .correct { color: #16a34a; }
    .wrong { color: #dc2626; }
    .skipped { color: #f59e0b; }

    /* Badges */
    .result-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
    }
    .result-badge.passed {
      background: #dcfce7;
      color: #16a34a;
    }
    .result-badge.failed {
      background: #fee2e2;
      color: #dc2626;
    }
    .retake-badge {
      background: #fef3c7;
      color: #d97706;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 500;
    }

    /* Footer */
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
    }
    .footer .note {
      margin-top: 4px;
      font-style: italic;
    }

    /* Print Styles */
    @media print {
      body { padding: 10px; font-size: 10px; }
      .results-table { font-size: 9px; }
      .results-table th, .results-table td { padding: 6px 4px; }
      .no-print { display: none !important; }
      .table-section { page-break-inside: avoid; }
    }
    `;
  }

  // @REVIEW: Open print window for PDF generation
  private openPrintWindow(html: string, title: string): void {
    console.log('[ReportExportService] openPrintWindow called for:', title);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('[ReportExportService] Pop-up blocked!');
      alert('Please allow pop-ups to generate PDF report');
      return;
    }

    console.log('[ReportExportService] Print window opened successfully');
    printWindow.document.write(html);
    printWindow.document.close();

    // @REVIEW: Use setTimeout instead of onload - onload doesn't reliably fire for document.write
    setTimeout(() => {
      try {
        console.log('[ReportExportService] Triggering print dialog');
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error('[ReportExportService] Print failed:', e);
      }
    }, 500);
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

  // @REVIEW: Escape HTML to prevent XSS
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // @REVIEW: Truncate text with ellipsis
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 1) + '…';
  }
}
