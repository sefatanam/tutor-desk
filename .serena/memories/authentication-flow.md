# TutorDesk Authentication Flow (Custom Auth - NO Supabase Auth)

## Overview
TutorDesk uses a **custom authentication system** via Supabase Edge Functions. 
We do NOT use Supabase Auth - all auth is handled by our own Edge Function.

## Architecture

### Edge Function URL
`https://ynkiftmzeclkthpcaoqy.supabase.co/functions/v1/auth`

### Supported Actions
| Action | Description | Auth Required |
|--------|-------------|---------------|
| `login` | Email/password login | No |
| `signup` | Teacher registration (status=pending) | No |
| `refresh` | Rotate tokens | No (refresh token) |
| `logout` | Revoke refresh token | No |
| `reset_password` | Admin resets user password | SuperAdmin JWT |
| `create_student` | Teacher creates student | Teacher JWT |

### Security Features
- bcrypt password hashing (12 rounds)
- JWT access tokens (15 min expiry)
- Refresh tokens (7 days, rotated on use)
- Rate limiting (5 attempts per 15 min)
- Device fingerprint binding
- IP tracking

## Angular Implementation

### Core Files
- `core/services/auth.service.ts` - HTTP calls to Edge Function
- `core/store/auth.store.ts` - Signal-based state management
- `core/guards/auth.guard.ts` - Requires authentication
- `core/guards/role.guard.ts` - Requires specific role
- `core/guards/guest.guard.ts` - Blocks authenticated users

### Auth Store Signals
```typescript
readonly user: Signal<AuthUser | null>
readonly isAuthenticated: Signal<boolean>
readonly isLoading: Signal<boolean>
readonly error: Signal<string | null>
readonly userRole: Signal<UserRole | null>
readonly isPendingApproval: Signal<boolean>
readonly canAccess: Signal<boolean>
```

### Storage Keys (localStorage)
- `td_access_token` - JWT access token
- `td_refresh_token` - Refresh token
- `td_token_expires_at` - Token expiry timestamp
- `td_user` - User data JSON

## User Roles
1. **SuperAdmin** (`super_admin`) - Platform administrator
2. **Teacher** (`teacher`) - Creates and manages students, subjects, exams
3. **Student** (`student`) - Takes exams, views results

## Authentication Flows

### Teacher Registration
1. Teacher registers via `/auth/register`
2. Edge Function creates user in `public.users` with `status = 'pending'`
3. Edge Function creates teacher record in `public.teachers`
4. Teacher sees success message, redirected to login
5. Teacher waits for SuperAdmin approval
6. After approval, teacher can login normally

### Teacher Login
1. Teacher signs in via `/auth/login`
2. Edge Function returns JWT + refresh token + user data
3. Auth store saves tokens to localStorage
4. If `status = 'pending'` → redirected to `/auth/pending`
5. If `status = 'active'` → redirected to `/teacher/dashboard`

### Student Creation (by Teacher)
1. Teacher calls `authStore.createStudent(data)`
2. Auth service calls Edge Function with teacher JWT
3. Edge Function creates user with `status = 'active'`
4. Edge Function creates student record linked to teacher
5. Student can login immediately

### Student Login
1. Student signs in via `/auth/login`
2. Gets JWT + refresh token
3. Redirected to `/student/dashboard`

### SuperAdmin Login
1. Admin signs in via `/auth/login`
2. Gets JWT + refresh token
3. Redirected to `/admin/dashboard`

### Token Refresh
- Auth store checks token expiry every 5 minutes
- If token expires within 60 seconds, auto-refresh triggered
- Refresh token is rotated on each use

## Guards

### `authGuard`
- Waits for auth initialization (max 5 seconds)
- Requires authentication
- Checks `canAccess()` (not disabled/suspended, approved if teacher)
- Pending teachers → `/auth/pending`
- Disabled/suspended → logout + `/auth/login`

### `roleGuard(roles[])`
- Waits for auth initialization
- Requires authentication
- Requires specific role(s)
- Redirects to correct dashboard if wrong role

### `guestGuard`
- Waits for auth initialization
- Blocks authenticated users
- Redirects to dashboard if logged in

## Database Tables

### Auth-Related Tables (public schema)
- `users` - User accounts with `password_hash`
- `refresh_tokens` - Active refresh tokens
- `login_attempts` - DDOS protection
- `rate_limits` - Rate limiting rules
- `password_reset_tokens` - Password reset tracking

## Credentials (Development)
- **SuperAdmin**: admin@tutordesk.app / adminoftutordesk@app
  (Must be seeded in database via `supabase/seed/001_seed_data.sql`)