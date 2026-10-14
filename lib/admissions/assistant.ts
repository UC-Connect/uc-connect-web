import { loadSystemPrompt, type Audience } from "./content.ts";
import { retrieve, type RetrievedSource, type Retrieval } from "./retriever.ts";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AnswerEvent =
  | { type: "meta"; sources: RetrievedSource[]; audience: Retrieval["audience"]; model: string; cached?: boolean }
  | { type: "delta"; text: string }
  | { type: "done" };

export type AssistantErrorCode = "MISSING_API_KEY" | "UPSTREAM_BUSY" | "UPSTREAM_FAILED" | "TIMEOUT" | "EMPTY_ANSWER";

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
};

const DEFAULT_MODEL = "gemini-flash-lite-latest";
const DEFAULT_MAX_OUTPUT_TOKENS = 800;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([429, 503, 504]);
const FOLLOW_UP_MIN_TOKENS = 4;

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new AssistantError("MISSING_API_KEY", "GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  return {
    apiKey,
    modelPath: model.startsWith("models/") ? model : `models/${model}`,
    maxOutputTokens: parsePositiveInteger(process.env.GEMINI_MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS),
    timeoutMs: parsePositiveInteger(process.env.GEMINI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxAttempts: parsePositiveInteger(process.env.GEMINI_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
  };
}

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

async function fetchWithRetry(url: string, init: RequestInit, maxAttempts: number): Promise<Response> {
  let response: Response | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    response = await fetch(url, init);

    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === maxAttempts) {
      return response;
    }

    await response.body?.cancel();
    await new Promise((resolve) => setTimeout(resolve, 800 * 2 ** (attempt - 1)));
  }

  return response as Response;
}

function extractText(payload: unknown): string {
  const parts = (payload as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })?.candidates?.[0]
    ?.content?.parts;

  return Array.isArray(parts) ? parts.map((part) => (typeof part.text === "string" ? part.text : "")).join("") : "";
}

async function* readServerSentEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        yield JSON.parse(line.slice(5).trim());
      }
    }
  }

  if (buffer.startsWith("data:")) {
    yield JSON.parse(buffer.slice(5).trim());
  }
}

export async function* streamAnswer({ question, history = [], audience = null, signal }: AnswerOptions): AsyncGenerator<AnswerEvent> {
  const config = getConfig();
  const retrieval = retrieveForConversation(question, history, audience);
  const timeoutSignal = AbortSignal.timeout(config.timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

  yield { type: "meta", sources: retrieval.sources, audience: retrieval.audience, model: config.modelPath };

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

  let response: Response;

  try {
    response = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/${config.modelPath}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": config.apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: loadSystemPrompt() }] },
          contents: [
            ...history.map((turn) => ({
              role: turn.role === "assistant" ? "model" : "user",
              parts: [{ text: turn.content }],
            })),
            { role: "user", parts: [{ text: userPrompt }] },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: config.maxOutputTokens },
        }),
        signal: requestSignal,
      },
      config.maxAttempts
    );
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new AssistantError("TIMEOUT", "The model request timed out.");
    }

    throw error;
  }

  if (!response.ok || !response.body) {
    const code = response.status === 429 ? "UPSTREAM_BUSY" : "UPSTREAM_FAILED";
    throw new AssistantError(code, `Gemini request failed with status ${response.status}.`);
  }

  let produced = false;

  for await (const payload of readServerSentEvents(response.body)) {
    const text = extractText(payload);

    if (text) {
      produced = true;
      yield { type: "delta", text };
    }
  }

  if (!produced) {
    throw new AssistantError("EMPTY_ANSWER", "Gemini returned an empty answer.");
  }

  yield { type: "done" };
}

export async function answerQuestion(options: AnswerOptions) {
  let answer = "";
  let meta: Extract<AnswerEvent, { type: "meta" }> | undefined;

  for await (const event of streamAnswer(options)) {
    if (event.type === "meta") {
      meta = event;
    } else if (event.type === "delta") {
      answer += event.text;
    }
  }

  return { answer, sources: meta?.sources ?? [], audience: meta?.audience ?? null, model: meta?.model ?? "" };
}
