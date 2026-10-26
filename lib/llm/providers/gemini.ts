import { errorFromStatus, LLMError } from "../errors.ts";
import type { ChatMessage, ChatOptions, ChatProvider, ChatResult, StreamOptions, TokenUsage } from "../types.ts";

export type GeminiOptions = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxAttempts: number;
  fetch?: typeof fetch;
};

const RETRYABLE_STATUS_CODES = new Set([429, 503, 504]);
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type GeminiPayload = {
  candidates?: { content?: { parts?: { text?: unknown }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number };
};

async function* readServerSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<GeminiPayload> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data:")) yield JSON.parse(line.slice(5).trim());
    }
  }

  if (buffer.startsWith("data:")) yield JSON.parse(buffer.slice(5).trim());
}

function extractText(payload: GeminiPayload): string {
  const parts = payload.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((part) => (typeof part.text === "string" ? part.text : "")).join("") : "";
}

// Gemini through its REST streaming endpoint (no SDK). Retries 429/503/504 before the stream starts.
export class GeminiProvider implements ChatProvider {
  readonly name = "gemini";
  readonly model: string;
  private readonly options: GeminiOptions;

  constructor(options: GeminiOptions) {
    this.options = options;
    this.model = options.model.replace(/^models\//, "");
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
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const system = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
    const body = JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: messages
        .filter((message) => message.role !== "system")
        .map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
      generationConfig: { temperature: opts.temperature ?? 0.2, ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}) },
    });

    let usage: TokenUsage | undefined;
    let produced = false;

    try {
      const response = await this.request(body, signal);

      for await (const payload of readServerSentEvents(response.body as ReadableStream<Uint8Array>)) {
        const text = extractText(payload);

        if (payload.usageMetadata) {
          usage = {
            inputTokens: payload.usageMetadata.promptTokenCount ?? 0,
            outputTokens: payload.usageMetadata.candidatesTokenCount ?? 0,
            cachedInputTokens: payload.usageMetadata.cachedContentTokenCount,
          };
        }

        if (text) {
          produced = true;
          yield text;
        }
      }
    } catch (error) {
      throw this.toLLMError(error, timeout, opts.signal);
    }

    if (!produced) {
      throw new LLMError(this.name, "empty", "Gemini returned an empty answer.");
    }

    opts.onDone?.({ provider: this.name, model: this.model, usage, latencyMs: Date.now() - started });
  }

  private async request(body: string, signal: AbortSignal): Promise<Response> {
    const fetchImpl = this.options.fetch ?? fetch;
    const url = `${API_BASE}/models/${this.model}:streamGenerateContent?alt=sse`;

    for (let attempt = 1; ; attempt += 1) {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.options.apiKey },
        body,
        signal,
      });

      if (response.ok && response.body) return response;

      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt >= this.options.maxAttempts) {
        await response.body?.cancel();
        throw errorFromStatus(this.name, response.status);
      }

      await response.body?.cancel();
      await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** (attempt - 1)));
    }
  }

  private toLLMError(error: unknown, timeout: AbortSignal, callerSignal?: AbortSignal): LLMError {
    if (error instanceof LLMError) return error;
    if (callerSignal?.aborted) return new LLMError(this.name, "aborted", "Request aborted.", { cause: error });
    if (timeout.aborted) return new LLMError(this.name, "timeout", `Gemini request timed out after ${this.options.timeoutMs} ms.`, { cause: error });
    return new LLMError(this.name, "upstream", error instanceof Error ? error.message : String(error), { cause: error });
  }
}
