import fs from "node:fs";
import path from "node:path";

export type TestCase = {
  id: number;
  topic: string;
  question: string;
  expectedSources: string[];
  mustInclude: string[];
  mustNotInclude: string[];
  shouldRefuse: boolean;
};

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

export function loadTestCases(): TestCase[] {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/admissions/eval/test-questions.json"), "utf8"));
}

export function isChinese(text: string): boolean {
  return /[㐀-鿿]/.test(text);
}

// Markdown emphasis is removed first so "**not** automatically" matches "not automatically".
function plain(text: string): string {
  return text.replace(/(\*\*|__|\*|_|`)/g, "").toLowerCase();
}

function includesText(text: string, expected: string) {
  return plain(text).includes(expected.toLowerCase());
}

// Substring grading: required phrases present, forbidden phrases absent, expected sources retrieved,
// and a refusal or caution signal when the case expects one. Known to flag some correct answers
// (e.g. "does not guarantee admission" contains "guarantee admission"), so read the failures.
export function gradeAnswer(testCase: TestCase, answer: string, sourceSlugs: string[]): string[] {
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

// Citations are valid when the answer cites at least one source and every [n] refers to a retrieved source.
export function citationsValid(answer: string, sourceCount: number): boolean {
  const numbers = [...answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap((match) => match[1].split(",").map((value) => Number(value.trim())));
  return numbers.length > 0 && numbers.every((number) => number >= 1 && number <= sourceCount);
}
