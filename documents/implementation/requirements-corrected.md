# Tutor Desk - Requirements Specification

A modern web platform for teachers to manage students, subjects, exams, and learning materials.

---

## Main Features

### Landing Page
- Modern SaaS-style landing page
- Sections: About, Contacts, Features, Simplicity focus
- Motto display
- Developer information
- Subtle animations for premium feel
- Clean, minimal design

---

## User Roles

### 1. SuperAdmin

**Authentication:**
- Logs in via hardcoded credentials (environment-based)

**Capabilities:**
- Create, read, update, and delete teacher accounts (CRUD)
- Manage all aspects of the application (CRUD)
- Access all teachers' workspace data (CRUD)
- Disable teachers to prevent application access

---

### 2. Teacher

**Authentication:**
- Joins via Google Authentication (Supabase Auth)
- Requires SuperAdmin approval before accessing features

**Capabilities:**
- Create student profiles (CRUD)
- Create subjects (CRUD)
- Create exams for subjects (CRUD)
- Create MCQ questions for exams (CRUD)
- Assign students to subjects (CRUD)
- View student-wise submitted exams
- Evaluate all submitted exams
- Schedule re-exams for students
- Disable student access
- Post assets to subjects with upcoming exam dates displayed
- View reports with statistics for every exam and student

**Exam Configuration Rules:**
| Rule | Description |
|------|-------------|
| Time per question | 1 minute per MCQ |
| Auto-skip | Automatically moves to next question after 1 minute |
| Skip-and-revisit | Configurable: skipped questions reappear with remaining time |
| Example | Question skipped after 12s reappears with 48s remaining |
| Window leave (Web) | Leaving browser window immediately submits exam |
| App leave (Mobile) | Leaving app immediately submits exam |
| Mouse tracking | Mouse leaving window triggers submission |
| Fullscreen mode | Exams run in fullscreen (web and mobile) |
| Retake policy | Once submitted, students cannot retake the exam |

---

### 3. Student

**Authentication:**
- Logs in via teacher-created credentials

**Capabilities:**
- View assigned subjects and content
- Participate in exams
- View submitted exams and results
- Comment on teacher's asset postings
- Automated exam results upon submission

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Angular 21 SSR | Frontend framework with server-side rendering |
| Supabase Auth | Authentication (Google for teachers, manual for students) |
| Supabase Database | PostgreSQL database with real-time subscriptions |
| Supabase Edge Functions | Backend logic (future) |
| Supabase Storage | Asset storage |
| PrimeNG | UI component library (Aura theme, Green color) |
| Tailwind CSS | Utility-first styling |

---

## Design Requirements

- **Theme:** PrimeNG Aura with Green primary color
- **Approach:** Mobile-first, PWA-focused
- **Feel:** Premium, clean, scalable
- **Layout:** Sidebar visible only after login

---

## Non-Functional Requirements

1. **Performance:** Fast load times, lazy loading for routes
2. **Scalability:** Modular architecture for easy feature additions
3. **Security:** Proper Supabase RLS policies, role-based access
4. **Accessibility:** WCAG compliance where possible
5. **PWA:** Offline capabilities for basic features
