import { LLMError, type LLMErrorKind } from "../errors.ts";
import type { ChatMessage, ChatOptions, ChatProvider, ChatResult, StreamOptions } from "../types.ts";

export type MockOptions = {
  model?: string;
  text?: string | ((messages: ChatMessage[]) => string);
  delayMs?: number;
  // Fails before any text (or after `failAfterChunks` chunks) with this error kind.
  error?: LLMErrorKind;
  failAfterChunks?: number;
};

const DEFAULT_TEXT = "This is a mock answer from the UC Connect test provider [1].";

// Deterministic provider for unit tests and CI; never calls the network.
export class MockProvider implements ChatProvider {
  readonly name = "mock";
  readonly model: string;
  readonly calls: ChatMessage[][] = [];
  private readonly options: MockOptions;

  constructor(options: MockOptions = {}) {
    this.options = options;
    this.model = options.model ?? "mock";
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
    this.calls.push(messages);

    if (this.options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.delayMs));
    }

    if (opts.signal?.aborted) {
      throw new LLMError(this.name, "aborted", "Request aborted.");
    }

    const text = typeof this.options.text === "function" ? this.options.text(messages) : (this.options.text ?? DEFAULT_TEXT);
    const chunks = text.match(/\S+\s*/g) ?? [];

    for (const [index, chunk] of chunks.entries()) {
      if (this.options.error && index === (this.options.failAfterChunks ?? 0)) {
        throw new LLMError(this.name, this.options.error, `Mock ${this.options.error} error.`);
      }

      yield chunk;
    }

    if (this.options.error && (this.options.failAfterChunks ?? 0) >= chunks.length) {
      throw new LLMError(this.name, this.options.error, `Mock ${this.options.error} error.`);
    }

    const inputTokens = Math.ceil(messages.reduce((sum, message) => sum + message.content.length, 0) / 4);
    opts.onDone?.({
      provider: this.name,
      model: this.model,
      latencyMs: Date.now() - started,
      usage: { inputTokens, outputTokens: chunks.length },
    });
  }
}
