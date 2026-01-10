// @REVIEW: Teacher routes
import { Routes } from '@angular/router';

export const teacherRoutes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Teacher Dashboard - Tutor Desk',
  },
  // @REVIEW: Student routes - specific routes MUST come before parameterized routes
  {
    path: 'students',
    loadComponent: () =>
      import('./students/students.component').then(m => m.StudentsComponent),
    title: 'My Students - Tutor Desk',
  },
  {
    path: 'students/create',
    loadComponent: () =>
      import('./student-form/student-form.component').then(m => m.StudentFormComponent),
    title: 'Add Student - Tutor Desk',
  },
  {
    path: 'students/:id/edit',
    loadComponent: () =>
      import('./student-form/student-form.component').then(m => m.StudentFormComponent),
    title: 'Edit Student - Tutor Desk',
  },
  {
    path: 'students/:id',
    loadComponent: () =>
      import('./student-detail/student-detail.component').then(m => m.StudentDetailComponent),
    title: 'Student Details - Tutor Desk',
  },
  // @REVIEW: Subject routes - specific routes MUST come before parameterized routes
  {
    path: 'subjects',
    loadComponent: () =>
      import('./subjects/subjects.component').then(m => m.SubjectsComponent),
    title: 'My Subjects - Tutor Desk',
  },
  {
    path: 'subjects/create',
    loadComponent: () =>
      import('./subject-form/subject-form.component').then(m => m.SubjectFormComponent),
    title: 'Add Subject - Tutor Desk',
  },
  {
    path: 'subjects/:id/edit',
    loadComponent: () =>
      import('./subject-form/subject-form.component').then(m => m.SubjectFormComponent),
    title: 'Edit Subject - Tutor Desk',
  },
  // @REVIEW: Subject report route - comprehensive report for a subject (must be before :id)
  {
    path: 'subjects/:id/report',
    loadComponent: () =>
      import('./subject-report/subject-report.component').then(m => m.SubjectReportComponent),
    title: 'Subject Report - Tutor Desk',
  },
  {
    path: 'subjects/:id',
    loadComponent: () =>
      import('./subject-detail/subject-detail.component').then(m => m.SubjectDetailComponent),
    title: 'Subject Details - Tutor Desk',
  },
  // @REVIEW: Exam routes - specific routes MUST come before parameterized routes
  {
    path: 'exams',
    loadComponent: () =>
      import('./exams/exams.component').then(m => m.ExamsComponent),
    title: 'My Exams - Tutor Desk',
  },
  {
    path: 'exams/create',
    loadComponent: () =>
      import('./exam-editor/exam-editor.component').then(m => m.ExamEditorComponent),
    title: 'Create Exam - Tutor Desk',
  },
  {
    path: 'exams/:id/edit',
    loadComponent: () =>
      import('./exam-editor/exam-editor.component').then(m => m.ExamEditorComponent),
    title: 'Edit Exam - Tutor Desk',
  },
  {
    path: 'exams/:id/results',
    loadComponent: () =>
      import('./exam-results/exam-results.component').then(m => m.ExamResultsComponent),
    title: 'Exam Results - Tutor Desk',
  },
  // @REVIEW: Submission detail route - view individual student's exam answers
  {
    path: 'submissions/:submissionId',
    loadComponent: () =>
      import('./submission-detail/submission-detail.component').then(m => m.SubmissionDetailComponent),
    title: 'Submission Details - Tutor Desk',
  },
];
