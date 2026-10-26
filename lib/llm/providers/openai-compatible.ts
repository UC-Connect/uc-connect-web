import OpenAI, { APIConnectionTimeoutError, APIError, APIUserAbortError } from "openai";
import { errorFromStatus, LLMError } from "../errors.ts";
import type { ChatMessage, ChatOptions, ChatProvider, ChatResult, StreamOptions, TokenUsage } from "../types.ts";

export type OpenAICompatibleOptions = {
  name: string;
  apiKey: string;
  model: string;
  baseURL?: string;
  timeoutMs: number;
  maxAttempts: number;
  // Request fields that differ between vendors, e.g. how to turn reasoning off.
  extraBody?: Record<string, unknown>;
  maxTokensParam?: "max_tokens" | "max_completion_tokens";
  // Reasoning models may reject or ignore temperature.
  sendTemperature?: boolean;
  fetch?: typeof fetch;
};

type StreamUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number } | null;
  prompt_cache_hit_tokens?: number;
};

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// One implementation for any Chat Completions API (DeepSeek, OpenAI). Streaming requests ask for
// usage in the final chunk via stream_options.include_usage.
export class OpenAICompatibleProvider implements ChatProvider {
  readonly name: string;
  readonly model: string;
  private readonly client: OpenAI;
  private readonly options: OpenAICompatibleOptions;

  constructor(options: OpenAICompatibleOptions) {
    this.options = options;
    this.name = options.name;
    this.model = options.model;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      timeout: options.timeoutMs,
      maxRetries: Math.max(0, options.maxAttempts - 1),
      fetch: options.fetch,
    });
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    let text = "";
    let done: Omit<ChatResult, "text"> | undefined;

    for await (const chunk of this.stream(messages, { ...opts, onDone: (result) => (done = result) })) {
      text += chunk;
    }

    return { text, ...(done as Omit<ChatResult, "text">) };
  }

  async *stream(messages: ChatMessage[], opts: StreamOptions = {}): AsyncIterable<string> {
    const started = Date.now();
    const maxTokensParam = this.options.maxTokensParam ?? "max_tokens";
    const body = {
      model: this.model,
      messages,
      stream: true as const,
      stream_options: { include_usage: true },
      ...(this.options.sendTemperature !== false && opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.maxTokens ? { [maxTokensParam]: opts.maxTokens } : {}),
      ...this.options.extraBody,
    };
    let usage: TokenUsage | undefined;
    let produced = false;

    try {
      const stream = await this.client.chat.completions.create(body as OpenAI.Chat.ChatCompletionCreateParamsStreaming, { signal: opts.signal });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;

        if (chunk.usage) {
          const raw = chunk.usage as StreamUsage;
          usage = {
            inputTokens: raw.prompt_tokens ?? 0,
            outputTokens: raw.completion_tokens ?? 0,
            cachedInputTokens: raw.prompt_cache_hit_tokens ?? raw.prompt_tokens_details?.cached_tokens ?? undefined,
          };
        }

        if (text) {
          produced = true;
          yield text;
        }
      }
    } catch (error) {
      throw this.toLLMError(error);
    }

    if (!produced) {
      throw new LLMError(this.name, "empty", `${this.name} returned an empty answer.`);
    }

    opts.onDone?.({ provider: this.name, model: this.model, usage, latencyMs: Date.now() - started });
  }

  private toLLMError(error: unknown): LLMError {
    if (error instanceof LLMError) return error;
    if (error instanceof APIUserAbortError) return new LLMError(this.name, "aborted", "Request aborted.", { cause: error });
    if (error instanceof APIConnectionTimeoutError) {
      return new LLMError(this.name, "timeout", `${this.name} request timed out after ${this.options.timeoutMs} ms.`, { cause: error });
    }
    // OpenAI reports an empty prepaid balance as 429 with code insufficient_quota; it is not a rate limit.
    if (error instanceof APIError && error.code === "insufficient_quota") {
      return new LLMError(this.name, "quota", `${this.name} account has no remaining credits.`, { status: error.status, cause: error });
    }
    if (error instanceof APIError && typeof error.status === "number") {
      const converted = errorFromStatus(this.name, error.status, error.message);
      return new LLMError(converted.provider, converted.kind, converted.message, { status: converted.status, retryable: converted.retryable, cause: error });
    }
    return new LLMError(this.name, "upstream", error instanceof Error ? error.message : String(error), { cause: error });
  }
}
