/**
 * SupabaseClientService — DEPRECATED / STUB
 * Supabase has been replaced by the Go REST API backend.
 * This stub satisfies TypeScript compilation for the legacy
 * supabase-database.adapter.ts which is still in the codebase
 * but no longer active (SupabaseDatabaseAdapter now extends GoApiDatabaseAdapter).
 */

import { Injectable } from '@angular/core';

// Minimal stub that satisfies the Supabase query-builder call chain
// so the old adapter code compiles without errors.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyChain = any;

@Injectable({ providedIn: 'root' })
export class SupabaseClientService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly supabase: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly auth: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly storage: any = null;

  from(_table: string): AnyChain {
    throw new Error('SupabaseClientService is deprecated. Use GoApiDatabaseAdapter.');
  }

  rpc(_fn: string, _args?: Record<string, unknown>): AnyChain {
    throw new Error('SupabaseClientService is deprecated. Use GoApiDatabaseAdapter.');
  }

  refreshClient(): void { /* no-op */ }
}
