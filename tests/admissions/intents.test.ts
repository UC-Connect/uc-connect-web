import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { answerWithRules } from "../../lib/admissions/intents.ts";

describe("answerWithRules", () => {
  it("answers fall 2027 first-year filing dates in Chinese", () => {
    const result = answerWithRules("2027 秋季新生申请什么时候截止？");
    assert.equal(result?.intent, "dates");
    assert.match(result!.answer, /2026 年 10 月 1 日至 11 月 30 日/);
    assert.deepEqual(result!.sources.map((source) => source.slug), ["freshman-dates-and-deadlines"]);
  });

  it("answers TAG filing dates for transfer applicants in English", () => {
    const result = answerWithRules("When is the TAG deadline?");
    assert.equal(result?.intent, "dates");
    assert.match(result!.answer, /September 1 - 30, 2026/);
    assert.deepEqual(result!.sources.map((source) => source.slug), ["uc-dates-and-deadlines"]);
  });

  it("answers both timelines when the applicant type is unknown", () => {
    const result = answerWithRules("When is the SIR deadline?");
    assert.match(result!.answer, /May 1, 2027/);
    assert.match(result!.answer, /June 1, 2027/);
  });

  it("uses the selected applicant type", () => {
    const result = answerWithRules("When is the SIR deadline?", "transfer");
    assert.doesNotMatch(result!.answer, /May 1, 2027/);
    assert.match(result!.answer, /June 1, 2027/);
  });

  it("answers TAG participation per campus", () => {
    const result = answerWithRules("UCLA 和 UC Davis 参加 TAG 吗？");
    assert.equal(result?.intent, "tag-campus");
    assert.match(result!.answer, /UC Davis\*\*：参加 TAG/);
    assert.match(result!.answer, /UCLA\*\*：不参加 TAG/);
  });

  it("computes application fees", () => {
    const zh = answerWithRules("申请 6 个校区要多少申请费？");
    assert.equal(zh?.intent, "fees");
    assert.match(zh!.answer, /\$480/);
    assert.match(zh!.answer, /\$160/);
    assert.match(answerWithRules("How much does it cost to apply to all campuses as an international student?")!.answer, /\$855/);
  });

  it("leaves explanation and requirement questions to the model", () => {
    assert.equal(answerWithRules("How do I prepare for the November 30 deadline?"), null);
    assert.equal(answerWithRules("What GPA do I need for TAG at UC Davis?"), null);
    assert.equal(answerWithRules("What is TAG?"), null);
    assert.equal(answerWithRules("How much is the application fee?"), null);
    assert.equal(answerWithRules("UC 看 SAT 成绩吗？"), null);
  });
});
