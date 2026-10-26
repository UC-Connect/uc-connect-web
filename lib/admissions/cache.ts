import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getKnowledgeBaseVersion, type Audience } from "./content.ts";
import type { RetrievedSource } from "./retriever.ts";
import { getSupabaseAdmin } from "./supabase-admin.ts";

export type ModelIdentity = { provider: string; model: string };

export type CachedAnswer = ModelIdentity & {
  question: string;
  audience: Exclude<Audience, "all"> | null;
  answer: string;
  sources: RetrievedSource[];
};

// Pre-generated answers are only served for the knowledge-base version and model that produced them.
export type PrebuiltFile = ModelIdentity & {
  kbVersion: string;
  generatedAt: string;
  answers: CachedAnswer[];
};

const PREBUILT_PATH = path.join(process.cwd(), "content", "admissions", "cache", "suggested-answers.json");
const CACHE_TTL_DAYS = 30;

let prebuiltCache: PrebuiltFile | undefined;

export function normalizeQuestion(question: string): string {
  return question
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s?？!！.。]+$/u, "")
    .trim();
}

export function readPrebuiltFile(): PrebuiltFile | null {
  if (prebuiltCache !== undefined) {
    return prebuiltCache;
  }

  try {
    prebuiltCache = JSON.parse(fs.readFileSync(PREBUILT_PATH, "utf8")) as PrebuiltFile;
    return prebuiltCache;
  } catch {
    // Not memoized, so a file generated later is picked up without a restart.
    return null;
  }
}

export function writePrebuiltFile(file: PrebuiltFile) {
  fs.mkdirSync(path.dirname(PREBUILT_PATH), { recursive: true });
  fs.writeFileSync(PREBUILT_PATH, `${JSON.stringify(file, null, 2)}\n`);
  prebuiltCache = file;
}

// Answers generated ahead of time for the suggested questions shown in the UI. Without a usable
// model configuration (identity null) they are still served, since there is no model to ask.
export function findPrebuiltAnswer(question: string, identity: ModelIdentity | null): CachedAnswer | null {
  const file = readPrebuiltFile();

  if (!file || file.kbVersion !== getKnowledgeBaseVersion()) {
    return null;
  }

  if (identity && (file.provider !== identity.provider || file.model !== identity.model)) {
    return null;
  }

  const normalized = normalizeQuestion(question);
  return file.answers.find((entry) => normalizeQuestion(entry.question) === normalized) ?? null;
}

// Switching provider or model, or editing the knowledge base, changes the key, so old answers are never reused.
export function answerCacheKey(question: string, audience: CachedAnswer["audience"], identity: ModelIdentity): string {
  return createHash("sha256")
    .update(`${normalizeQuestion(question)}|${audience ?? "auto"}|${identity.provider}:${identity.model}|${getKnowledgeBaseVersion()}`)
    .digest("hex");
}

export async function findCachedAnswer(question: string, audience: CachedAnswer["audience"], identity: ModelIdentity): Promise<CachedAnswer | null> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const key = answerCacheKey(question, audience, identity);
  const since = new Date(Date.now() - CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("admissions_answer_cache")
    .select("question, audience, answer, sources, provider, model")
    .eq("cache_key", key)
    .gte("created_at", since)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  void supabase.rpc("admissions_record_cache_hit", { p_cache_key: key });
  return data as CachedAnswer;
}

export async function storeCachedAnswer(entry: CachedAnswer): Promise<void> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("admissions_answer_cache").upsert({
    cache_key: answerCacheKey(entry.question, entry.audience, entry),
    question: entry.question,
    audience: entry.audience,
    kb_version: getKnowledgeBaseVersion(),
    answer: entry.answer,
    sources: entry.sources,
    provider: entry.provider,
    model: entry.model,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[admissions-cache] store failed", error.message);
  }
}
