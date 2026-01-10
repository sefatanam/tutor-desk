// @REVIEW: Result visibility utility functions
// Determines what students can see in their exam results based on exam settings

import { Exam, ExamSubmission } from '../models';

/**
 * Determines if a student can view results for a given exam submission
 * based on the exam's result visibility settings
 */
export function canStudentViewResults(exam: Exam, submission: ExamSubmission): boolean {
  // Never show results if visibility is set to 'never'
  if (exam.resultVisibility === 'never') {
    return false;
  }

  // Submission must be completed (not in progress)
  if (submission.status === 'in_progress') {
    return false;
  }

  // Immediate visibility - show results right after submission
  if (exam.resultVisibility === 'immediate') {
    return true;
  }

  // After due date - show results only after exam's scheduled end date
  if (exam.resultVisibility === 'after_due_date') {
    if (!exam.scheduledEnd) {
      // No due date set, default to showing results
      return true;
    }
    return new Date() >= exam.scheduledEnd;
  }

  // Manual release - show results only when teacher releases them
  if (exam.resultVisibility === 'manual_release') {
    // Check if manually released by teacher
    if (exam.isResultReleased) {
      return true;
    }
    // Check if scheduled release date has passed
    if (exam.resultReleaseDate && new Date() >= exam.resultReleaseDate) {
      return true;
    }
    return false;
  }

  // Default: don't show results
  return false;
}

/**
 * Result display settings - respects exam configuration
 * This interface defines what specific elements students can see
 */
export interface ResultDisplaySettings {
  readonly canViewResults: boolean;
  readonly showScore: boolean;
  readonly showPercentage: boolean;
  readonly showPassFail: boolean;
  readonly showCorrectAnswers: boolean;
  readonly showStudentAnswers: boolean;
  readonly showExplanations: boolean;
  readonly showQuestionReview: boolean;
  readonly showTimeSpent: boolean;
  readonly showTeacherRemarks: boolean;
  readonly showRank: boolean;
}

/**
 * Gets the complete result display settings for a submission
 * Returns all settings as false if student cannot view results yet
 */
export function getResultDisplaySettings(
  exam: Exam,
  submission: ExamSubmission
): ResultDisplaySettings {
  const canView = canStudentViewResults(exam, submission);

  // If student can't view results, return all false
  if (!canView) {
    return {
      canViewResults: false,
      showScore: false,
      showPercentage: false,
      showPassFail: false,
      showCorrectAnswers: false,
      showStudentAnswers: false,
      showExplanations: false,
      showQuestionReview: false,
      showTimeSpent: false,
      showTeacherRemarks: false,
      showRank: false,
    };
  }

  // Student can view - use exam's settings
  return {
    canViewResults: true,
    showScore: exam.showScore,
    showPercentage: exam.showPercentage,
    showPassFail: exam.showPassFail,
    showCorrectAnswers: exam.showCorrectAnswers,
    showStudentAnswers: exam.showStudentAnswers,
    showExplanations: exam.showExplanations,
    showQuestionReview: exam.showQuestionReview,
    showTimeSpent: exam.showTimeSpent,
    showTeacherRemarks: exam.showTeacherRemarks,
    showRank: exam.showRank,
  };
}

/**
 * Gets a human-readable message explaining when results will be available
 * Useful for showing students why they can't see results yet
 */
export function getResultAvailabilityMessage(exam: Exam): string {
  switch (exam.resultVisibility) {
    case 'immediate':
      return 'Results are available immediately after submission.';
    
    case 'after_due_date':
      if (exam.scheduledEnd) {
        const dueDate = new Date(exam.scheduledEnd);
        const now = new Date();
        if (now >= dueDate) {
          return 'Results are now available.';
        }
        return `Results will be available after ${dueDate.toLocaleDateString()} at ${dueDate.toLocaleTimeString()}.`;
      }
      return 'Results will be available after the exam due date.';
    
    case 'manual_release':
      if (exam.isResultReleased) {
        return 'Results have been released by the teacher.';
      }
      if (exam.resultReleaseDate) {
        const releaseDate = new Date(exam.resultReleaseDate);
        const now = new Date();
        if (now >= releaseDate) {
          return 'Results are now available.';
        }
        return `Results will be available on ${releaseDate.toLocaleDateString()} at ${releaseDate.toLocaleTimeString()}.`;
      }
      return 'Results will be released by the teacher.';
    
    case 'never':
      return 'Results are not available for this exam.';
    
    default:
      return 'Results availability is unknown.';
  }
}
