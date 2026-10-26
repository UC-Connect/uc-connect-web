import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LLMError } from "../../lib/llm/errors.ts";
import { GeminiProvider } from "../../lib/llm/providers/gemini.ts";
import { MockProvider } from "../../lib/llm/providers/mock.ts";
import type { ChatMessage } from "../../lib/llm/types.ts";

const messages: ChatMessage[] = [
  { role: "system", content: "Be brief." },
  { role: "user", content: "What is TAG?" },
  { role: "assistant", content: "A transfer program." },
  { role: "user", content: "Which campuses?" },
];

function sse(...payloads: object[]) {
  return new Response(payloads.map((payload) => `data: ${JSON.stringify(payload)}\r\n\r\n`).join(""), { status: 200 });
}

function stubFetch(responses: Response[]) {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)) });
    return responses.shift() as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
}

describe("GeminiProvider", () => {
  const part = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

  it("streams text, maps roles, and reports usage", async () => {
    const { fetchImpl, requests } = stubFetch([
      sse(part("Six "), { ...part("campuses."), usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 4 } }),
    ]);
    const provider = new GeminiProvider({ apiKey: "k", model: "models/gemini-flash-lite-latest", timeoutMs: 1000, maxAttempts: 1, fetch: fetchImpl });
    const result = await provider.chat(messages, { maxTokens: 50 });

    assert.equal(result.text, "Six campuses.");
    assert.equal(result.model, "gemini-flash-lite-latest");
    assert.deepEqual(result.usage, { inputTokens: 120, outputTokens: 4, cachedInputTokens: undefined });
    assert.match(requests[0].url, /models\/gemini-flash-lite-latest:streamGenerateContent\?alt=sse$/);
    assert.deepEqual(requests[0].body.systemInstruction, { parts: [{ text: "Be brief." }] });
    assert.deepEqual((requests[0].body.contents as { role: string }[]).map((content) => content.role), ["user", "model", "user"]);
    assert.deepEqual(requests[0].body.generationConfig, { temperature: 0.2, maxOutputTokens: 50 });
  });

  it("retries 503 before the stream starts", async () => {
    const { fetchImpl, requests } = stubFetch([new Response("busy", { status: 503 }), sse(part("ok"))]);
    const provider = new GeminiProvider({ apiKey: "k", model: "m", timeoutMs: 5000, maxAttempts: 2, fetch: fetchImpl });
    assert.equal((await provider.chat(messages)).text, "ok");
    assert.equal(requests.length, 2);
  });

  it("converts failures into LLMError", async () => {
    const busy = new GeminiProvider({ apiKey: "k", model: "m", timeoutMs: 1000, maxAttempts: 1, fetch: stubFetch([new Response("", { status: 429 })]).fetchImpl });
    await assert.rejects(busy.chat(messages), (error: unknown) => error instanceof LLMError && error.kind === "rate_limit" && error.retryable);

    const badKey = new GeminiProvider({ apiKey: "k", model: "m", timeoutMs: 1000, maxAttempts: 3, fetch: stubFetch([new Response("", { status: 403 })]).fetchImpl });
    await assert.rejects(badKey.chat(messages), (error: unknown) => error instanceof LLMError && error.kind === "config" && !error.retryable);

    const empty = new GeminiProvider({ apiKey: "k", model: "m", timeoutMs: 1000, maxAttempts: 1, fetch: stubFetch([sse({ candidates: [] })]).fetchImpl });
    await assert.rejects(empty.chat(messages), (error: unknown) => error instanceof LLMError && error.kind === "empty");
  });
});

describe("MockProvider", () => {
  it("returns configured text with usage", async () => {
    const provider = new MockProvider({ text: "Hello there [1]." });
    const result = await provider.chat(messages);
    assert.equal(result.text, "Hello there [1].");
    assert.equal(result.provider, "mock");
    assert.ok(result.usage && result.usage.outputTokens === 3);
  });

  it("can fail before or during streaming", async () => {
    await assert.rejects(new MockProvider({ error: "rate_limit" }).chat(messages), (error: unknown) => error instanceof LLMError && error.retryable);

    const chunks: string[] = [];
    await assert.rejects(async () => {
      for await (const chunk of new MockProvider({ text: "one two three", error: "upstream", failAfterChunks: 2 }).stream(messages)) chunks.push(chunk);
    });
    assert.deepEqual(chunks, ["one ", "two "]);
  });
});
