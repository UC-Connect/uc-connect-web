import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { answerQuestion, AssistantError, streamAnswer } from "../../lib/admissions/assistant.ts";
import { resetChatProvider } from "../../lib/llm/index.ts";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
  resetChatProvider();
});

describe("assistant with the mock provider", () => {
  it("streams meta, text, and done events through the provider interface", async () => {
    process.env.LLM_PROVIDER = "mock";
    const events = [];
    for await (const event of streamAnswer({ question: "Which UC campuses participate in TAG?" })) events.push(event);

    assert.equal(events[0].type, "meta");
    assert.equal(events[0].type === "meta" && events[0].provider, "mock");
    assert.ok(events[0].type === "meta" && events[0].sources.some((source) => source.slug === "uc-tag"));
    assert.equal(events.at(-1)?.type, "done");
    assert.ok(events.some((event) => event.type === "delta"));
  });

  it("collects a full answer", async () => {
    process.env.LLM_PROVIDER = "mock";
    const result = await answerQuestion({ question: "What is TAG?" });
    assert.match(result.answer, /mock answer/);
    assert.equal(result.model, "mock");
  });

  it("reports a missing key as MISSING_API_KEY", async () => {
    process.env.LLM_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(answerQuestion({ question: "What is TAG?" }), (error: unknown) => error instanceof AssistantError && error.code === "MISSING_API_KEY");
  });
});
