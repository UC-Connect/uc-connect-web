import { LLMError } from "./errors.ts";
import type { ChatMessage, ChatOptions, ChatProvider, ChatResult, StreamOptions } from "./types.ts";

// Uses the primary provider and switches to the fallback when the primary fails with a retryable
// error before producing any text. Each provider already retries once on its own (LLM_MAX_ATTEMPTS),
// so a switch happens after that retry. Once text has streamed, errors are passed through so the
// user never sees two different answers stitched together.
export class FallbackChatProvider implements ChatProvider {
  readonly name: string;
  readonly model: string;
  private readonly primary: ChatProvider;
  private readonly fallback: ChatProvider;
  private readonly onFallback: (error: LLMError) => void;

  constructor(primary: ChatProvider, fallback: ChatProvider, onFallback: (error: LLMError) => void = logFallback(primary, fallback)) {
    this.primary = primary;
    this.fallback = fallback;
    this.onFallback = onFallback;
    this.name = primary.name;
    this.model = primary.model;
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
    let produced = false;

    try {
      for await (const chunk of this.primary.stream(messages, opts)) {
        produced = true;
        yield chunk;
      }
      return;
    } catch (error) {
      if (produced || !(error instanceof LLMError) || !error.retryable || opts.signal?.aborted) {
        throw error;
      }

      this.onFallback(error);
    }

    yield* this.fallback.stream(messages, {
      ...opts,
      onDone: (result) => opts.onDone?.({ ...result, fallback: true }),
    });
  }
}

function logFallback(primary: ChatProvider, fallback: ChatProvider) {
  return (error: LLMError) => {
    console.warn(
      JSON.stringify({
        event: "llm_fallback",
        at: new Date().toISOString(),
        from: `${primary.name}:${primary.model}`,
        to: `${fallback.name}:${fallback.model}`,
        reason: error.kind,
        status: error.status ?? null,
        message: error.message,
      })
    );
  };
}
