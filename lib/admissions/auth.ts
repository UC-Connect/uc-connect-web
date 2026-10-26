import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type RequestUser = { id: string; email: string | null };
export type AuthResult = { ok: true; user: RequestUser | null } | { ok: false };

let client: SupabaseClient | null | undefined;

function authClient(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    client = url && anonKey ? createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  }

  return client;
}

// Login is required unless ADMISSIONS_REQUIRE_LOGIN=false (local development and tests).
export function loginRequired(): boolean {
  return process.env.ADMISSIONS_REQUIRE_LOGIN !== "false";
}

// Verifies the Supabase access token sent as `Authorization: Bearer <token>`. The browser keeps
// the session, so there are no cookies to forge across sites.
export async function authenticate(request: Request): Promise<AuthResult> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return loginRequired() ? { ok: false } : { ok: true, user: null };
  }

  const supabase = authClient();

  if (!supabase) {
    return loginRequired() ? { ok: false } : { ok: true, user: null };
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { ok: false };
  }

  return { ok: true, user: { id: data.user.id, email: data.user.email ?? null } };
}

// Tests only.
export function setAuthClientForTests(next: SupabaseClient | null | undefined) {
  client = next;
}
