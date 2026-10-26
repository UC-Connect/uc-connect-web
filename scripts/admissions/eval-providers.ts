// Runs the admissions eval questions against several providers and writes a comparison report.
//   npm run eval:providers -- --providers deepseek,gemini,openai,openai:gpt-5.4-nano [--limit 10] [--out eval-results]
// Each entry is a provider name with an optional :model. Providers without an API key are skipped.
import fs from "node:fs";
import path from "node:path";
import { answerQuestion } from "../../lib/admissions/assistant.ts";
import { DEFAULT_MODELS, loadLLMConfig, PROVIDER_NAMES, type ProviderName } from "../../lib/llm/config.ts";
import { createChatProvider, estimateCost } from "../../lib/llm/index.ts";
import { citationsValid, gradeAnswer, isChinese, loadTestCases, type TestCase } from "./grading.ts";
import { summarize, toCsv, toMarkdown, type CaseResult } from "./eval-report.ts";

const API_KEYS: Record<ProviderName, string | undefined> = {
  deepseek: process.env.DEEPSEEK_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
  mock: "",
};

// The Gemini free tier allows about 15 requests per minute.
const DELAY_MS: Record<ProviderName, number> = { deepseek: 200, openai: 200, gemini: 4500, mock: 0 };

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function runProvider(label: string, name: ProviderName, model: string, cases: TestCase[]): Promise<CaseResult[]> {
  // Shared settings (timeout, retries, reasoning off) come from the normal LLM_* variables.
  const settings = loadLLMConfig({ ...process.env, LLM_PROVIDER: "mock", LLM_FALLBACK_PROVIDER: "" });
  const provider = createChatProvider({ provider: name, model, apiKey: API_KEYS[name] ?? "" }, settings);
  const results: CaseResult[] = [];

  for (const [index, testCase] of cases.entries()) {
    if (index > 0 && DELAY_MS[name]) await new Promise((resolve) => setTimeout(resolve, DELAY_MS[name]));
    process.stderr.write(`[${label}] ${index + 1}/${cases.length} #${testCase.id}\n`);

    const base = { id: testCase.id, question: testCase.question, chinese: isChinese(testCase.question), shouldRefuse: testCase.shouldRefuse };

    try {
      const result = await answerQuestion({ question: testCase.question, provider, maxTokens: settings.maxOutputTokens });
      const failures = gradeAnswer(testCase, result.answer, result.sources.map((source) => source.slug));
      results.push({
        ...base,
        passed: failures.length === 0,
        failures,
        citationsValid: citationsValid(result.answer, result.sources.length),
        latencyMs: result.latencyMs ?? null,
        usage: result.usage,
        cost: estimateCost(name, model, result.usage),
        answer: result.answer,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ...base, passed: false, failures: [], citationsValid: null, latencyMs: null, cost: null, error: `request failed: ${message}`, answer: "" });
    }
  }

  return results;
}

async function main() {
  const specs = (argument("providers") ?? "deepseek,gemini,openai").split(",").map((entry) => entry.trim()).filter(Boolean);
  const limit = Number(argument("limit")) || undefined;
  const outDir = path.resolve(argument("out") ?? "eval-results");
  const cases = loadTestCases().slice(0, limit);
  const runs: { label: string; name: ProviderName; model: string }[] = [];

  for (const spec of specs) {
    const [name, model] = spec.split(":") as [ProviderName, string | undefined];

    if (!PROVIDER_NAMES.includes(name)) {
      throw new Error(`Unknown provider "${name}". Use one of: ${PROVIDER_NAMES.join(", ")}.`);
    }

    if (name !== "mock" && !API_KEYS[name]) {
      console.warn(`Skipping ${spec}: no API key in the environment.`);
      continue;
    }

    const resolvedModel = model ?? DEFAULT_MODELS[name];
    runs.push({ label: `${name}:${resolvedModel}`, name, model: resolvedModel });
  }

  if (runs.length === 0) {
    throw new Error("No providers to evaluate. Set DEEPSEEK_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY.");
  }

  // Providers run in parallel; questions within a provider run one at a time.
  const details = Object.fromEntries(await Promise.all(runs.map(async (run) => [run.label, await runProvider(run.label, run.name, run.model, cases)] as const)));
  const summaries = runs.map((run) => summarize(run.label, details[run.label]));
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const notes = [
    `${cases.length} questions from content/admissions/eval/test-questions.json (${cases.filter((testCase) => isChinese(testCase.question)).length} in Chinese).`,
    "Accuracy uses the substring grader in scripts/admissions/grading.ts, which flags some correct answers (for example negations); read the failed questions before comparing small differences.",
    "Valid citations: answers to non-refusal questions that cite at least one source and only cite retrieved sources.",
    "Latency is measured from the request until the last streamed token. Cost uses lib/llm/pricing.ts (DeepSeek peak prices; Gemini paid-tier prices, though the free tier costs nothing).",
    "Settings: temperature 0.2 where supported, DeepSeek thinking disabled, OpenAI reasoning effort none, same retrieval and prompt for every provider.",
  ];

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${date}.md`), toMarkdown(date, summaries, details, notes));
  fs.writeFileSync(path.join(outDir, `${date}.csv`), toCsv(summaries));
  fs.writeFileSync(path.join(outDir, `${date}-details.json`), `${JSON.stringify(details, null, 2)}\n`);

  for (const summary of summaries) {
    console.log(`${summary.label}: ${summary.passed}/${summary.total} passed, p50 ${summary.p50Ms ?? "—"} ms, ${summary.totalCost.toFixed(4)} ${summary.currency}, ${summary.requestFailures} request failures`);
  }

  console.log(`Report: ${path.relative(process.cwd(), path.join(outDir, `${date}.md`))}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
