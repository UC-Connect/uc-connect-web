import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

// Server-only client for the admissions cache and quota tables. Returns null when the
// service role key is not configured, so the assistant still works without these features.
export function getSupabaseAdmin(): SupabaseClient | null {
  if (client !== undefined) {
    return client;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  client = url && serviceRoleKey ? createClient(url, serviceRoleKey, { auth: { persistSession: false } }) : null;
  return client;
}
