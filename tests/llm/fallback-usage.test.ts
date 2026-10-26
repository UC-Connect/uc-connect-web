import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { answerCacheKey, findPrebuiltAnswer } from "../../lib/admissions/cache.ts";
import { LLMError } from "../../lib/llm/errors.ts";
import { FallbackChatProvider } from "../../lib/llm/fallback.ts";
import { getChatProvider, getModelIdentity, resetChatProvider } from "../../lib/llm/index.ts";
import { estimateCost } from "../../lib/llm/pricing.ts";
import { MockProvider } from "../../lib/llm/providers/mock.ts";
import type { ChatMessage } from "../../lib/llm/types.ts";

const messages: ChatMessage[] = [{ role: "user", content: "What is TAG?" }];
const saved = { ...process.env };

function setEnv(values: Record<string, string>) {
  process.env = { ...values } as NodeJS.ProcessEnv;
}

afterEach(() => {
  process.env = { ...saved };
  resetChatProvider();
});

async function collect(provider: FallbackChatProvider) {
  const chunks: string[] = [];
  let done: { provider: string; fallback?: boolean } | undefined;
  for await (const chunk of provider.stream(messages, { onDone: (result) => (done = result) })) chunks.push(chunk);
  return { text: chunks.join(""), done };
}

describe("FallbackChatProvider", () => {
  const backup = () => new MockProvider({ model: "backup", text: "Backup answer." });

  it("uses the primary when it succeeds", async () => {
    const switched: LLMError[] = [];
    const provider = new FallbackChatProvider(new MockProvider({ text: "Primary answer." }), backup(), (error) => switched.push(error));
    const result = await collect(provider);
    assert.equal(result.text, "Primary answer.");
    assert.equal(result.done?.fallback, undefined);
    assert.equal(switched.length, 0);
  });

  it("switches on a retryable error before any text", async () => {
    const switched: LLMError[] = [];
    const provider = new FallbackChatProvider(new MockProvider({ error: "rate_limit" }), backup(), (error) => switched.push(error));
    const result = await collect(provider);
    assert.equal(result.text, "Backup answer.");
    assert.equal(result.done?.fallback, true);
    assert.equal(switched[0].kind, "rate_limit");
  });

  it("does not switch on a non-retryable error", async () => {
    const provider = new FallbackChatProvider(new MockProvider({ error: "config" }), backup(), () => assert.fail("should not fall back"));
    await assert.rejects(collect(provider), (error: unknown) => error instanceof LLMError && error.kind === "config");
  });

  it("does not switch once text has streamed", async () => {
    const provider = new FallbackChatProvider(new MockProvider({ text: "one two three", error: "upstream", failAfterChunks: 1 }), backup(), () => assert.fail("should not fall back"));
    await assert.rejects(collect(provider), (error: unknown) => error instanceof LLMError && error.kind === "upstream");
  });

  it("is used when LLM_FALLBACK_PROVIDER is set", () => {
    setEnv({ LLM_PROVIDER: "mock", LLM_FALLBACK_PROVIDER: "gemini", GEMINI_API_KEY: "k" });
    assert.ok(getChatProvider() instanceof FallbackChatProvider);
  });
});

describe("estimateCost", () => {
  it("prices cached and uncached input separately", () => {
    const cost = estimateCost("deepseek", "deepseek-flash", { inputTokens: 2_000_000, cachedInputTokens: 1_000_000, outputTokens: 1_000_000 });
    assert.deepEqual({ amount: cost?.amount, currency: cost?.currency }, { amount: 2 + 0.04 + 8, currency: "CNY" });
    assert.ok(cost && Math.abs(cost.usd - 10.04 / 7.1) < 1e-9);
  });

  it("returns USD prices and null for unknown models or missing usage", () => {
    assert.equal(estimateCost("openai", "gpt-6-luna", { inputTokens: 1_000_000, outputTokens: 1_000_000 })?.amount, 0.6);
    assert.equal(estimateCost("openai", "unknown", { inputTokens: 1, outputTokens: 1 }), null);
    assert.equal(estimateCost("deepseek", "deepseek-flash", undefined), null);
  });
});

describe("answer caching by model", () => {
  it("includes the provider and model in the cache key", () => {
    const deepseek = answerCacheKey("What is TAG?", null, { provider: "deepseek", model: "deepseek-flash" });
    const gemini = answerCacheKey("What is TAG?", null, { provider: "gemini", model: "gemini-flash-lite-latest" });
    const otherModel = answerCacheKey("What is TAG?", null, { provider: "deepseek", model: "deepseek-v4-pro" });
    assert.notEqual(deepseek, gemini);
    assert.notEqual(deepseek, otherModel);
    assert.equal(deepseek, answerCacheKey("what is tag", null, { provider: "deepseek", model: "deepseek-flash" }));
  });

  it("serves pre-generated answers only to the model that generated them", () => {
    const question = "How is the UC GPA calculated?";
    assert.ok(findPrebuiltAnswer(question, { provider: "gemini", model: "gemini-flash-lite-latest" }));
    assert.equal(findPrebuiltAnswer(question, { provider: "deepseek", model: "deepseek-flash" }), null);
    // Without a usable model configuration the stored answers are still served.
    assert.ok(findPrebuiltAnswer(question, null));
  });

  it("reports the configured identity, or null when settings are invalid", () => {
    setEnv({ LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "k" });
    assert.deepEqual(getModelIdentity(), { provider: "deepseek", model: "deepseek-flash" });
    resetChatProvider();
    setEnv({ LLM_PROVIDER: "deepseek" });
    assert.equal(getModelIdentity(), null);
  });
});
