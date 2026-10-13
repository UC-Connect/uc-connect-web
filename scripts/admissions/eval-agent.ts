import fs from "node:fs";
import path from "node:path";
import { answerQuestion } from "../../lib/admissions/assistant.ts";

type TestCase = {
  id: number;
  topic: string;
  question: string;
  expectedSources: string[];
  mustInclude: string[];
  mustNotInclude: string[];
  shouldRefuse: boolean;
};

// Free-tier Gemini allows about 15 requests per minute; override with EVAL_DELAY_MS.
const DEFAULT_DELAY_MS = 4500;
const REFUSAL_SIGNALS = [
  "could not verify",
  "cannot guarantee",
  "can't guarantee",
  "cannot confirm",
  "can't confirm",
  "cannot write",
  "need",
  "please check",
  "ASSIST",
  "无法",
  "不能",
];

function includesText(text: string, expected: string) {
  return text.toLowerCase().includes(expected.toLowerCase());
}

function checkResult(testCase: TestCase, answer: string, sourceSlugs: string[]) {
  const failures: string[] = [];

  for (const slug of testCase.expectedSources) {
    if (!sourceSlugs.includes(slug)) failures.push(`missing expected source: ${slug}`);
  }

  for (const text of testCase.mustInclude) {
    if (!includesText(answer, text)) failures.push(`answer missing required text: ${text}`);
  }

  for (const text of testCase.mustNotInclude) {
    if (includesText(answer, text)) failures.push(`answer includes forbidden text: ${text}`);
  }

  if (testCase.shouldRefuse && !REFUSAL_SIGNALS.some((signal) => includesText(answer, signal))) {
    failures.push("answer did not show a refusal, caution, or need for verification");
  }

  return failures;
}

async function main() {
  const questions: TestCase[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "content/admissions/eval/test-questions.json"), "utf8")
  );
  const delayMs = Number.parseInt(process.env.EVAL_DELAY_MS ?? "", 10) || DEFAULT_DELAY_MS;
  const results = [];

  for (const [index, testCase] of questions.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    process.stderr.write(`Evaluating ${testCase.id}: ${testCase.question}\n`);

    try {
      const result = await answerQuestion({ question: testCase.question });
      const failures = checkResult(testCase, result.answer, result.sources.map((source) => source.slug));
      results.push({ ...testCase, passed: failures.length === 0, failures, answer: result.answer });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ...testCase, passed: false, failures: [`request failed: ${message}`], answer: "" });
    }
  }

  const passed = results.filter((result) => result.passed).length;
  console.log(JSON.stringify({ summary: { passed, failed: results.length - passed, total: results.length }, results }, null, 2));

  if (passed < results.length) process.exitCode = 1;
}

main();
