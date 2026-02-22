# Setup RLS Security for Tutor Desk

This guide sets up Row Level Security (RLS) with your custom JWT authentication.

## Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Logged into Supabase (`supabase login`)
- Project linked (`supabase link --project-ref ynkiftmzeclkthpcaoqy`)

## Step 1: Get Supabase JWT Secret

1. Go to **Supabase Dashboard** → **Settings** → **API**
2. Under "JWT Settings", copy the **JWT Secret**
3. Save it somewhere safe (you'll need it in Step 2)

## Step 2: Set Edge Function Secret

Run this command (replace `YOUR_JWT_SECRET_HERE` with the actual secret):

```bash
cd /Users/sefat/Documents/Github/tutor-desk/workspace

supabase secrets set SUPABASE_JWT_SECRET=YOUR_JWT_SECRET_HERE
```

## Step 3: Deploy Edge Function

```bash
supabase functions deploy auth
```

## Step 4: Apply RLS Migration

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy the contents of `supabase/migrations/20260110000015_rls_custom_jwt.sql`
3. Paste and run

**Option B: Via CLI**
```bash
supabase db push
```

## Step 5: Test It

1. Log out from the app
2. Log back in as super admin: `admin@tutordesk.app` / `adminoftutordesk@app`
3. Navigate to Dashboard - teachers should now appear
4. Navigate to Teachers page - should see all teachers

## Troubleshooting

### Teachers still not showing?

1. **Check browser console** for errors
2. **Check Network tab** - look at the response from Supabase
3. **Verify JWT secret is set**:
   ```bash
   supabase secrets list
   ```
   Should show `SUPABASE_JWT_SECRET`

### "JWT expired" errors?

Your access token might have expired. Log out and log back in.

### RLS policies not working?

Run this in SQL Editor to check if policies exist:
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Security Notes

- The JWT secret is shared between Supabase and your Edge Function
- This allows Supabase to verify tokens signed by your Edge Function
- Never expose the JWT secret in client-side code
- RLS policies ensure users can only access their own data
