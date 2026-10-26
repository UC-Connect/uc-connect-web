export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

export interface ChatResult {
  text: string;
  usage?: TokenUsage;
  provider: string;
  model: string;
  latencyMs: number;
}

export type StreamOptions = ChatOptions & { onDone?: (result: Omit<ChatResult, "text">) => void };

export interface ChatProvider {
  readonly name: string;
  readonly model: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
  // Yields text as it arrives; onDone receives usage and latency after the last chunk.
  stream(messages: ChatMessage[], opts?: StreamOptions): AsyncIterable<string>;
}
