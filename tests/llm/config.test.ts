import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadLLMConfig } from "../../lib/llm/config.ts";
import { createChatProvider } from "../../lib/llm/index.ts";
import { LLMError } from "../../lib/llm/errors.ts";
import { GeminiProvider } from "../../lib/llm/providers/gemini.ts";
import { MockProvider } from "../../lib/llm/providers/mock.ts";

describe("loadLLMConfig", () => {
  it("defaults to Gemini and its default model", () => {
    const config = loadLLMConfig({ GEMINI_API_KEY: "key" });
    assert.deepEqual(config.primary, { provider: "gemini", model: "gemini-flash-lite-latest", apiKey: "key" });
    assert.equal(config.fallback, null);
    assert.equal(config.timeoutMs, 60000);
    assert.equal(config.maxOutputTokens, 800);
  });

  it("names the missing key for the selected provider", () => {
    assert.throws(() => loadLLMConfig({ LLM_PROVIDER: "gemini" }), (error: unknown) => error instanceof LLMError && error.kind === "config" && /GEMINI_API_KEY/.test(error.message));
  });

  it("rejects unknown provider names", () => {
    assert.throws(() => loadLLMConfig({ LLM_PROVIDER: "claude" }), /LLM_PROVIDER/);
  });

  it("does not require keys for unused providers", () => {
    assert.equal(loadLLMConfig({ LLM_PROVIDER: "mock" }).primary.provider, "mock");
  });

  it("treats empty strings as unset", () => {
    const config = loadLLMConfig({ LLM_PROVIDER: "", LLM_MODEL: "", GEMINI_API_KEY: "key", LLM_FALLBACK_PROVIDER: "" });
    assert.equal(config.primary.provider, "gemini");
    assert.equal(config.fallback, null);
  });

  it("honors LLM_MODEL over the legacy GEMINI_MODEL", () => {
    assert.equal(loadLLMConfig({ GEMINI_API_KEY: "key", GEMINI_MODEL: "legacy" }).primary.model, "legacy");
    assert.equal(loadLLMConfig({ GEMINI_API_KEY: "key", GEMINI_MODEL: "legacy", LLM_MODEL: "new" }).primary.model, "new");
  });

  it("validates numeric settings", () => {
    assert.throws(() => loadLLMConfig({ LLM_PROVIDER: "mock", LLM_TIMEOUT_MS: "-5" }), /LLM_TIMEOUT_MS/);
  });

  it("requires the fallback provider's key and rejects a fallback equal to the primary", () => {
    assert.throws(() => loadLLMConfig({ LLM_PROVIDER: "mock", LLM_FALLBACK_PROVIDER: "gemini" }), /GEMINI_API_KEY/);
    assert.throws(() => loadLLMConfig({ LLM_PROVIDER: "mock", LLM_FALLBACK_PROVIDER: "mock" }), /must differ/);
    assert.equal(loadLLMConfig({ LLM_PROVIDER: "mock", LLM_FALLBACK_PROVIDER: "gemini", GEMINI_API_KEY: "k" }).fallback?.provider, "gemini");
  });
});

describe("createChatProvider", () => {
  const settings = { timeoutMs: 1000, maxAttempts: 1 };

  it("returns the provider for each configured name", () => {
    assert.ok(createChatProvider({ provider: "gemini", model: "gemini-flash-lite-latest", apiKey: "k" }, settings) instanceof GeminiProvider);
    assert.ok(createChatProvider({ provider: "mock", model: "mock", apiKey: "" }, settings) instanceof MockProvider);
  });
});
