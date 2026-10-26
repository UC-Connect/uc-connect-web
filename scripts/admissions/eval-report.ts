import type { CostEstimate } from "../../lib/llm/pricing.ts";
import type { TokenUsage } from "../../lib/llm/types.ts";

export type CaseResult = {
  id: number;
  question: string;
  chinese: boolean;
  shouldRefuse: boolean;
  passed: boolean;
  failures: string[];
  citationsValid: boolean | null;
  latencyMs: number | null;
  usage?: TokenUsage;
  cost: CostEstimate | null;
  error?: string;
  answer: string;
};

export type ProviderSummary = {
  label: string;
  total: number;
  passed: number;
  accuracy: number;
  accuracyZh: number | null;
  accuracyEn: number | null;
  citationRate: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  avgInputTokens: number | null;
  avgOutputTokens: number | null;
  totalCost: number;
  currency: string;
  totalUsd: number;
  requestFailures: number;
};

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function rate(cases: CaseResult[], predicate: (result: CaseResult) => boolean): number | null {
  return cases.length ? cases.filter(predicate).length / cases.length : null;
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarize(label: string, results: CaseResult[]): ProviderSummary {
  const answered = results.filter((result) => !result.error);
  const citable = answered.filter((result) => !result.shouldRefuse && result.citationsValid !== null);
  const costs = answered.map((result) => result.cost).filter((cost): cost is CostEstimate => cost !== null);

  return {
    label,
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    accuracy: rate(results, (result) => result.passed) ?? 0,
    accuracyZh: rate(results.filter((result) => result.chinese), (result) => result.passed),
    accuracyEn: rate(results.filter((result) => !result.chinese), (result) => result.passed),
    citationRate: rate(citable, (result) => result.citationsValid === true),
    p50Ms: percentile(answered.flatMap((result) => (result.latencyMs === null ? [] : [result.latencyMs])), 50),
    p95Ms: percentile(answered.flatMap((result) => (result.latencyMs === null ? [] : [result.latencyMs])), 95),
    avgInputTokens: average(answered.flatMap((result) => (result.usage ? [result.usage.inputTokens] : []))),
    avgOutputTokens: average(answered.flatMap((result) => (result.usage ? [result.usage.outputTokens] : []))),
    totalCost: costs.reduce((sum, cost) => sum + cost.amount, 0),
    currency: costs[0]?.currency ?? "",
    totalUsd: costs.reduce((sum, cost) => sum + cost.usd, 0),
    requestFailures: results.length - answered.length,
  };
}

const percent = (value: number | null) => (value === null ? "—" : `${(value * 100).toFixed(1)}%`);
const ms = (value: number | null) => (value === null ? "—" : `${(value / 1000).toFixed(2)} s`);
const tokens = (value: number | null) => (value === null ? "—" : Math.round(value).toString());

export function toMarkdown(date: string, summaries: ProviderSummary[], details: Record<string, CaseResult[]>, notes: string[]): string {
  const header = "| Provider | Accuracy | 中文 | English | Valid citations | p50 | p95 | Avg input tok | Avg output tok | Cost (run) | Cost / 1k answers (USD) | Request failures |";
  const divider = "|---|---|---|---|---|---|---|---|---|---|---|---|";
  const rows = summaries.map((summary) =>
    [
      summary.label,
      `${percent(summary.accuracy)} (${summary.passed}/${summary.total})`,
      percent(summary.accuracyZh),
      percent(summary.accuracyEn),
      percent(summary.citationRate),
      ms(summary.p50Ms),
      ms(summary.p95Ms),
      tokens(summary.avgInputTokens),
      tokens(summary.avgOutputTokens),
      summary.currency ? `${summary.totalCost.toFixed(4)} ${summary.currency}` : "—",
      summary.total ? `$${((summary.totalUsd / Math.max(1, summary.total - summary.requestFailures)) * 1000).toFixed(2)}` : "—",
      summary.requestFailures,
    ].join(" | ")
  );
  const failureSections = summaries.map((summary) => {
    const failed = (details[summary.label] ?? []).filter((result) => !result.passed);
    const lines = failed.map((result) => `- #${result.id} ${result.question}: ${result.error ?? result.failures.join("; ")}`);
    return [`### ${summary.label}`, "", ...(lines.length ? lines : ["- none"])].join("\n");
  });

  return [
    `# Admissions assistant provider comparison (${date})`,
    "",
    ...notes.map((note) => `- ${note}`),
    "",
    header,
    divider,
    ...rows.map((row) => `| ${row} |`),
    "",
    "## Failed questions",
    "",
    ...failureSections.flatMap((section) => [section, ""]),
  ].join("\n");
}

export function toCsv(summaries: ProviderSummary[]): string {
  const columns: (keyof ProviderSummary)[] = [
    "label", "total", "passed", "accuracy", "accuracyZh", "accuracyEn", "citationRate", "p50Ms", "p95Ms",
    "avgInputTokens", "avgOutputTokens", "totalCost", "currency", "totalUsd", "requestFailures",
  ];
  const cell = (value: unknown) => (value === null || value === undefined ? "" : typeof value === "number" ? Number(value.toFixed(6)).toString() : `"${String(value).replace(/"/g, '""')}"`);
  return [columns.join(","), ...summaries.map((summary) => columns.map((column) => cell(summary[column])).join(","))].join("\n") + "\n";
}
