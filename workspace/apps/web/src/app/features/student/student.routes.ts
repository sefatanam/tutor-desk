// @REVIEW: Student routes
import { Routes } from '@angular/router';

export const studentRoutes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    title: 'Student Dashboard - Tutor Desk',
  },
  {
    path: 'subjects',
    loadComponent: () =>
      import('./subjects/subjects.component').then((m) => m.SubjectsComponent),
    title: 'My Subjects - Tutor Desk',
  },
  {
    path: 'exams',
    loadComponent: () =>
      import('./exams/exams.component').then((m) => m.ExamsComponent),
    title: 'Available Exams - Tutor Desk',
  },
  {
    path: 'exams/:id/take',
    loadComponent: () =>
      import('./exam-player/exam-player.component').then(
        (m) => m.ExamPlayerComponent
      ),
    title: 'Exam in Progress - Tutor Desk',
  },
  {
    path: 'results',
    loadComponent: () =>
      import('./results/results.component').then((m) => m.ResultsComponent),
    title: 'My Results - Tutor Desk',
  },
  // @REVIEW: Student subject assets - view assets with comments
  {
    path: 'subjects/:subjectId/assets',
    loadComponent: () =>
      import('./subject-assets/subject-assets.component').then(
        (m) => m.SubjectAssetsComponent
      ),
    title: 'Subject Materials - Tutor Desk',
  },
  // @REVIEW: Student submission review with visibility settings
  {
    path: 'results/:submissionId',
    loadComponent: () =>
      import('./submission-review/submission-review.component').then(
        (m) => m.SubmissionReviewComponent
      ),
    title: 'Submission Review - Tutor Desk',
  },
];
