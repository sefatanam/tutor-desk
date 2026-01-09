# Tutor Desk - Master Implementation Plan

## Overview
5-release roadmap to build a complete educational platform for teachers and students.

---

## Release Summary

| Release | Focus | Status |
|---------|-------|--------|
| Release 1 | Skeleton & Foundation | Current |
| Release 2 | Authentication & Users | Pending |
| Release 3 | Teacher Dashboard | Pending |
| Release 4 | Exam System & Student Portal | Pending |
| Release 5 | SuperAdmin & Polish | Pending |

---

## Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Landing Style | SaaS-style | Client preference, modern feel |
| SuperAdmin Auth | Hardcoded credentials | Simple for MVP |
| Sidebar Visibility | After login only | Clean landing experience |
| State Management | Angular Signals | Modern, native, lightweight |
| Component Style | Standalone | Angular 21 best practice |
| Theme | PrimeNG Aura Green | Premium feel, client preference |

---

## Release 1: Skeleton & Foundation
**Goal:** Establish architecture and create app skeleton

- Configure PrimeNG Aura Green theme
- Create folder structure (core, shared, layout, features)
- Setup lazy-loaded routing
- Build layout components (header, sidebar, footer, shell)
- Create SaaS-style landing page
- Setup Supabase service wrappers (skeletons)
- Create auth guard placeholders

**Deliverable:** Working app with landing page and navigation structure

---

## Release 2: Authentication & User Management
**Goal:** Complete authentication flow for all user types

- Google Authentication for Teachers
- Manual login for Students (teacher-created credentials)
- SuperAdmin login with hardcoded credentials
- Role-based routing guards implementation
- Signal-based user state management
- Teacher approval workflow (pending -> active)
- User profile management
- Logout functionality

**Deliverable:** Working login/logout for all 3 user types

---

## Release 3: Teacher Dashboard & Core Features
**Goal:** Build teacher workspace with CRUD operations

- Teacher dashboard layout
- Student management (CRUD)
  - Create student with credentials
  - List/search students
  - Edit student details
  - Enable/disable student access
- Subject management (CRUD)
  - Create subject with details
  - Assign students to subjects
  - Post assets to subjects
- Exam management (CRUD)
  - Create exam for subject
  - Set exam configuration (time, skip rules)
  - Schedule exam dates
- Question bank (CRUD)
  - Create MCQ questions
  - Organize by subject/exam
  - Preview questions

**Deliverable:** Fully functional teacher workspace

---

## Release 4: Exam System & Student Portal
**Goal:** Build exam taking experience and student dashboard

### Exam System (Critical)
- Fullscreen exam mode
- Timer with 1-minute per question
- Auto-skip functionality
- Skip-and-revisit with remaining time tracking
- Window/tab visibility detection
- Auto-submit on leave (web + mobile)
- Mouse tracking for window leave
- Exam submission flow
- Prevent retake after submission

### Student Portal
- Student dashboard
- View assigned subjects
- View subject content/assets
- Participate in exams
- View results after submission
- Comment on teacher posts

**Deliverable:** Complete exam system with anti-cheat features

---

## Release 5: SuperAdmin & Polish
**Goal:** Admin controls and final polish

### SuperAdmin Features
- Admin dashboard
- Teacher management (CRUD)
- Approve/reject teacher registrations
- View all teacher workspaces
- Disable teacher accounts
- System-wide statistics

### Analytics & Reports
- Exam statistics per student
- Subject-wise performance reports
- Teacher activity reports
- Visual charts and graphs

### Polish
- PWA optimization
- Performance tuning
- Bug fixes
- UI/UX refinements
- Mobile experience improvements

**Deliverable:** Production-ready application

---

## Tech Architecture

### Frontend Structure
```
src/app/
├── core/           # Singleton services, guards, models
├── shared/         # Reusable components, pipes, directives
├── layout/         # Shell, header, sidebar, footer
└── features/       # Lazy-loaded feature modules
    ├── landing/
    ├── auth/
    ├── super-admin/
    ├── teacher/
    └── student/
```

### Supabase Database Structure
```sql
-- users table
users (
  id UUID PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  role TEXT,  -- 'super_admin', 'teacher', 'student'
  status TEXT,  -- 'pending', 'active', 'disabled'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- teachers table
teachers (
  id UUID PRIMARY KEY REFERENCES users(id),
  is_approved BOOLEAN,
  approved_at TIMESTAMPTZ,
  approved_by UUID
)

-- students table
students (
  id UUID PRIMARY KEY REFERENCES users(id),
  teacher_id UUID REFERENCES teachers(id),
  assigned_subjects UUID[]
)

-- subjects table
subjects (
  id UUID PRIMARY KEY,
  teacher_id UUID REFERENCES teachers(id),
  name TEXT,
  description TEXT
)

-- exams table
exams (
  id UUID PRIMARY KEY,
  subject_id UUID REFERENCES subjects(id),
  config JSONB,
  scheduled_date TIMESTAMPTZ
)

-- submissions table
submissions (
  id UUID PRIMARY KEY,
  exam_id UUID REFERENCES exams(id),
  student_id UUID REFERENCES students(id),
  answers JSONB,
  score INTEGER,
  submitted_at TIMESTAMPTZ
)
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Exam anti-cheat bypass | Multiple detection methods, server-side validation |
| Supabase costs | Optimize queries, use RLS policies |
| SSR complexity | Careful handling of browser APIs |
| PrimeNG learning curve | Follow official docs, use MCP tools |

---

## Quality Assurance

- Follow Angular style guide
- Use TypeScript strict mode
- Implement proper error handling
- Signal-based reactive state
- Component-level testing (future)
- E2E testing for critical flows (future)
