// Prices change: re-check the official pages before relying on these numbers.
//   DeepSeek: https://api-docs.deepseek.com/zh-cn/quick_start/pricing (checked 2026-10-25)
//   OpenAI:   https://developers.openai.com/api/docs/pricing (checked 2026-10-25)
//   Gemini:   https://ai.google.dev/gemini-api/docs/pricing (checked 2026-10-25)
// DeepSeek charges half price off-peak; the peak price is used here as a conservative estimate.
// Gemini's free tier costs nothing, so its paid-tier price is an upper bound.
import type { TokenUsage } from "./types.ts";

export type Currency = "USD" | "CNY";

export type ModelPrice = {
  currency: Currency;
  // Per 1M tokens.
  input: number;
  cachedInput: number;
  output: number;
};

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "deepseek:deepseek-flash": { currency: "CNY", input: 2, cachedInput: 0.04, output: 8 },
  "deepseek:deepseek-v4-pro": { currency: "CNY", input: 9, cachedInput: 0.3, output: 27 },
  "openai:gpt-6-luna": { currency: "USD", input: 0.1, cachedInput: 0.01, output: 0.5 },
  "openai:gpt-5.4-nano": { currency: "USD", input: 0.2, cachedInput: 0.02, output: 1.25 },
  "gemini:gemini-flash-lite-latest": { currency: "USD", input: 0.3, cachedInput: 0.03, output: 2.5 },
  "gemini:gemini-3.5-flash-lite": { currency: "USD", input: 0.3, cachedInput: 0.03, output: 2.5 },
  "mock:mock": { currency: "USD", input: 0, cachedInput: 0, output: 0 },
};

// Only used to compare providers in one currency. Update alongside the prices.
export const CNY_PER_USD = 7.1;

export type CostEstimate = { amount: number; currency: Currency; usd: number };

export function estimateCost(provider: string, model: string, usage: TokenUsage | undefined): CostEstimate | null {
  const price = MODEL_PRICES[`${provider}:${model}`];

  if (!price || !usage) {
    return null;
  }

  const cached = Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens);
  const amount = ((usage.inputTokens - cached) * price.input + cached * price.cachedInput + usage.outputTokens * price.output) / 1_000_000;
  return { amount, currency: price.currency, usd: price.currency === "USD" ? amount : amount / CNY_PER_USD };
}
