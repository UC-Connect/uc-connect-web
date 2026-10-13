import fs from "node:fs";
import path from "node:path";
import { retrieve } from "../../lib/admissions/retriever.ts";

type TestCase = { id: number; topic: string; question: string; expectedSources: string[] };

const questions: TestCase[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "content/admissions/eval/test-questions.json"), "utf8")
);

const results = questions.map((item) => {
  const retrieval = retrieve(item.question);
  const slugs = retrieval.sources.map((source) => source.slug);
  const expected = item.expectedSources;

  return {
    id: item.id,
    topic: item.topic,
    question: item.question,
    audience: retrieval.audience,
    expected,
    retrieved: slugs,
    topMatched: expected.length ? expected.includes(slugs[0]) : null,
    matchedExpected: expected.length ? expected.every((slug) => slugs.includes(slug)) : null,
  };
});

const scored = results.filter((result) => result.matchedExpected !== null);
const summary = {
  total: scored.length,
  matched: scored.filter((result) => result.matchedExpected).length,
  topMatched: scored.filter((result) => result.topMatched).length,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ summary, results }, null, 2));
} else {
  console.log(`Expected sources in top 5: ${summary.matched}/${summary.total}`);
  console.log(`Expected source ranked first: ${summary.topMatched}/${summary.total}`);

  for (const result of scored.filter((item) => !item.matchedExpected || !item.topMatched)) {
    const label = result.matchedExpected ? "rank" : "MISS";
    console.log(`  [${label}] #${result.id} ${result.question} -> ${result.retrieved.join(", ") || "(none)"}`);
  }
}
