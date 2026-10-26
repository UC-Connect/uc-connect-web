// Prints the last 7 days of assistant usage and exits with an error when today's spend or model calls
// pass ALERT_RATIO (default 0.7) of the daily limits. Run hourly by .github/workflows/usage-alert.yml;
// a failed scheduled run makes GitHub email the repository owner.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Row = { day: string; model_calls: number; spend_cny: number; blocked_subjects: number };

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.log("Supabase is not configured for the usage check; skipping.");
    return;
  }

  const budget = positive(process.env.ADMISSIONS_DAILY_BUDGET_CNY, 5);
  const callLimit = positive(process.env.ADMISSIONS_DAILY_LIMIT, 400);
  const ratio = positive(process.env.ALERT_RATIO, 0.7);
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("admissions_usage_report", { p_days: 7 });

  if (error) {
    throw new Error(`Usage report failed: ${error.message}`);
  }

  const rows = (data ?? []) as Row[];
  const today = rows[0] ?? { day: "today", model_calls: 0, spend_cny: 0, blocked_subjects: 0 };
  const spendShare = Number(today.spend_cny) / budget;
  const callShare = today.model_calls / callLimit;
  const report = [
    "## Admissions assistant usage (UTC days)",
    "",
    `Today: ¥${Number(today.spend_cny).toFixed(3)} of ¥${budget} budget (${(spendShare * 100).toFixed(0)}%), ${today.model_calls} of ${callLimit} model calls (${(callShare * 100).toFixed(0)}%).`,
    "",
    "| Day | Model calls | Spend (CNY) | Newly blocked |",
    "|---|---|---|---|",
    ...rows.map((row) => `| ${row.day} | ${row.model_calls} | ${Number(row.spend_cny).toFixed(3)} | ${row.blocked_subjects} |`),
    "",
  ].join("\n");

  console.log(report);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);
  }

  if (spendShare >= ratio || callShare >= ratio) {
    console.error(`ALERT: today's usage passed ${Math.round(ratio * 100)}% of a daily limit. Consider ADMISSIONS_AI_ENABLED=false or checking the logs for abuse.`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
