import { createHash } from "node:crypto";
import { AssistantError, retrieveForConversation, streamAnswer, type AnswerEvent, type ChatTurn } from "@/lib/admissions/assistant";
import { findCachedAnswer, findPrebuiltAnswer, storeCachedAnswer, type CachedAnswer } from "@/lib/admissions/cache";
import { answerWithRules } from "@/lib/admissions/intents";
import { consumeModelQuota } from "@/lib/admissions/quota";
import { checkRateLimit } from "@/lib/admissions/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY_TURNS = 6;
const MAX_TURN_LENGTH = 6000;

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_API_KEY: "AI 助手暂未配置。/ The assistant is not configured yet.",
  UPSTREAM_BUSY: "AI 服务繁忙，请稍后再试，也可以先看下面的相关专题。/ The AI service is busy. Try again shortly, or read the related topics below.",
  TIMEOUT: "回答超时，请重试，也可以先看下面的相关专题。/ The answer timed out. Try again, or read the related topics below.",
  DAILY_LIMIT: "今天的免费 AI 额度已用完，明天再来，也可以先看下面的相关专题。/ Today's free AI quota is used up. Come back tomorrow, or read the related topics below.",
  CLIENT_LIMIT: "提问太频繁，请稍后再试。/ Too many questions. Please wait a moment.",
};

type Send = (event: object) => void;

function parseHistory(value: unknown): ChatTurn[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const turns = value.slice(-MAX_HISTORY_TURNS);
  const valid = turns.every(
    (turn) =>
      turn &&
      (turn.role === "user" || turn.role === "assistant") &&
      typeof turn.content === "string" &&
      turn.content.length <= MAX_TURN_LENGTH
  );

  return valid ? turns.map((turn) => ({ role: turn.role, content: turn.content })) : null;
}

// Client IPs are hashed before they are used as rate-limit keys or stored.
function clientKey(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return createHash("sha256").update(`admissions:${ip}`).digest("hex").slice(0, 32);
}

function streamResponse(run: (send: Send) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await run((event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function sendCached(send: Send, cached: CachedAnswer) {
  send({ type: "meta", sources: cached.sources, audience: cached.audience, model: cached.model, cached: true });
  send({ type: "delta", text: cached.answer });
  send({ type: "done" });
}

export async function POST(request: Request) {
  const client = clientKey(request);
  const burst = checkRateLimit(client);

  if (!burst.allowed) {
    return Response.json(
      { error: ERROR_MESSAGES.CLIENT_LIMIT },
      { status: 429, headers: { "Retry-After": String(burst.retryAfterSeconds) } }
    );
  }

  let body: { question?: unknown; history?: unknown; audience?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const history = parseHistory(body.history);
  const audience = body.audience === "freshman" || body.audience === "transfer" ? body.audience : null;

  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: `question is required and must be under ${MAX_QUESTION_LENGTH} characters.` }, { status: 400 });
  }

  if (!history) {
    return Response.json({ error: "history must be a list of { role, content } turns." }, { status: 400 });
  }

  // Dates, TAG campuses, and fees are answered from rules without a model call.
  const rule = answerWithRules(question, audience);

  if (rule) {
    return streamResponse(async (send) => {
      send({ type: "meta", sources: rule.sources, audience, model: "", rule: rule.intent });
      send({ type: "delta", text: rule.answer });
      send({ type: "done" });
    });
  }

  // Suggested questions are standalone, so their pre-generated answers apply even mid-conversation.
  // Other answers are cached only for standalone questions; follow-ups depend on the conversation.
  const cacheable = history.length === 0;
  const cached = findPrebuiltAnswer(question) ?? (cacheable ? await findCachedAnswer(question, audience) : null);

  if (cached) {
    return streamResponse(async (send) => sendCached(send, cached));
  }

  const quota = await consumeModelQuota(client);

  if (!quota.allowed) {
    if (quota.reason === "client") {
      return Response.json({ error: ERROR_MESSAGES.CLIENT_LIMIT }, { status: 429 });
    }

    // Still point the user to the relevant topic pages when the daily model quota is gone.
    const retrieval = retrieveForConversation(question, history, audience);
    return streamResponse(async (send) => {
      send({ type: "meta", sources: retrieval.sources, audience: retrieval.audience, model: "" });
      send({ type: "error", code: "DAILY_LIMIT", message: ERROR_MESSAGES.DAILY_LIMIT });
    });
  }

  return streamResponse(async (send) => {
    let meta: Extract<AnswerEvent, { type: "meta" }> | undefined;
    let answer = "";

    try {
      for await (const event of streamAnswer({ question, history, audience, signal: request.signal })) {
        if (event.type === "meta") meta = event;
        if (event.type === "delta") answer += event.text;
        send(event);
      }

      if (cacheable && meta && answer) {
        await storeCachedAnswer({ question, audience, answer, sources: meta.sources, model: meta.model });
      }
    } catch (error) {
      if (!request.signal.aborted) {
        const code = error instanceof AssistantError ? error.code : "UPSTREAM_FAILED";
        console.error("[admissions-chat]", code, error instanceof Error ? error.message : error);
        send({ type: "error", code, message: ERROR_MESSAGES[code] ?? "暂时无法回答，请稍后再试。/ Unable to answer right now." });
      }
    }
  });
}
