import { loadLLMConfig, type LLMConfig, type ProviderSpec } from "./config.ts";
import { GeminiProvider } from "./providers/gemini.ts";
import { MockProvider } from "./providers/mock.ts";
import type { ChatProvider } from "./types.ts";

export { LLMError, type LLMErrorKind } from "./errors.ts";
export { loadLLMConfig, type LLMConfig } from "./config.ts";
export type { ChatMessage, ChatOptions, ChatProvider, ChatResult, TokenUsage } from "./types.ts";

let cached: { config: LLMConfig; provider: ChatProvider } | null = null;

export function createChatProvider(spec: ProviderSpec, config: Pick<LLMConfig, "timeoutMs" | "maxAttempts">): ChatProvider {
  switch (spec.provider) {
    case "gemini":
      return new GeminiProvider({ apiKey: spec.apiKey, model: spec.model, timeoutMs: config.timeoutMs, maxAttempts: config.maxAttempts });
    case "mock":
      return new MockProvider({ model: spec.model });
  }
}

// Returns the configured chat provider. The environment is validated on first use, so a
// missing key fails the first request with a clear message instead of failing the build.
export function getChatProvider(): ChatProvider {
  if (!cached) {
    const config = loadLLMConfig();
    cached = { config, provider: createChatProvider(config.primary, config) };
  }

  return cached.provider;
}

export function getLLMConfig(): LLMConfig {
  getChatProvider();
  return (cached as { config: LLMConfig }).config;
}

// Tests only: forget the cached provider so a changed environment takes effect.
export function resetChatProvider() {
  cached = null;
}
