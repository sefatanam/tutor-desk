// @REVIEW: Supabase Client Service
// Singleton service for Supabase client initialization
// Updated to use authenticated access token for RLS

import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// @REVIEW: Storage key must match AuthService
const ACCESS_TOKEN_KEY = 'td_access_token';

@Injectable({
  providedIn: 'root',
})
export class SupabaseClientService {
  private client: SupabaseClient;

  constructor() {
    this.client = this.createSupabaseClient();
  }

  // @REVIEW: Create client with current auth token in global headers
  private createSupabaseClient(): SupabaseClient {
    const token = this.getAccessToken();
    
    return createClient(
      environment.supabase.url,
      environment.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: false, // We handle refresh ourselves
          persistSession: false,   // We manage session in AuthService
          detectSessionInUrl: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-application-name': 'tutor-desk',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      }
    );
  }

  // @REVIEW: Get access token from localStorage (set by AuthService)
  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  // @REVIEW: Refresh client to pick up new auth token after login
  refreshClient(): void {
    this.client = this.createSupabaseClient();
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
    // @REVIEW: Recreate client if token changed (ensures fresh headers)
    const currentToken = this.getAccessToken();
    const needsRefresh = this.shouldRefreshClient(currentToken);
    
    if (needsRefresh) {
      this.refreshClient();
    }
    
    return this.client.from(table);
  }

  rpc(fn: string, args?: Record<string, unknown>) {
    const currentToken = this.getAccessToken();
    const needsRefresh = this.shouldRefreshClient(currentToken);
    
    if (needsRefresh) {
      this.refreshClient();
    }
    
    return this.client.rpc(fn, args);
  }

  // @REVIEW: Track last token to detect changes
  private lastToken: string | null = null;
  
  private shouldRefreshClient(currentToken: string | null): boolean {
    if (this.lastToken !== currentToken) {
      this.lastToken = currentToken;
      return true;
    }
    return false;
  }
}
