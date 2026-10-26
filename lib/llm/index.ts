import { loadLLMConfig, type LLMConfig, type ProviderSpec } from "./config.ts";
import { FallbackChatProvider } from "./fallback.ts";
import { GeminiProvider } from "./providers/gemini.ts";
import { DEEPSEEK_BASE_URL, OpenAICompatibleProvider } from "./providers/openai-compatible.ts";
import { MockProvider } from "./providers/mock.ts";
import type { ChatProvider } from "./types.ts";

export { LLMError, type LLMErrorKind } from "./errors.ts";
export { loadLLMConfig, type LLMConfig } from "./config.ts";
export { estimateCost, type CostEstimate } from "./pricing.ts";
export { logUsage, type UsageRecord } from "./usage.ts";
export type { ChatMessage, ChatOptions, ChatProvider, ChatResult, TokenUsage } from "./types.ts";

let cached: { config: LLMConfig; provider: ChatProvider } | null = null;

type ProviderSettings = Pick<LLMConfig, "timeoutMs" | "maxAttempts" | "deepseekThinking" | "openaiReasoningEffort">;

// `transport.fetch` lets tests replace the network while keeping each vendor's request settings.
export function createChatProvider(spec: ProviderSpec, config: ProviderSettings, transport: { fetch?: typeof fetch } = {}): ChatProvider {
  const common = { apiKey: spec.apiKey, model: spec.model, timeoutMs: config.timeoutMs, maxAttempts: config.maxAttempts, fetch: transport.fetch };

  switch (spec.provider) {
    case "deepseek":
      // DeepSeek enables thinking by default; https://api-docs.deepseek.com/zh-cn/guides/thinking_mode
      return new OpenAICompatibleProvider({
        ...common,
        name: "deepseek",
        baseURL: DEEPSEEK_BASE_URL,
        maxTokensParam: "max_tokens",
        extraBody: { thinking: { type: config.deepseekThinking } },
      });
    case "openai":
      return new OpenAICompatibleProvider({
        ...common,
        name: "openai",
        maxTokensParam: "max_completion_tokens",
        sendTemperature: false,
        extraBody: { reasoning_effort: config.openaiReasoningEffort },
      });
    case "gemini":
      return new GeminiProvider(common);
    case "mock":
      return new MockProvider({ model: spec.model });
  }
}

// Returns the configured chat provider. The environment is validated on first use, so a
// missing key fails the first request with a clear message instead of failing the build.
export function getChatProvider(): ChatProvider {
  if (!cached) {
    const config = loadLLMConfig();
    const primary = createChatProvider(config.primary, config);
    const provider = config.fallback ? new FallbackChatProvider(primary, createChatProvider(config.fallback, config)) : primary;
    cached = { config, provider };
  }

  return cached.provider;
}

export function getLLMConfig(): LLMConfig {
  getChatProvider();
  return (cached as { config: LLMConfig }).config;
}

// The provider and model answers are generated with, or null when the LLM settings are invalid.
export function getModelIdentity(): { provider: string; model: string } | null {
  try {
    const { primary } = getLLMConfig();
    return { provider: primary.provider, model: primary.model };
  } catch {
    return null;
  }
}

// Tests only: forget the cached provider so a changed environment takes effect.
export function resetChatProvider() {
  cached = null;
}
