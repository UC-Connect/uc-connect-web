import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadLLMConfig } from "../../lib/llm/config.ts";
import { createChatProvider } from "../../lib/llm/index.ts";
import { LLMError } from "../../lib/llm/errors.ts";
import { GeminiProvider } from "../../lib/llm/providers/gemini.ts";
import { OpenAICompatibleProvider } from "../../lib/llm/providers/openai-compatible.ts";
import { MockProvider } from "../../lib/llm/providers/mock.ts";

describe("loadLLMConfig", () => {
  it("defaults to DeepSeek and its default model", () => {
    const config = loadLLMConfig({ DEEPSEEK_API_KEY: "key" });
    assert.deepEqual(config.primary, { provider: "deepseek", model: "deepseek-flash", apiKey: "key" });
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

  it("supports DeepSeek and OpenAI with their default models and reasoning off", () => {
    const deepseek = loadLLMConfig({ LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "d" });
    assert.deepEqual(deepseek.primary, { provider: "deepseek", model: "deepseek-flash", apiKey: "d" });
    assert.equal(deepseek.deepseekThinking, "disabled");
    const openai = loadLLMConfig({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "o", LLM_MODEL: "gpt-5.4-nano" });
    assert.equal(openai.primary.model, "gpt-5.4-nano");
    assert.equal(openai.openaiReasoningEffort, "none");
    assert.throws(() => loadLLMConfig({ LLM_PROVIDER: "deepseek" }), /DEEPSEEK_API_KEY/);
    assert.throws(() => loadLLMConfig({ LLM_PROVIDER: "deepseek", DEEPSEEK_API_KEY: "d", DEEPSEEK_THINKING: "maybe" }), /DEEPSEEK_THINKING/);
  });

  it("does not require keys for unused providers", () => {
    assert.equal(loadLLMConfig({ LLM_PROVIDER: "mock" }).primary.provider, "mock");
  });

  it("treats empty strings as unset", () => {
    const config = loadLLMConfig({ LLM_PROVIDER: "", LLM_MODEL: "", DEEPSEEK_API_KEY: "key", LLM_FALLBACK_PROVIDER: "" });
    assert.equal(config.primary.provider, "deepseek");
    assert.equal(config.fallback, null);
  });

  it("honors LLM_MODEL over the legacy GEMINI_MODEL", () => {
    const gemini = { LLM_PROVIDER: "gemini", GEMINI_API_KEY: "key", GEMINI_MODEL: "legacy" };
    assert.equal(loadLLMConfig(gemini).primary.model, "legacy");
    assert.equal(loadLLMConfig({ ...gemini, LLM_MODEL: "new" }).primary.model, "new");
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
  const settings = { timeoutMs: 1000, maxAttempts: 1, deepseekThinking: "disabled", openaiReasoningEffort: "none" } as const;

  it("returns the provider for each configured name", () => {
    const deepseek = createChatProvider({ provider: "deepseek", model: "deepseek-flash", apiKey: "k" }, settings);
    assert.ok(deepseek instanceof OpenAICompatibleProvider);
    assert.equal(deepseek.name, "deepseek");
    assert.equal(createChatProvider({ provider: "openai", model: "gpt-6-luna", apiKey: "k" }, settings).name, "openai");
    assert.ok(createChatProvider({ provider: "gemini", model: "gemini-flash-lite-latest", apiKey: "k" }, settings) instanceof GeminiProvider);
    assert.ok(createChatProvider({ provider: "mock", model: "mock", apiKey: "" }, settings) instanceof MockProvider);
  });
});
