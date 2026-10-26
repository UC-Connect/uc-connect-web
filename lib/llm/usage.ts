import { estimateCost } from "./pricing.ts";
import type { TokenUsage } from "./types.ts";

export type UsageRecord = {
  // "model" for a model call; the cache sources record answers served without one.
  source: "model" | "rules" | "prebuilt" | "cache";
  provider?: string;
  model?: string;
  usage?: TokenUsage;
  latencyMs?: number;
  fallback?: boolean;
};

// One JSON line per answer so Vercel logs can be filtered and summed. Set LLM_USAGE_LOG=off to silence.
export function logUsage(record: UsageRecord) {
  if (process.env.LLM_USAGE_LOG === "off") {
    return;
  }

  const cost = record.provider && record.model ? estimateCost(record.provider, record.model, record.usage) : null;

  console.log(
    JSON.stringify({
      event: "llm_usage",
      at: new Date().toISOString(),
      source: record.source,
      cacheHit: record.source !== "model",
      provider: record.provider ?? null,
      model: record.model ?? null,
      inputTokens: record.usage?.inputTokens ?? null,
      cachedInputTokens: record.usage?.cachedInputTokens ?? null,
      outputTokens: record.usage?.outputTokens ?? null,
      latencyMs: record.latencyMs ?? null,
      cost: cost ? Number(cost.amount.toFixed(6)) : null,
      currency: cost?.currency ?? null,
      fallback: record.fallback ?? false,
    })
  );
}
