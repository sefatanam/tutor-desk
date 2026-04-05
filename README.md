# Tutor Desk

A full-featured education management platform for conducting assessments from creation to publication. Built for institutions and independent educators who need a complete workflow covering exam building, student management, auto-grading, and performance reporting.

## What It Does

Tutor Desk supports three distinct user roles, each with their own dashboard and capabilities:

- **Super Admin** — Platform-wide oversight: approve/suspend teachers, configure system settings, view cross-institution analytics
- **Teacher** — Manage subjects, build MCQ exams, assign them to students, auto-evaluate submissions, upload learning assets, and export PDF/CSV reports
- **Student** — Browse enrolled subjects, take assigned exams, review scored submissions with feedback, and access shared learning materials

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 21 (standalone components, signals, SSR, PWA) |
| Backend | Go 1.24 REST API |
| Database | PostgreSQL 17 (Docker) |
| UI Components | PrimeNG 21 + Tailwind CSS 4 |
| Monorepo | Nx 22 |
| Auth | Stateless JWT |
| API Docs | Swagger (auto-generated) |

## Project Structure

```
tutor-desk/
├── workspace/          # Nx monorepo root
│   ├── apps/
│   │   ├── web/        # Angular 21 frontend
│   │   └── api/        # Go REST API
│   └── ...
└── documents/          # Project requirements and specs
```

## Getting Started

**Prerequisites:** Bun, Go 1.24+, Docker & Docker Compose

```bash
# Install dependencies
bun install

# Start PostgreSQL (Docker)
docker compose up -d

# Start the Go API
bun run api:dev

# Start the Angular frontend
bun run start
```

The frontend runs at `http://localhost:4200` and the API at `http://localhost:8080`.
Swagger docs are available at `http://localhost:8080/swagger/index.html`.

## Key Commands

```bash
bun run build:prod       # Production build
bun run test:unit        # Unit tests (Vitest)
bun run test:e2e         # E2E tests (Playwright)
bun run lint:fix         # Auto-fix linting issues
bun run api:docs         # Regenerate Swagger API docs
bunx nx graph            # Interactive dependency graph
```

## API Overview

The REST API is versioned under `/api/v1` and covers:

- `auth` — Login, signup, token refresh, password management
- `teachers` / `students` — Role-specific user management
- `subjects` — Subject CRUD and student enrollment
- `exams` / `questions` — Exam lifecycle and MCQ question management
- `submissions` — Exam-taking and auto-evaluation
- `assets` / `comments` — Learning materials and threaded comments
- `admin` — Super-admin dashboard and reporting
- `settings` — System configuration

## Architecture Highlights

- **Role-based access control** enforced at both route guard (frontend) and middleware (API) levels
- **Signal-based state** via NgRx SignalStore with OnPush change detection throughout the Angular app
- **Standalone Angular components** — no NgModules
- **Connection pooling** via `pgx` for efficient PostgreSQL access
- **Containerized database** with automatic schema and seed initialization
- **SSR + PWA** for performance and offline support

## Documentation

- [`workspace/README.md`](workspace/README.md) — Detailed setup, architecture, and API reference
- [`documents/requirements.md`](documents/requirements.md) — Original feature specifications
