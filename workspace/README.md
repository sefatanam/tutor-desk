# Tutor Desk

An enterprise-grade exam management platform for educators and students — built as an Nx monorepo with an Angular 21 frontend and a Go REST API backend.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Development Workflow](#development-workflow)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Docker](#docker)
- [Useful Commands](#useful-commands)

---

## Overview

Tutor Desk is a multi-tenant education platform that enables institutions to manage the full lifecycle of academic assessments — from subject creation and exam authoring to student submissions, auto-grading, and performance reporting.

**Core capabilities:**

- Role-based access control (Super Admin / Teacher / Student)
- Subject and enrollment management
- MCQ exam builder with assignment workflows
- Exam-taking, auto-evaluation, and result publication
- Learning asset management with threaded comments
- PDF and CSV report exports
- Swagger-documented REST API with JWT authentication

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Nx Monorepo                │
│                                         │
│  ┌──────────────┐   ┌────────────────┐  │
│  │  apps/web    │   │   apps/api     │  │
│  │  Angular 21  │──▶│   Go 1.24      │  │
│  │  SSR + PWA   │   │   REST API     │  │
│  └──────────────┘   └───────┬────────┘  │
│                             │           │
│                    ┌────────▼────────┐  │
│                    │  PostgreSQL 17  │  │
│                    │    (Docker)     │  │
│                    └─────────────────┘  │
└─────────────────────────────────────────┘
```

The Angular frontend communicates with the Go API over HTTP (proxied in development). Authentication uses stateless JWTs signed by the Go API. The database runs in Docker with schema and seed SQL applied on first start.

---

## Tech Stack

### Frontend (`apps/web`)

| Layer | Technology |
|---|---|
| Framework | Angular 21 (standalone components, signals) |
| Rendering | Angular SSR (Server-Side Rendering) |
| PWA | Angular Service Worker |
| UI Library | PrimeNG 21 + PrimeIcons |
| Styling | Tailwind CSS 4 |
| Charts | Chart.js 4 |
| State | NgRx SignalStore |
| HTTP | Angular `HttpClient` with JWT interceptor |
| Testing | Vitest (unit), Playwright (e2e) |

### Backend (`apps/api`)

| Layer | Technology |
|---|---|
| Language | Go 1.24 |
| HTTP | `net/http` (stdlib) |
| Database | PostgreSQL 17 via `pgx/v5` (connection pool) |
| Auth | JWT (`golang-jwt/jwt/v5`) |
| API Docs | Swagger (`swaggo/swag`) |
| Containerisation | Docker + Docker Compose |

### Tooling

| Tool | Purpose |
|---|---|
| Nx 22 | Monorepo build system, task orchestration, caching |
| `@naxodev/gonx` | Nx plugin for Go targets (build, serve, test, lint) |
| ESLint | TypeScript/Angular linting |
| Prettier | Code formatting |

---

## Project Structure

```
workspace/
├── apps/
│   ├── web/                        # Angular 21 frontend
│   │   └── src/app/
│   │       ├── core/               # Guards, interceptors, services, store
│   │       ├── features/
│   │       │   ├── auth/           # Login, register, forgot-password
│   │       │   ├── super-admin/    # Admin dashboard, teacher management
│   │       │   ├── teacher/        # Subjects, exams, students, results
│   │       │   └── student/        # Enrolled subjects, exams, results
│   │       └── layout/             # Shell, header, sidebar, footer
│   └── api/                        # Go REST API
│       ├── main.go
│       ├── internal/
│       │   ├── config/             # Environment-based configuration
│       │   ├── database/           # pgx connection pool
│       │   ├── handlers/           # HTTP handlers per domain
│       │   ├── middleware/         # JWT auth, CORS, logging
│       │   └── router/             # Route registration
│       ├── docs/                   # Auto-generated Swagger docs
│       ├── schema.sql              # Database schema
│       ├── seed.sql                # Initial seed data
│       ├── Dockerfile
│       └── docker-compose.yml
├── nx.json                         # Nx configuration
├── package.json
└── tsconfig.base.json
```

---

## User Roles

| Role | Description |
|---|---|
| **Super Admin** | Manages the platform — approves teachers, configures system settings, views cross-institutional reports |
| **Teacher** | Creates subjects, authors exams, manages enrolled students, publishes results, uploads learning assets |
| **Student** | Enrolls in subjects, takes assigned exams, reviews results and feedback, downloads assets |

Access is enforced via route guards on the frontend (`superAdminGuard`, `teacherGuard`, `studentGuard`) and JWT-based middleware on the API.

---

## Features

### Authentication
- Login / Register / Forgot Password
- Pending approval state for new teacher accounts
- Stateless JWT authentication (no third-party auth provider)

### Super Admin
- Dashboard with platform-wide metrics
- Teacher management (approve, suspend, view workspace)
- System settings (categories and key-value configuration)

### Teacher
- Subject CRUD and student enrollment
- Exam builder (MCQ questions, assignment to students/groups)
- Exam results management (auto-evaluation, result publication control)
- Submission detail review with inline comments
- Learning asset uploads per subject
- PDF/CSV report export for subject performance

### Student
- Enrolled subject browser
- Exam-taking interface (start → answer → submit)
- Submission review with score and feedback
- Subject learning asset browser with comments

---

## Getting Started

### Prerequisites

- Bun
- Go 1.24+
- Docker and Docker Compose

### 1. Clone and install

```bash
git clone <repo-url>
cd tutor-desk/workspace
bun install
```

### 2. Start the database

```bash
cd apps/api
docker compose up -d postgres
```

This starts PostgreSQL 17, runs `schema.sql` and `seed.sql` on first boot, and exposes pgAdmin at `http://localhost:5050`.

### 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env to set your JWT_SECRET and other values
```

### 4. Start the API

```bash
bun run api:dev
# or using Nx directly:
bunx nx serve api
```

API runs at `http://localhost:8080`. Swagger UI: `http://localhost:8080/swagger/`

### 5. Start the frontend

```bash
bun run start
# or:
bunx nx serve web
```

Frontend runs at `http://localhost:4200`.

---

## Environment Variables

All API configuration is via environment variables (see `apps/api/.env.example`):

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/tutordesk?sslmode=disable` | PostgreSQL connection string |
| `JWT_SECRET` | *(change in production)* | Secret used to sign and verify JWTs |
| `PORT` | `8080` | API server port |
| `ENV` | `development` | Runtime environment (`development` / `production`) |
| `CORS_ORIGINS` | `http://localhost:4200` | Comma-separated list of allowed CORS origins |
| `UPLOAD_DIR` | `../../uploads` | Directory for uploaded learning assets |

> **Security:** Never commit `.env`. Always rotate `JWT_SECRET` before deploying to production.

---

## Development Workflow

### Serve both apps simultaneously

```bash
# Terminal 1 — API
bun run api:dev

# Terminal 2 — Frontend
bun run start
```

The Angular dev server proxies `/api` requests to `http://localhost:8080` via `proxy.conf.js`.

### Regenerate Swagger docs (after changing API annotations)

```bash
bun run api:docs
```

### Lint

```bash
bun run lint:check        # Check only
bun run lint:fix          # Auto-fix
```

### Visualise the project graph

```bash
bunx nx graph
```

---

## API Documentation

The API is fully documented with Swagger annotations.

| Endpoint group | Description |
|---|---|
| `/api/v1/auth` | Login, signup, token refresh, password management |
| `/api/v1/users` | User profile operations |
| `/api/v1/teachers` | Teacher management (super_admin) and self-service |
| `/api/v1/students` | Student management by teachers |
| `/api/v1/subjects` | Subject CRUD and enrollment |
| `/api/v1/exams` | Exam lifecycle and assignment |
| `/api/v1/questions` | MCQ question management within exams |
| `/api/v1/submissions` | Exam-taking — start, answer, submit, evaluate |
| `/api/v1/assets` | Subject learning material uploads |
| `/api/v1/comments` | Comments on subject assets |
| `/api/v1/admin` | Super-admin dashboard and reporting |
| `/api/v1/settings` | System settings categories and key-value config |

All protected endpoints require `Authorization: Bearer <token>`.

Swagger UI (development): `http://localhost:8080/swagger/`

---

## Testing

### Unit tests (Vitest)

```bash
bun run test:unit
# or:
bunx nx test web
```

### E2E tests (Playwright)

```bash
bun run test:e2e
# or:
bunx nx e2e web-e2e
```

### Go API tests

```bash
bunx nx test api
```

### Run all tests in parallel

```bash
bunx nx run-many -t test --parallel=3
```

---

## Docker

### Infrastructure only (Postgres + pgAdmin)

```bash
cd apps/api
docker compose up -d
```

| Service | URL |
|---|---|
| PostgreSQL | `localhost:5432` |
| pgAdmin | `http://localhost:5050` (admin@tutordesk.app / admin) |

### Full stack (includes the Go API container)

```bash
docker compose --profile full up -d
```

### Tear down

```bash
bun run api:down
```

### View logs

```bash
bun run api:logs
```

---

## Useful Commands

```bash
# Development
bun run start                       # Serve Angular frontend
bun run api:dev                     # Serve Go API (dev)
bunx nx serve web                   # Nx: serve frontend
bunx nx serve api                   # Nx: serve API

# Build
bunx nx build web                   # Build Angular app (dev)
bun run build:prod                  # Build Angular app (production)
bunx nx build api                   # Build Go binary

# Test & lint
bun run test:unit                   # Unit tests
bun run test:e2e                    # E2E tests
bun run lint:check                  # Lint check
bun run lint:fix                    # Auto-fix lint

# Nx utilities
bunx nx graph                       # Interactive project dependency graph
bunx nx affected -t build           # Build only affected projects
bunx nx affected -t test            # Test only affected projects
bunx nx run-many -t lint test build # Run multiple targets across all projects
bunx nx show project web --web      # View project details in browser

# API docs
bun run api:docs                    # Regenerate Swagger docs from Go annotations

# Docker
bun run api:dev                     # Start DB + API (dev mode)
bun run api:down                    # Stop all containers
bun run api:logs                    # Stream container logs
```

---

## License

MIT
