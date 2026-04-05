#!/usr/bin/env node
// @REVIEW: Database Seed Script
// Seeds the Supabase database with initial data (SuperAdmin)
// Usage: node scripts/seed-database.mjs
// Requires: SUPABASE_SERVICE_ROLE_KEY environment variable

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SUPABASE_URL = 'https://ynkiftmzeclkthpcaoqy.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('');
  console.error('Get it from: https://supabase.com/dashboard/project/ynkiftmzeclkthpcaoqy/settings/api');
  console.error('Then run: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/seed-database.mjs');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// SuperAdmin data
const SUPER_ADMIN = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@tutordesk.app',
  password_hash: '$2a$12$iMRW0KLdghFnKHEIf65hHOHrflR4K2gkzcs2iRgBct5ZE7REsqlsC', // adminoftutordesk@app
  full_name: 'Super Administrator',
  role: 'super_admin',
  status: 'active',
  auth_provider: 'email',
};

async function seedDatabase() {
  console.log('Seeding database...\n');

  // Check if SuperAdmin already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', SUPER_ADMIN.email)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116 = no rows returned (expected if user doesn't exist)
    console.error('Error checking for existing user:', checkError.message);
    process.exit(1);
  }

  if (existingUser) {
    console.log(`SuperAdmin already exists: ${existingUser.email}`);
    console.log('Skipping seed.\n');
    return;
  }

  // Insert SuperAdmin
  const { data, error } = await supabase
    .from('users')
    .insert(SUPER_ADMIN)
    .select()
    .single();

  if (error) {
    console.error('Error creating SuperAdmin:', error.message);
    process.exit(1);
  }

  console.log('SuperAdmin created successfully!');
  console.log('');
  console.log('Credentials:');
  console.log(`  Email:    ${SUPER_ADMIN.email}`);
  console.log(`  Password: adminoftutordesk@app`);
  console.log('');
}

// Run
seedDatabase()
  .then(() => {
    console.log('Seed completed!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
