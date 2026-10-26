import { getChatProvider, getLLMConfig, LLMError, type ChatMessage, type ChatProvider, type ChatResult, type LLMErrorKind } from "../llm/index.ts";
import { loadSystemPrompt, type Audience } from "./content.ts";
import { retrieve, type RetrievedSource, type Retrieval } from "./retriever.ts";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AnswerEvent =
  | { type: "meta"; sources: RetrievedSource[]; audience: Retrieval["audience"]; model: string; provider?: string; cached?: boolean }
  | { type: "delta"; text: string }
  | ({ type: "done" } & Partial<Omit<ChatResult, "text">>);

export type AssistantErrorCode = "MISSING_API_KEY" | "QUOTA_EXHAUSTED" | "UPSTREAM_BUSY" | "UPSTREAM_FAILED" | "TIMEOUT" | "EMPTY_ANSWER";

export class AssistantError extends Error {
  code: AssistantErrorCode;

  constructor(code: AssistantErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

type AnswerOptions = {
  question: string;
  history?: ChatTurn[];
  audience?: Exclude<Audience, "all"> | null;
  signal?: AbortSignal;
  // Evaluation scripts pass a provider and token limit; the app uses the configured ones.
  provider?: ChatProvider;
  maxTokens?: number;
  // The chat API retrieves first (to skip out-of-scope questions) and passes the result in.
  retrieval?: Retrieval;
};

const FOLLOW_UP_MIN_TOKENS = 4;

// Short follow-ups ("what about nonresidents?") are retrieved together with the previous question.
export function retrieveForConversation(question: string, history: ChatTurn[], audience: AnswerOptions["audience"]) {
  const audienceMode = audience ? "filter" : "boost";
  const direct = retrieve(question, { audience, audienceMode });
  const previousQuestion = [...history].reverse().find((turn) => turn.role === "user")?.content;

  if (!previousQuestion || (direct.chunks.length >= 2 && direct.queryTokens.length >= FOLLOW_UP_MIN_TOKENS)) {
    return direct;
  }

  return retrieve(`${previousQuestion} ${question}`, { audience: audience ?? direct.audience, audienceMode });
}

function buildContext(retrieval: Retrieval): string {
  if (retrieval.chunks.length === 0) {
    return "[No relevant UC Connect knowledge-base excerpts were retrieved. Follow the insufficient-evidence rule.]";
  }

  return retrieval.sources
    .map((source) => {
      const excerpts = retrieval.chunks
        .filter((chunk) => chunk.slug === source.slug)
        .map((chunk) => `Section: ${chunk.heading}\n${chunk.content}`)
        .join("\n\n");
      const first = retrieval.chunks.find((chunk) => chunk.slug === source.slug);

      return [
        `[${source.number}] ${source.title}`,
        `Source URL: ${source.url || "Not provided"}`,
        `Applicable cycle/date: ${first?.applicableCycle || "Not provided"}`,
        `Last reviewed: ${source.lastReviewed || "Not provided"}`,
        "",
        excerpts,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

const ERROR_CODES: Record<LLMErrorKind, AssistantErrorCode> = {
  config: "MISSING_API_KEY",
  quota: "QUOTA_EXHAUSTED",
  rate_limit: "UPSTREAM_BUSY",
  timeout: "TIMEOUT",
  empty: "EMPTY_ANSWER",
  upstream: "UPSTREAM_FAILED",
  aborted: "UPSTREAM_FAILED",
};

function toAssistantError(error: unknown): unknown {
  if (error instanceof LLMError && error.kind !== "aborted") {
    return new AssistantError(ERROR_CODES[error.kind], error.message);
  }

  return error;
}

export function buildMessages(question: string, history: ChatTurn[], retrieval: Retrieval): ChatMessage[] {
  const replyLanguage = /[\u3400-\u9fff]/.test(question) ? "Simplified Chinese" : "English";
  const userPrompt = [
    `Reply language: ${replyLanguage}`,
    "",
    "User question:",
    question,
    "",
    "Retrieved UC Connect knowledge-base sources (cite them by their bracketed number):",
    buildContext(retrieval),
  ].join("\n");

  return [
    { role: "system", content: loadSystemPrompt() },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: userPrompt },
  ];
}

export async function* streamAnswer({ question, history = [], audience = null, signal, ...overrides }: AnswerOptions): AsyncGenerator<AnswerEvent> {
  let provider: ChatProvider;
  let maxTokens: number;

  try {
    provider = overrides.provider ?? getChatProvider();
    maxTokens = overrides.maxTokens ?? getLLMConfig().maxOutputTokens;
  } catch (error) {
    throw toAssistantError(error);
  }

  const retrieval = overrides.retrieval ?? retrieveForConversation(question, history, audience);

  yield { type: "meta", sources: retrieval.sources, audience: retrieval.audience, model: provider.model, provider: provider.name };

  const messages = buildMessages(question, history, retrieval);

  let result: Omit<ChatResult, "text"> | undefined;

  try {
    const options = { temperature: 0.2, maxTokens, signal, onDone: (done: Omit<ChatResult, "text">) => (result = done) };

    for await (const text of provider.stream(messages, options)) {
      yield { type: "delta", text };
    }
  } catch (error) {
    throw toAssistantError(error);
  }

  // Reports the provider and model that actually answered (the fallback, if one was used).
  yield { type: "done", ...result };
}

export async function answerQuestion(options: AnswerOptions) {
  let answer = "";
  let meta: Extract<AnswerEvent, { type: "meta" }> | undefined;
  let done: Extract<AnswerEvent, { type: "done" }> | undefined;

  for await (const event of streamAnswer(options)) {
    if (event.type === "meta") {
      meta = event;
    } else if (event.type === "delta") {
      answer += event.text;
    } else {
      done = event;
    }
  }

  return {
    answer,
    sources: meta?.sources ?? [],
    audience: meta?.audience ?? null,
    provider: done?.provider ?? meta?.provider ?? "",
    model: done?.model ?? meta?.model ?? "",
    usage: done?.usage,
    latencyMs: done?.latencyMs,
    fallback: done?.fallback ?? false,
  };
}
