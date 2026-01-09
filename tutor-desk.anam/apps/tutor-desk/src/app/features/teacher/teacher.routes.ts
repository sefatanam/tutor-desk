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
  {
    path: 'students',
    loadComponent: () =>
      import('./students/students.component').then(m => m.StudentsComponent),
    title: 'My Students - Tutor Desk',
  },
  {
    path: 'subjects',
    loadComponent: () =>
      import('./subjects/subjects.component').then(m => m.SubjectsComponent),
    title: 'My Subjects - Tutor Desk',
  },
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
];
