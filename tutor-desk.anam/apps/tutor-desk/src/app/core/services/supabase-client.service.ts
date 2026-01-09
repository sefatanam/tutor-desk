// @REVIEW: Supabase Client Service
// Singleton service for Supabase client initialization

import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseClientService {
  private readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-application-name': 'tutor-desk',
          },
        },
      }
    );
  }

  get supabase(): SupabaseClient {
    return this.client;
  }

  get auth() {
    return this.client.auth;
  }

  get storage() {
    return this.client.storage;
  }

  from(table: string) {
    return this.client.from(table);
  }

  rpc(fn: string, args?: Record<string, unknown>) {
    return this.client.rpc(fn, args);
  }
}
