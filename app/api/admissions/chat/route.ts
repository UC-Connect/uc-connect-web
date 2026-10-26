import { createHash } from "node:crypto";
import { AssistantError, buildMessages, retrieveForConversation, streamAnswer, type AnswerEvent } from "../../../../lib/admissions/assistant.ts";
import { findCachedAnswer, findPrebuiltAnswer, storeCachedAnswer } from "../../../../lib/admissions/cache.ts";
import { estimateTokens, LIMITS, sanitizeHistory, signAnswer } from "../../../../lib/admissions/guards.ts";
import { answerWithRules } from "../../../../lib/admissions/intents.ts";
import { consumeModelQuota, recordModelSpend } from "../../../../lib/admissions/quota.ts";
import { checkRateLimit } from "../../../../lib/admissions/rate-limit.ts";
import type { RetrievedSource } from "../../../../lib/admissions/retriever.ts";
import { estimateCost, getModelIdentity, logUsage } from "../../../../lib/llm/index.ts";
import { CNY_PER_USD } from "../../../../lib/llm/pricing.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Charged when a provider does not report token usage, so the budget still moves.
const UNKNOWN_COST_CNY = 0.02;

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_API_KEY: "AI 助手暂未配置。/ The assistant is not configured yet.",
  AI_DISABLED: "AI 助手暂时关闭，可以先看下面的相关专题。/ The assistant is turned off for now; see the related topics below.",
  QUOTA_EXHAUSTED: "AI 服务暂时不可用，请稍后再试，也可以先看下面的相关专题。/ The AI service is temporarily unavailable. Try again later, or read the related topics below.",
  UPSTREAM_BUSY: "AI 服务繁忙，请稍后再试，也可以先看下面的相关专题。/ The AI service is busy. Try again shortly, or read the related topics below.",
  TIMEOUT: "回答超时，请重试，也可以先看下面的相关专题。/ The answer timed out. Try again, or read the related topics below.",
  DAILY_LIMIT: "今天的 AI 额度已用完，明天再来，也可以先看下面的相关专题。/ Today's AI quota is used up. Come back tomorrow, or read the related topics below.",
  CLIENT_LIMIT: "提问太频繁，请稍后再试。/ Too many questions. Please wait a moment.",
  INPUT_TOO_LONG: "这次对话太长了，请开始新对话再问。/ This conversation is too long; please start a new chat.",
};

const OUT_OF_SCOPE = {
  zh: "这个问题在 UC Connect 整理的官方资料里找不到相关内容。我只回答 UC 本科新生和转学申请相关的问题，例如 A-G 课程、UC GPA、TAG、申请时间线、申请费和个人陈述（PIQ）。也可以先浏览「申请信息」里的专题。",
  en: "I couldn't find anything about this in UC Connect's official-source library. I only answer questions about UC first-year and transfer admissions, such as A-G courses, the UC GPA, TAG, application dates, fees, and personal insight questions. You can also browse the Admissions topics.",
};

type Send = (event: object) => void;

// Client IPs are hashed before they are used as rate-limit keys or stored. On Vercel the
// forwarded-for header is set by the platform and cannot be spoofed by the client.
function clientKey(request: Request): string {
  const ip = (request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for"))?.split(",")[0]?.trim() || "local";
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

// Sends a complete answer that did not need a model call. The signature lets the client include
// it as context in a follow-up question.
function sendAnswer(question: string, answer: string, meta: { sources: RetrievedSource[]; audience: unknown; model: string } & Record<string, unknown>) {
  return streamResponse(async (send) => {
    send({ type: "meta", ...meta });
    send({ type: "delta", text: answer });
    send({ type: "done", signature: signAnswer(question, answer) });
  });
}

function sendNotice(sources: RetrievedSource[], audience: unknown, code: keyof typeof ERROR_MESSAGES) {
  return streamResponse(async (send) => {
    send({ type: "meta", sources, audience, model: "" });
    send({ type: "error", code, message: ERROR_MESSAGES[code] });
  });
}

function costInCny(provider: string | undefined, model: string | undefined, usage: Parameters<typeof estimateCost>[2]): number {
  const cost = provider && model ? estimateCost(provider, model, usage) : null;
  if (!cost) return UNKNOWN_COST_CNY;
  return cost.currency === "CNY" ? cost.amount : cost.usd * CNY_PER_USD;
}

export async function POST(request: Request) {
  const client = clientKey(request);
  const burst = checkRateLimit(client);

  if (!burst.allowed) {
    return Response.json({ error: ERROR_MESSAGES.CLIENT_LIMIT }, { status: 429, headers: { "Retry-After": String(burst.retryAfterSeconds) } });
  }

  let body: { question?: unknown; history?: unknown; audience?: unknown };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const parsedHistory = sanitizeHistory(body.history);
  const audience = body.audience === "freshman" || body.audience === "transfer" ? body.audience : null;

  if (!question || question.length > LIMITS.questionChars) {
    return Response.json({ error: `question is required and must be at most ${LIMITS.questionChars} characters.` }, { status: 400 });
  }

  if (!parsedHistory.ok) {
    return Response.json({ error: parsedHistory.reason }, { status: 400 });
  }

  const history = parsedHistory.history;

  // Dates, TAG campuses, and fees are answered from rules without a model call.
  const rule = answerWithRules(question, audience);

  if (rule) {
    logUsage({ source: "rules" });
    return sendAnswer(question, rule.answer, { sources: rule.sources, audience, model: "", rule: rule.intent });
  }

  // Suggested questions are standalone, so their pre-generated answers apply even mid-conversation.
  // Other answers are cached only for standalone questions; follow-ups depend on the conversation.
  const identity = getModelIdentity();
  const cacheable = history.length === 0;
  const prebuilt = findPrebuiltAnswer(question, identity);
  const cached = prebuilt ?? (cacheable && identity ? await findCachedAnswer(question, audience, identity) : null);

  if (cached) {
    logUsage({ source: prebuilt ? "prebuilt" : "cache", provider: cached.provider, model: cached.model });
    return sendAnswer(question, cached.answer, { sources: cached.sources, audience: cached.audience, model: cached.model, cached: true });
  }

  const retrieval = retrieveForConversation(question, history, audience);

  if (process.env.ADMISSIONS_AI_ENABLED === "false") {
    return sendNotice(retrieval.sources, retrieval.audience, "AI_DISABLED");
  }

  // With nothing retrieved the model could only decline, so decline without calling it.
  if (retrieval.chunks.length === 0) {
    logUsage({ source: "out_of_scope" });
    const answer = /[㐀-鿿]/.test(question) ? OUT_OF_SCOPE.zh : OUT_OF_SCOPE.en;
    return sendAnswer(question, answer, { sources: [], audience: retrieval.audience, model: "", outOfScope: true });
  }

  const promptTokens = buildMessages(question, history, retrieval).reduce((sum, message) => sum + estimateTokens(message.content), 0);

  if (promptTokens > LIMITS.estimatedInputTokens) {
    return Response.json({ error: ERROR_MESSAGES.INPUT_TOO_LONG, code: "INPUT_TOO_LONG" }, { status: 413 });
  }

  const quota = await consumeModelQuota(client);

  if (!quota.allowed) {
    if (quota.reason === "client") {
      return Response.json({ error: ERROR_MESSAGES.CLIENT_LIMIT }, { status: 429 });
    }

    // Still point the user to the relevant topic pages when the daily quota or budget is used up.
    return sendNotice(retrieval.sources, retrieval.audience, "DAILY_LIMIT");
  }

  return streamResponse(async (send) => {
    let meta: Extract<AnswerEvent, { type: "meta" }> | undefined;
    let done: Extract<AnswerEvent, { type: "done" }> | undefined;
    let answer = "";

    try {
      for await (const event of streamAnswer({ question, history, audience, retrieval, signal: request.signal })) {
        if (event.type === "meta") meta = event;
        if (event.type === "delta") answer += event.text;
        if (event.type === "done") {
          done = event;
          send({ ...event, signature: signAnswer(question, answer) });
          continue;
        }
        send(event);
      }

      logUsage({ source: "model", provider: done?.provider, model: done?.model, usage: done?.usage, latencyMs: done?.latencyMs, fallback: done?.fallback });
      await recordModelSpend(costInCny(done?.provider, done?.model, done?.usage));

      if (cacheable && meta && done?.provider && done.model && answer) {
        await storeCachedAnswer({ question, audience, answer, sources: meta.sources, provider: done.provider, model: done.model });
      }
    } catch (error) {
      // Calls that fail or are aborted may still be billed for input; count a conservative cost.
      await recordModelSpend(UNKNOWN_COST_CNY);

      if (!request.signal.aborted) {
        const code = error instanceof AssistantError ? error.code : "UPSTREAM_FAILED";
        console.error("[admissions-chat]", code, error instanceof Error ? error.message : error);
        send({ type: "error", code, message: ERROR_MESSAGES[code] ?? "暂时无法回答，请稍后再试。/ Unable to answer right now." });
      }
    }
  });
}
