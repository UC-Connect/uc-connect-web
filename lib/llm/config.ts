import { z } from "zod";
import { LLMError } from "./errors.ts";

export const PROVIDER_NAMES = ["deepseek", "openai", "gemini", "mock"] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  deepseek: "deepseek-flash",
  // gpt-5.4-nano is deprecated; OpenAI recommends gpt-6-luna for cost-sensitive workloads.
  openai: "gpt-6-luna",
  gemini: "gemini-flash-lite-latest",
  mock: "mock",
};

const API_KEY_ENV: Record<ProviderName, string | null> = {
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  mock: null,
};

export type ProviderSpec = { provider: ProviderName; model: string; apiKey: string };

export type LLMConfig = {
  primary: ProviderSpec;
  fallback: ProviderSpec | null;
  timeoutMs: number;
  maxOutputTokens: number;
  maxAttempts: number;
  // RAG answers do not need reasoning, so both are off unless explicitly enabled.
  deepseekThinking: "enabled" | "disabled";
  openaiReasoningEffort: "none" | "low" | "medium" | "high";
};

// Empty strings in .env files mean "not set".
const optionalString = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), z.string().trim().optional());
const providerName = z.enum(PROVIDER_NAMES);

const envSchema = z.object({
  LLM_PROVIDER: z.preprocess((value) => (value === "" ? undefined : value), providerName.default("deepseek")),
  LLM_MODEL: optionalString,
  LLM_FALLBACK_PROVIDER: z.preprocess((value) => (value === "" ? undefined : value), providerName.optional()),
  LLM_FALLBACK_MODEL: optionalString,
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  LLM_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(800),
  // Attempts per provider before failing or switching to the fallback (2 = one retry).
  LLM_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(2),
  DEEPSEEK_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  DEEPSEEK_THINKING: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["enabled", "disabled"]).default("disabled")),
  OPENAI_REASONING_EFFORT: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["none", "low", "medium", "high"]).default("none")),
  // Older deployments set the Gemini model here; LLM_MODEL takes precedence.
  GEMINI_MODEL: optionalString,
});

type Env = z.infer<typeof envSchema>;

function spec(env: Env, provider: ProviderName, model: string | undefined): ProviderSpec {
  const keyName = API_KEY_ENV[provider];
  const apiKey = keyName ? env[keyName as keyof Env] : "";

  if (keyName && typeof apiKey !== "string") {
    throw new LLMError(provider, "config", `${keyName} is required when ${provider} is selected as an LLM provider.`);
  }

  const legacyModel = provider === "gemini" ? env.GEMINI_MODEL : undefined;
  return { provider, model: model ?? legacyModel ?? DEFAULT_MODELS[provider], apiKey: (apiKey as string) ?? "" };
}

// Validates the LLM environment variables and fails with a message naming the bad variable.
// Only keys for the selected primary and fallback providers are required.
export function loadLLMConfig(source: Record<string, string | undefined> = process.env): LLMConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new LLMError("config", "config", `Invalid LLM configuration (${details}).`);
  }

  const env = parsed.data;

  if (env.LLM_FALLBACK_PROVIDER && env.LLM_FALLBACK_PROVIDER === env.LLM_PROVIDER && !env.LLM_FALLBACK_MODEL) {
    throw new LLMError("config", "config", "LLM_FALLBACK_PROVIDER must differ from LLM_PROVIDER unless LLM_FALLBACK_MODEL is set.");
  }

  return {
    primary: spec(env, env.LLM_PROVIDER, env.LLM_MODEL),
    fallback: env.LLM_FALLBACK_PROVIDER ? spec(env, env.LLM_FALLBACK_PROVIDER, env.LLM_FALLBACK_MODEL) : null,
    timeoutMs: env.LLM_TIMEOUT_MS,
    maxOutputTokens: env.LLM_MAX_OUTPUT_TOKENS,
    maxAttempts: env.LLM_MAX_ATTEMPTS,
    deepseekThinking: env.DEEPSEEK_THINKING,
    openaiReasoningEffort: env.OPENAI_REASONING_EFFORT,
  };
}
