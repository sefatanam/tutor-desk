// @REVIEW: PDF Export Service - Generates PDF reports for exam submissions
// Uses browser's print functionality for PDF generation (no external dependencies)
import { Injectable } from '@angular/core';
import { ExamSubmissionWithDetails, StudentWithUser, Question, QuestionOption } from '../models';

// @REVIEW: Question review item for PDF export
export interface PdfQuestionItem {
  readonly questionNumber: number;
  readonly questionText: string;
  readonly options: readonly QuestionOption[];
  readonly selectedOptionId: string | null;
  readonly correctOptionId: string;
  readonly status: 'correct' | 'wrong' | 'skipped' | 'unanswered';
  readonly marksObtained: number;
  readonly maxMarks: number;
  readonly timeSpentSeconds: number;
  readonly explanation: string | null;
}

// @REVIEW: Export options for PDF generation
export interface PdfExportOptions {
  readonly includeQuestions: boolean;
  readonly includeAnswers: boolean;
  readonly includeCorrectAnswers: boolean;
  readonly includeExplanations: boolean;
  readonly includeTimeSpent: boolean;
  readonly includeRemarks: boolean;
}

// @REVIEW: Data required for PDF export
export interface PdfExportData {
  readonly submission: ExamSubmissionWithDetails;
  readonly student: StudentWithUser;
  readonly questions: readonly PdfQuestionItem[];
  readonly totalTimeSpent: number;
  readonly subjectName: string | null;
  readonly options: PdfExportOptions;
}

@Injectable({
  providedIn: 'root',
})
export class PdfExportService {
  
  // @REVIEW: Generate and download PDF report
  exportSubmissionReport(data: PdfExportData): void {
    const html = this.generateHtml(data);
    this.openPrintWindow(html, data);
  }

  // @REVIEW: Generate HTML content for PDF
  private generateHtml(data: PdfExportData): string {
    const { submission, student, questions, totalTimeSpent, subjectName, options } = data;
    const exam = submission.exam;
    const passed = submission.score >= exam.passingMarks;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exam Report - ${student.user.fullName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }

    /* Header */
    .header {
      text-align: center;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 14px;
      color: #6b7280;
    }

    /* Info Grid */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }
    .info-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
    }
    .info-card h3 {
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 500; }

    /* Result Banner */
    .result-banner {
      text-align: center;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .result-banner.passed {
      background: #dcfce7;
      border: 1px solid #86efac;
    }
    .result-banner.failed {
      background: #fee2e2;
      border: 1px solid #fca5a5;
    }
    .result-banner .score {
      font-size: 32px;
      font-weight: 700;
    }
    .result-banner.passed .score { color: #16a34a; }
    .result-banner.failed .score { color: #dc2626; }
    .result-banner .percentage {
      font-size: 18px;
      color: #6b7280;
    }
    .result-banner .status {
      font-size: 14px;
      font-weight: 600;
      margin-top: 4px;
    }
    .result-banner.passed .status { color: #16a34a; }
    .result-banner.failed .status { color: #dc2626; }

    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-box {
      text-align: center;
      padding: 12px 8px;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    }
    .stat-box .value {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
    }
    .stat-box .label {
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
    }
    .stat-box.correct .value { color: #16a34a; }
    .stat-box.wrong .value { color: #dc2626; }
    .stat-box.skipped .value { color: #f59e0b; }

    /* Remarks Section */
    .remarks-section {
      background: #fffbeb;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 20px;
    }
    .remarks-section h3 {
      font-size: 12px;
      font-weight: 600;
      color: #92400e;
      margin-bottom: 8px;
    }
    .remarks-section p {
      color: #78350f;
      white-space: pre-wrap;
    }

    /* Questions Section */
    .questions-section {
      margin-top: 24px;
    }
    .questions-section h2 {
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 8px;
      margin-bottom: 16px;
    }

    /* Question Card */
    .question-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 16px;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .question-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .question-number {
      font-weight: 600;
      color: #1f2937;
    }
    .question-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
    }
    .question-status {
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
    }
    .question-status.correct {
      background: #dcfce7;
      color: #16a34a;
    }
    .question-status.wrong {
      background: #fee2e2;
      color: #dc2626;
    }
    .question-status.skipped {
      background: #fef3c7;
      color: #d97706;
    }
    .question-body {
      padding: 12px;
    }
    .question-text {
      font-size: 13px;
      font-weight: 500;
      margin-bottom: 12px;
      color: #1f2937;
    }

    /* Options */
    .options-list {
      list-style: none;
    }
    .option-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 8px 10px;
      margin-bottom: 4px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    .option-item.selected {
      background: #eff6ff;
      border-color: #93c5fd;
    }
    .option-item.correct {
      background: #dcfce7;
      border-color: #86efac;
    }
    .option-item.selected.wrong {
      background: #fee2e2;
      border-color: #fca5a5;
    }
    .option-marker {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid #d1d5db;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .option-item.selected .option-marker {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
    }
    .option-item.correct .option-marker {
      background: #16a34a;
      border-color: #16a34a;
      color: white;
    }
    .option-text {
      flex: 1;
      font-size: 12px;
    }
    .option-indicator {
      font-size: 10px;
      font-weight: 500;
      padding: 1px 6px;
      border-radius: 3px;
    }
    .option-indicator.your-answer {
      background: #dbeafe;
      color: #1d4ed8;
    }
    .option-indicator.correct-answer {
      background: #dcfce7;
      color: #16a34a;
    }

    /* Explanation */
    .explanation {
      margin-top: 12px;
      padding: 10px;
      background: #f0f9ff;
      border-radius: 6px;
      border-left: 3px solid #3b82f6;
    }
    .explanation-label {
      font-size: 10px;
      font-weight: 600;
      color: #1d4ed8;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .explanation-text {
      font-size: 12px;
      color: #1e40af;
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

    /* Print Styles */
    @media print {
      body { padding: 0; }
      .question-card { page-break-inside: avoid; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <h1>${exam.title}</h1>
    <div class="subtitle">${subjectName ?? 'Independent Exam'} | Exam Report</div>
  </div>

  <!-- Info Grid -->
  <div class="info-grid">
    <div class="info-card">
      <h3>Student Information</h3>
      <div class="info-row">
        <span class="info-label">Name</span>
        <span class="info-value">${student.user.fullName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email</span>
        <span class="info-value">${student.user.email}</span>
      </div>
      ${student.rollNumber ? `
      <div class="info-row">
        <span class="info-label">Roll Number</span>
        <span class="info-value">${student.rollNumber}</span>
      </div>
      ` : ''}
      ${student.className ? `
      <div class="info-row">
        <span class="info-label">Class</span>
        <span class="info-value">${student.className}${student.section ? ` - ${student.section}` : ''}</span>
      </div>
      ` : ''}
    </div>

    <div class="info-card">
      <h3>Submission Details</h3>
      <div class="info-row">
        <span class="info-label">Attempt</span>
        <span class="info-value">#${submission.attemptNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Started</span>
        <span class="info-value">${this.formatDate(submission.startedAt)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Submitted</span>
        <span class="info-value">${submission.submittedAt ? this.formatDate(submission.submittedAt) : 'In Progress'}</span>
      </div>
      ${options.includeTimeSpent ? `
      <div class="info-row">
        <span class="info-label">Time Spent</span>
        <span class="info-value">${this.formatTime(totalTimeSpent)}</span>
      </div>
      ` : ''}
    </div>
  </div>

  <!-- Result Banner -->
  <div class="result-banner ${passed ? 'passed' : 'failed'}">
    <div class="score">${submission.score} / ${exam.totalMarks}</div>
    <div class="percentage">${submission.percentage}%</div>
    <div class="status">${passed ? 'PASSED' : 'FAILED'} (Passing: ${exam.passingMarks} marks)</div>
  </div>

  <!-- Stats Grid -->
  <div class="stats-grid">
    <div class="stat-box correct">
      <div class="value">${submission.totalCorrect}</div>
      <div class="label">Correct</div>
    </div>
    <div class="stat-box wrong">
      <div class="value">${submission.totalWrong}</div>
      <div class="label">Wrong</div>
    </div>
    <div class="stat-box skipped">
      <div class="value">${submission.totalSkipped}</div>
      <div class="label">Skipped</div>
    </div>
    <div class="stat-box">
      <div class="value">${exam.totalQuestions}</div>
      <div class="label">Total</div>
    </div>
  </div>

  ${options.includeRemarks && submission.remarks ? `
  <!-- Teacher Remarks -->
  <div class="remarks-section">
    <h3>Teacher's Remarks</h3>
    <p>${this.escapeHtml(submission.remarks)}</p>
  </div>
  ` : ''}

  ${options.includeQuestions ? this.generateQuestionsHtml(questions, options) : ''}

  <!-- Footer -->
  <div class="footer">
    Generated on ${this.formatDate(new Date())} | Tutor Desk - Empowering Education
  </div>
</body>
</html>
    `;
  }

  // @REVIEW: Generate HTML for questions section
  private generateQuestionsHtml(questions: readonly PdfQuestionItem[], options: PdfExportOptions): string {
    if (questions.length === 0) return '';

    const questionsHtml = questions.map((q, index) => {
      const optionsHtml = q.options.map((opt, optIndex) => {
        const isSelected = opt.id === q.selectedOptionId;
        const isCorrect = opt.id === q.correctOptionId;
        const showCorrect = options.includeCorrectAnswers;
        
        let classes = 'option-item';
        if (isSelected) {
          classes += ' selected';
          if (!isCorrect && showCorrect) classes += ' wrong';
        }
        if (isCorrect && showCorrect) classes += ' correct';

        const indicators: string[] = [];
        if (isSelected && options.includeAnswers) {
          indicators.push('<span class="option-indicator your-answer">Your Answer</span>');
        }
        if (isCorrect && showCorrect) {
          indicators.push('<span class="option-indicator correct-answer">Correct</span>');
        }

        return `
          <li class="${classes}">
            <span class="option-marker">${String.fromCharCode(65 + optIndex)}</span>
            <span class="option-text">${this.escapeHtml(opt.text)}</span>
            ${indicators.join(' ')}
          </li>
        `;
      }).join('');

      const statusClass = q.status;
      const statusLabel = q.status === 'correct' ? 'Correct' : 
                         q.status === 'wrong' ? 'Wrong' : 
                         q.status === 'skipped' ? 'Skipped' : 'Unanswered';

      return `
        <div class="question-card">
          <div class="question-header">
            <span class="question-number">Question ${q.questionNumber}</span>
            <div class="question-meta">
              <span>${q.marksObtained}/${q.maxMarks} marks</span>
              ${options.includeTimeSpent ? `<span>${this.formatTime(q.timeSpentSeconds)}</span>` : ''}
              <span class="question-status ${statusClass}">${statusLabel}</span>
            </div>
          </div>
          <div class="question-body">
            <div class="question-text">${this.escapeHtml(q.questionText)}</div>
            <ul class="options-list">
              ${optionsHtml}
            </ul>
            ${options.includeExplanations && q.explanation ? `
            <div class="explanation">
              <div class="explanation-label">Explanation</div>
              <div class="explanation-text">${this.escapeHtml(q.explanation)}</div>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="questions-section">
        <h2>Question Review (${questions.length} Questions)</h2>
        ${questionsHtml}
      </div>
    `;
  }

  // @REVIEW: Open print window for PDF generation
  private openPrintWindow(html: string, data: PdfExportData): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to generate PDF report');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();

    // Wait for content to load then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
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

  // @REVIEW: Escape HTML to prevent XSS
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
