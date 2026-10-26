// Temporarily blocks users or hashed IPs that keep hitting rate limits. Stored in Supabase
// (admissions_blocklist) when configured, otherwise per instance.
import { getSupabaseAdmin } from "./supabase-admin.ts";

const DEFAULT_THRESHOLD = 20;
const BLOCK_HOURS = 24;
const DAY_MS = 24 * 60 * 60 * 1000;

const memory = new Map<string, { day: number; violations: number; blockedUntil: number }>();

function threshold(): number {
  const parsed = Number(process.env.ADMISSIONS_BLOCK_THRESHOLD);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_THRESHOLD;
}

export async function isBlocked(subjects: string[]): Promise<boolean> {
  const now = Date.now();

  if (subjects.some((subject) => (memory.get(subject)?.blockedUntil ?? 0) > now)) {
    return true;
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase.rpc("admissions_is_blocked", { p_subjects: subjects });

  if (error) {
    console.error("[admissions-blocklist] check failed", error.message);
    return false;
  }

  return data === true;
}

// Counts one limit violation; returns true when the subject has just been blocked.
export async function recordViolation(subject: string): Promise<boolean> {
  const now = Date.now();
  const day = Math.floor(now / DAY_MS);
  const entry = memory.get(subject);
  const current = entry && entry.day === day ? entry : { day, violations: 0, blockedUntil: entry?.blockedUntil ?? 0 };

  current.violations += 1;
  if (current.violations >= threshold()) current.blockedUntil = now + BLOCK_HOURS * 60 * 60 * 1000;
  memory.set(subject, current);

  const supabase = getSupabaseAdmin();

  if (supabase) {
    const { error } = await supabase.rpc("admissions_record_violation", { p_subject: subject, p_threshold: threshold(), p_block_hours: BLOCK_HOURS });
    if (error) console.error("[admissions-blocklist] recording violation failed", error.message);
  }

  if (current.violations === threshold()) {
    console.warn(JSON.stringify({ event: "admissions_blocked", at: new Date().toISOString(), subject, hours: BLOCK_HOURS }));
    return true;
  }

  return false;
}

// Tests only.
export function resetBlocklist() {
  memory.clear();
}
