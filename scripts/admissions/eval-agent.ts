import { answerQuestion } from "../../lib/admissions/assistant.ts";
import { gradeAnswer, loadTestCases } from "./grading.ts";

// Free-tier Gemini allows about 15 requests per minute; override with EVAL_DELAY_MS.
const DEFAULT_DELAY_MS = 4500;

async function main() {
  const questions = loadTestCases();
  const delayMs = Number.parseInt(process.env.EVAL_DELAY_MS ?? "", 10) || DEFAULT_DELAY_MS;
  const results = [];

  for (const [index, testCase] of questions.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    process.stderr.write(`Evaluating ${testCase.id}: ${testCase.question}\n`);

    try {
      const result = await answerQuestion({ question: testCase.question });
      const failures = gradeAnswer(testCase, result.answer, result.sources.map((source) => source.slug));
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
