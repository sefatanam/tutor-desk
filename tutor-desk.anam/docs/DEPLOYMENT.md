# Tutor Desk - Fresh Environment Setup Guide

This guide walks you through setting up Tutor Desk on a fresh Supabase project.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Supabase Project Setup](#supabase-project-setup)
3. [Database Setup](#database-setup)
4. [Edge Function Deployment](#edge-function-deployment)
5. [Frontend Configuration](#frontend-configuration)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
```bash
# Node.js (v18+)
node --version

# pnpm (recommended) or npm
pnpm --version

# Supabase CLI
npm install -g supabase
supabase --version

# Angular CLI (optional, pnpm handles it)
```

### Required Accounts
- [Supabase Account](https://supabase.com) (free tier works)
- GitHub account (for code repository)

---

## Supabase Project Setup

### Step 1: Create New Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click **"New Project"**
3. Fill in:
   - **Name**: `tutor-desk-production` (or client name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait for project to be ready (~2 minutes)

### Step 2: Get Project Credentials

After project is created, go to **Settings → API** and note down:

| Credential | Location | Example |
|------------|----------|---------|
| Project URL | Project URL | `https://abcdefgh.supabase.co` |
| Anon Key | Project API Keys → anon public | `eyJhbGciOiJIUzI1NiIs...` |
| Service Role Key | Project API Keys → service_role | `eyJhbGciOiJIUzI1NiIs...` |
| JWT Secret | JWT Settings → JWT Secret | `your-super-secret-jwt-token...` |

> ⚠️ **IMPORTANT**: Never expose Service Role Key or JWT Secret in frontend code!

### Step 3: Link Supabase CLI

```bash
# Login to Supabase
supabase login

# Navigate to project directory
cd /path/to/tutor-desk.anam

# Link to your project (replace with your project ref)
supabase link --project-ref <your-project-ref>

# Example:
# supabase link --project-ref abcdefghijklmnop
```

You can find your project ref in the URL: `https://supabase.com/dashboard/project/<project-ref>`

---

## Database Setup

### Step 4: Run Database Migrations

**Option A: Via Supabase CLI (Recommended)**
```bash
cd /path/to/tutor-desk.anam
supabase db push
```

**Option B: Via Dashboard (Manual)**
1. Go to **Supabase Dashboard → SQL Editor**
2. Run migrations in this order:
   - `supabase/migrations/20260109000001_initial_schema.sql`
   - `supabase/migrations/20260109000002_rls_policies.sql`
   - `supabase/migrations/20260110000003_auth_security_tables.sql`
   - ... (all migrations in order)
   - `supabase/migrations/20260110000015_rls_custom_jwt.sql`

### Step 5: Create Super Admin Account

Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
-- Create Super Admin user
-- Password: adminoftutordesk@app (or change to your preference)
-- The password hash below is for: adminoftutordesk@app

INSERT INTO users (
  id,
  email,
  password_hash,
  full_name,
  role,
  status,
  auth_provider
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@tutordesk.app',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4vUPXHe0TnHKvJWu', -- adminoftutordesk@app
  'Super Admin',
  'super_admin',
  'active',
  'email'
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = 'active';
```

> 💡 **To generate a new password hash**, use: https://bcrypt-generator.com/ (12 rounds)

---

## Edge Function Deployment

### Step 6: Set Edge Function Secrets

```bash
cd /path/to/tutor-desk.anam

# Set the JWT secret (copy from Supabase Dashboard → Settings → API → JWT Secret)
supabase secrets set SUPABASE_JWT_SECRET="your-jwt-secret-here"

# Verify secrets are set
supabase secrets list
```

### Step 7: Deploy Auth Edge Function

```bash
supabase functions deploy auth
```

### Step 8: Verify Edge Function

```bash
# Test the function (should return error for missing body)
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/auth \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected response: {"error":"Invalid action"}
```

---

## Frontend Configuration

### Step 9: Update Environment Files

Edit `apps/tutor-desk/src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  
  supabase: {
    url: 'https://<your-project-ref>.supabase.co',           // Your Project URL
    anonKey: '<your-anon-key>',                              // Your Anon Key
    authFunctionUrl: 'https://<your-project-ref>.supabase.co/functions/v1/auth',
  },
  
  app: {
    name: 'Tutor Desk',
    version: '1.0.0',
    description: 'A modern platform for teachers to manage students and exams',
  },
  
  superAdmin: {
    email: 'admin@tutordesk.app',
  },
  
  features: {
    googleAuth: false,  // Set to true if configuring Google OAuth
    darkMode: true,
    pwa: true,
  },
  
  api: {
    timeout: 30000,
    retryAttempts: 3,
  },
};
```

For production, also update `environment.prod.ts`:
```typescript
export const environment = {
  production: true,
  // ... same as above with production values
};
```

### Step 10: Install Dependencies & Run

```bash
cd /path/to/tutor-desk.anam

# Install dependencies
pnpm install

# Run development server
pnpm start

# App will be available at http://localhost:4300
```

---

## Verification

### Step 11: Test the Setup

1. **Open the app**: http://localhost:4300
2. **Login as Super Admin**:
   - Email: `admin@tutordesk.app`
   - Password: `adminoftutordesk@app`
3. **Verify Dashboard**:
   - Stats should show (0 teachers, 0 students initially)
   - No errors in browser console
4. **Create a Teacher**:
   - Go to a separate browser/incognito
   - Click "Sign Up"
   - Fill in teacher details
   - Should see "Pending Approval" message
5. **Approve Teacher**:
   - Back in admin dashboard
   - Refresh - new teacher should appear in "Pending Approvals"
   - Click approve
6. **Teacher Login**:
   - Teacher can now login with their credentials

---

## Quick Reference

### Supabase CLI Commands
```bash
# Link project
supabase link --project-ref <ref>

# Push database migrations
supabase db push

# Deploy edge function
supabase functions deploy auth

# Set secrets
supabase secrets set KEY=value

# View logs
supabase functions logs auth
```

### Default Credentials
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@tutordesk.app | adminoftutordesk@app |

### Environment Variables (Edge Function)
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Auto-provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase |
| `SUPABASE_JWT_SECRET` | Must be set manually (from API settings) |

---

## Troubleshooting

### Issue: "Teachers not showing in dashboard"

**Cause**: JWT secret mismatch between Edge Function and Supabase RLS

**Solution**:
1. Verify JWT secret is set: `supabase secrets list`
2. Re-deploy function: `supabase functions deploy auth`
3. Clear browser localStorage and login again

### Issue: "Login returns 401"

**Cause**: Password hash mismatch or user doesn't exist

**Solution**:
1. Check user exists in database
2. Re-run the super admin seed SQL
3. Use bcrypt generator to create new hash

### Issue: "Edge function returns 500"

**Cause**: Missing database tables or RLS blocking service role

**Solution**:
1. Check Supabase Dashboard → Logs → Edge Functions
2. Ensure all migrations ran successfully
3. Check rate_limit and other functions exist

### Issue: "CORS error"

**Cause**: Browser blocking cross-origin requests

**Solution**:
1. Edge function already has CORS headers
2. Make sure you're using the correct project URL
3. Check browser console for specific error

---

## Next Steps

After setup is complete:

1. **Configure Google OAuth** (optional):
   - Supabase Dashboard → Authentication → Providers → Google
   - Update `environment.ts` with `googleAuth: true`

2. **Set up Storage** (for file uploads):
   - Supabase Dashboard → Storage
   - Create bucket: `assets`
   - Set up RLS policies for storage

3. **Configure Email** (for notifications):
   - Supabase Dashboard → Authentication → Email Templates
   - Or integrate with external email service

4. **Deploy Frontend**:
   - Build: `pnpm build`
   - Deploy to Vercel/Netlify/your hosting

---

## Support

For issues:
1. Check browser console for errors
2. Check Supabase Dashboard → Logs
3. Review this documentation
4. Contact development team
