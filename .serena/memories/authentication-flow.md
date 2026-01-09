# TutorDesk Authentication Flow

## Overview
TutorDesk uses Supabase for all user authentication with role-based access control (RBAC).

## User Roles
1. **SuperAdmin** (`super_admin`) - Platform administrator
2. **Teacher** (`teacher`) - Creates and manages students, subjects, exams
3. **Student** (`student`) - Takes exams, views results

## Authentication Flows

### Teacher Registration
1. Teacher signs up via `/auth/register`
2. Supabase creates auth user with `user_metadata` (display_name, role)
3. Email confirmation required (redirects to `/auth/callback`)
4. On confirmation, `auth.store.ts` creates profile in `public.users` and `public.teachers`
5. Teacher status = `pending`, is_approved = `false`
6. Teacher redirected to `/auth/pending` until approved by SuperAdmin

### Teacher Login
1. Teacher signs in via `/auth/login` (Teacher tab)
2. Auth store verifies role = `teacher`
3. If not approved → `/auth/pending`
4. If approved → `/teacher`

### Student Creation (by Teacher)
1. Teacher calls `userService.createStudent()`
2. Edge Function `create-student` is invoked with teacher's JWT
3. Edge Function uses `service_role` to:
   - Create auth user with auto-confirmed email
   - Create `public.users` profile (role = `student`, status = `active`)
   - Create `public.students` record (linked to teacher)
4. Student can login immediately with provided credentials

### Student Login
1. Student signs in via `/auth/login` (Student tab)
2. Auth store fetches profile and navigates to `/student`

### SuperAdmin Login
1. Admin signs in via `/auth/login` (Admin tab)
2. Uses Supabase authentication (not hardcoded)
3. Auth store verifies role = `super_admin`
4. Navigates to `/admin`

## Edge Functions

### `create-student`
- **Purpose**: Create student without session swap or email confirmation
- **Auth**: Requires teacher JWT
- **Uses**: `service_role` key

### `admin-operations`
- **Purpose**: Admin-only operations (approve teacher, disable/enable users)
- **Auth**: Requires super_admin JWT
- **Operations**: `list-users`, `list-teachers`, `list-students`, `approve-teacher`, `disable-user`, `enable-user`

### `setup-admin`
- **Purpose**: One-time SuperAdmin creation
- **Auth**: Setup secret (not JWT)
- **Note**: Should be disabled after initial setup

## Guards

### `authGuard`
- Waits for auth initialization (max 5 seconds)
- Requires authentication
- Checks `canAccess()` (not disabled, approved if teacher)

### `roleGuard(roles[])`
- Waits for auth initialization
- Requires specific role(s)
- Redirects to role-appropriate dashboard if wrong role

### `guestGuard`
- Prevents authenticated users from accessing auth pages
- Redirects to role-appropriate dashboard

## RLS Policies
- Teachers can CRUD their own students
- Teachers can update their students' user status
- SuperAdmin uses Edge Functions (service_role) for all operations
- All authenticated users can read users/teachers (for admin views)

## Credentials
- **SuperAdmin**: admin@tutordesk.app / TutorDesk@Admin2024
