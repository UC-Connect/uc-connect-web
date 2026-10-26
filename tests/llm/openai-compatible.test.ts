import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LLMError } from "../../lib/llm/errors.ts";
import { createChatProvider } from "../../lib/llm/index.ts";
import type { ChatMessage } from "../../lib/llm/types.ts";

const messages: ChatMessage[] = [
  { role: "system", content: "Be brief." },
  { role: "user", content: "Which campuses offer TAG?" },
];
const settings = { timeoutMs: 2000, maxAttempts: 1, deepseekThinking: "disabled", openaiReasoningEffort: "none" } as const;

function chunk(content: string | null, usage?: object) {
  return { id: "x", object: "chat.completion.chunk", created: 0, model: "m", choices: content === null ? [] : [{ index: 0, delta: { content }, finish_reason: null }], ...(usage ? { usage } : {}) };
}

function stub(response: () => Response) {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return response();
  }) as typeof fetch;
  return { fetchImpl, requests };
}

function sse(...events: object[]) {
  const text = [...events.map((event) => `data: ${JSON.stringify(event)}\n\n`), "data: [DONE]\n\n"].join("");
  return () => new Response(text, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function provider(name: "deepseek" | "openai", fetchImpl: typeof fetch, model: string) {
  return createChatProvider({ provider: name, model, apiKey: "k" }, settings, { fetch: fetchImpl });
}

describe("OpenAI-compatible provider", () => {
  it("sends DeepSeek requests with thinking disabled and parses streamed usage", async () => {
    const { fetchImpl, requests } = stub(sse(chunk("Six "), chunk("campuses."), chunk(null, { prompt_tokens: 900, completion_tokens: 5, prompt_cache_hit_tokens: 640 })));
    const result = await provider("deepseek", fetchImpl, "deepseek-flash").chat(messages, { temperature: 0.2, maxTokens: 300 });

    assert.equal(result.text, "Six campuses.");
    assert.deepEqual(result.usage, { inputTokens: 900, outputTokens: 5, cachedInputTokens: 640 });
    assert.equal(requests[0].url, "https://api.deepseek.com/chat/completions");
    assert.deepEqual(requests[0].body.thinking, { type: "disabled" });
    assert.deepEqual(requests[0].body.stream_options, { include_usage: true });
    assert.equal(requests[0].body.max_tokens, 300);
    assert.equal(requests[0].body.temperature, 0.2);
    assert.equal(requests[0].body.model, "deepseek-flash");
  });

  it("sends OpenAI requests with reasoning off, max_completion_tokens, and no temperature", async () => {
    const { fetchImpl, requests } = stub(sse(chunk("ok"), chunk(null, { prompt_tokens: 10, completion_tokens: 1, prompt_tokens_details: { cached_tokens: 0 } })));
    const result = await provider("openai", fetchImpl, "gpt-6-luna").chat(messages, { temperature: 0.2, maxTokens: 300 });

    assert.equal(result.provider, "openai");
    assert.equal(result.usage?.cachedInputTokens, 0);
    assert.match(requests[0].url, /^https:\/\/api\.openai\.com\/v1\/chat\/completions/);
    assert.equal(requests[0].body.reasoning_effort, "none");
    assert.equal(requests[0].body.max_completion_tokens, 300);
    assert.equal("temperature" in requests[0].body, false);
  });

  it("maps HTTP failures to LLMError kinds", async () => {
    const limited = provider("deepseek", stub(() => new Response(JSON.stringify({ error: { message: "slow down" } }), { status: 429 })).fetchImpl, "deepseek-flash");
    await assert.rejects(limited.chat(messages), (error: unknown) => error instanceof LLMError && error.kind === "rate_limit" && error.retryable);

    const unauthorized = provider("openai", stub(() => new Response("{}", { status: 401 })).fetchImpl, "gpt-6-luna");
    await assert.rejects(unauthorized.chat(messages), (error: unknown) => error instanceof LLMError && error.kind === "config" && !error.retryable);
  });

  it("treats a stream without text as empty", async () => {
    const empty = provider("deepseek", stub(sse(chunk(null, { prompt_tokens: 1, completion_tokens: 0 }))).fetchImpl, "deepseek-flash");
    await assert.rejects(empty.chat(messages), (error: unknown) => error instanceof LLMError && error.kind === "empty");
  });
});
