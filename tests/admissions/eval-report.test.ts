import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { citationsValid, gradeAnswer, type TestCase } from "../../scripts/admissions/grading.ts";
import { percentile, summarize, toCsv, type CaseResult } from "../../scripts/admissions/eval-report.ts";

const testCase: TestCase = { id: 1, topic: "t", question: "q", expectedSources: ["uc-tag"], mustInclude: ["not automatically"], mustNotInclude: ["guaranteed"], shouldRefuse: false };

describe("grading", () => {
  it("ignores Markdown emphasis when matching", () => {
    assert.deepEqual(gradeAnswer(testCase, "You should **not** automatically assume that [1].", ["uc-tag"]), []);
  });

  it("reports missing sources and forbidden text", () => {
    assert.deepEqual(gradeAnswer(testCase, "It is guaranteed, not automatically [1].", []), ["missing expected source: uc-tag", "answer includes forbidden text: guaranteed"]);
  });

  it("checks citations against the retrieved sources", () => {
    assert.equal(citationsValid("Six campuses [1][2].", 2), true);
    assert.equal(citationsValid("Six campuses [1, 3].", 2), false);
    assert.equal(citationsValid("No citation.", 2), false);
  });
});

describe("eval report", () => {
  const result = (overrides: Partial<CaseResult>): CaseResult => ({
    id: 1, question: "q", chinese: false, shouldRefuse: false, passed: true, failures: [], citationsValid: true,
    latencyMs: 1000, usage: { inputTokens: 1000, outputTokens: 100 }, cost: { amount: 0.01, currency: "CNY", usd: 0.01 / 7.1 }, answer: "a", ...overrides,
  });

  it("computes nearest-rank percentiles", () => {
    assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
    assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
    assert.equal(percentile([], 50), null);
  });

  it("summarizes accuracy by language, citations, latency, tokens, cost, and failures", () => {
    const summary = summarize("deepseek:deepseek-flash", [
      result({ id: 1 }),
      result({ id: 2, chinese: true, passed: false, failures: ["x"], latencyMs: 3000, citationsValid: false }),
      result({ id: 3, chinese: true }),
      result({ id: 4, passed: false, error: "request failed: timeout", latencyMs: null, usage: undefined, cost: null, citationsValid: null }),
    ]);

    assert.equal(summary.passed, 2);
    assert.equal(summary.accuracy, 0.5);
    assert.equal(summary.accuracyZh, 0.5);
    assert.equal(summary.accuracyEn, 0.5);
    assert.equal(summary.citationRate, 2 / 3);
    assert.equal(summary.p50Ms, 1000);
    assert.equal(summary.p95Ms, 3000);
    assert.equal(summary.avgInputTokens, 1000);
    assert.ok(Math.abs(summary.totalCost - 0.03) < 1e-12);
    assert.equal(summary.currency, "CNY");
    assert.equal(summary.requestFailures, 1);
    assert.match(toCsv([summary]).split("\n")[1], /^"deepseek:deepseek-flash",4,2,0\.5,/);
  });
});
