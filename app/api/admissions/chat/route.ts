import { AssistantError, streamAnswer, type ChatTurn } from "@/lib/admissions/assistant";
import { checkRateLimit } from "@/lib/admissions/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_LENGTH = 1000;
const MAX_HISTORY_TURNS = 6;
const MAX_TURN_LENGTH = 6000;

const ERROR_MESSAGES: Record<string, string> = {
  MISSING_API_KEY: "AI 助手暂未配置。/ The assistant is not configured yet.",
  UPSTREAM_BUSY: "AI 服务繁忙，请稍后再试。/ The AI service is busy. Please try again shortly.",
  TIMEOUT: "回答超时，请重试。/ The answer timed out. Please try again.",
};

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

export async function POST(request: Request) {
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rate = checkRateLimit(clientKey);

  if (!rate.allowed) {
    return Response.json(
      { error: "提问太频繁，请稍后再试。/ Too many questions. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        for await (const event of streamAnswer({ question, history, audience, signal: request.signal })) {
          send(event);
        }
      } catch (error) {
        if (!request.signal.aborted) {
          const code = error instanceof AssistantError ? error.code : "UPSTREAM_FAILED";
          console.error("[admissions-chat]", code, error instanceof Error ? error.message : error);
          send({ type: "error", code, message: ERROR_MESSAGES[code] ?? "暂时无法回答，请稍后再试。/ Unable to answer right now." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
