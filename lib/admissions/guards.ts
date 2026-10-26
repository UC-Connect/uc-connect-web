// Input limits for the admissions chat API. Every model call's size is bounded by these, so a
// single request cannot cost much more than a normal question.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ChatTurn } from "./assistant.ts";

export const LIMITS = {
  questionChars: 500,
  // Two question/answer pairs of context for follow-ups.
  historyTurns: 4,
  userTurnChars: 500,
  // Our own answers are capped by LLM_MAX_OUTPUT_TOKENS; this only rejects tampered payloads.
  assistantTurnChars: 6000,
  // Rough upper bound for system prompt + retrieved sources + history + question.
  estimatedInputTokens: 6000,
} as const;

export type SignedTurn = ChatTurn & { signature?: string };

let warnedMissingSecret = false;

function secret(): string | null {
  const value = process.env.ADMISSIONS_HISTORY_SECRET;

  if (!value && !warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn("[admissions-guards] ADMISSIONS_HISTORY_SECRET is not set; earlier answers are dropped from follow-up context.");
  }

  return value || null;
}

// CJK characters are roughly one token each; other text is roughly four characters per token.
export function estimateTokens(text: string): number {
  const cjk = text.match(/[　-鿿＀-￯]/g)?.length ?? 0;
  return cjk + Math.ceil((text.length - cjk) / 4);
}

// Answers are signed together with the question they answer, so a client cannot invent earlier
// "assistant" turns to stuff the prompt or steer the model.
export function signAnswer(question: string, answer: string): string | undefined {
  const key = secret();
  return key ? createHmac("sha256", key).update(`${question}\u0000${answer}`).digest("base64url") : undefined;
}

function validSignature(question: string, answer: string, signature: string | undefined): boolean {
  const expected = signAnswer(question, answer);

  if (!expected || !signature || signature.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export type HistoryResult = { ok: true; history: ChatTurn[] } | { ok: false; reason: string };

// Keeps the last few turns. User turns are kept (they are the user's own words, length-capped);
// assistant turns are kept only when their signature matches the preceding user turn.
export function sanitizeHistory(value: unknown): HistoryResult {
  if (value === undefined) {
    return { ok: true, history: [] };
  }

  if (!Array.isArray(value)) {
    return { ok: false, reason: "history must be a list of { role, content } turns." };
  }

  const turns = value.slice(-LIMITS.historyTurns);
  const history: ChatTurn[] = [];

  for (const [index, turn] of turns.entries()) {
    if (!turn || (turn.role !== "user" && turn.role !== "assistant") || typeof turn.content !== "string") {
      return { ok: false, reason: "history must be a list of { role, content } turns." };
    }

    const limit = turn.role === "user" ? LIMITS.userTurnChars : LIMITS.assistantTurnChars;

    if (turn.content.length > limit) {
      return { ok: false, reason: "history turn is too long." };
    }

    if (turn.role === "user") {
      history.push({ role: "user", content: turn.content });
      continue;
    }

    const previous = turns[index - 1];

    if (previous?.role === "user" && validSignature(previous.content, turn.content, (turn as SignedTurn).signature)) {
      history.push({ role: "assistant", content: turn.content });
    }
  }

  return { ok: true, history };
}
