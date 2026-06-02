// Database factory — detects mode from env vars and returns the right adapter
// Priority: if DATABASE_URL exists → PostgreSQL mode, else Supabase mode

import type { DBAdapter } from "./adapter";
import { SupabaseAdapter } from "./supabase-adapter";
import { PostgresAdapter } from "./postgres-adapter";

let cachedAdapter: DBAdapter | null = null;

export function getDB(): DBAdapter {
  if (cachedAdapter) return cachedAdapter;

  const pgUrl = process.env.DATABASE_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (pgUrl) {
    console.log("[DB] Using PostgreSQL adapter");
    cachedAdapter = new PostgresAdapter();
  } else if (supabaseUrl) {
    console.log("[DB] Using Supabase adapter");
    cachedAdapter = new SupabaseAdapter();
  } else {
    console.warn("[DB] No DATABASE_URL or NEXT_PUBLIC_SUPABASE_URL found, defaulting to Supabase adapter");
    cachedAdapter = new SupabaseAdapter();
  }

  return cachedAdapter;
}

export function getDBMode(): "postgresql" | "supabase" {
  if (process.env.DATABASE_URL) return "postgresql";
  return "supabase";
}

export function resetDBCache() {
  cachedAdapter = null;
}
