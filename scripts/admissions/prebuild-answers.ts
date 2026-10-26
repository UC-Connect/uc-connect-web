// Pre-generates answers for the suggested questions so the most common clicks cost no model
// calls. Re-run after editing the knowledge base or system prompt; entries already generated
// for the current knowledge-base version are kept, so an interrupted run can be resumed.
import { answerQuestion } from "../../lib/admissions/assistant.ts";
import { normalizeQuestion, readPrebuiltFile, writePrebuiltFile, type CachedAnswer } from "../../lib/admissions/cache.ts";
import { getKnowledgeBaseVersion } from "../../lib/admissions/content.ts";
import { getModelIdentity } from "../../lib/llm/index.ts";
import { SUGGESTED_QUESTIONS, type ApplicantType } from "../../lib/admissions/presentation.ts";

// Free-tier Gemini allows about 15 requests per minute; override with PREBUILD_DELAY_MS.
const DEFAULT_DELAY_MS = 4500;

async function main() {
  const kbVersion = getKnowledgeBaseVersion();
  const identity = getModelIdentity();

  if (!identity) {
    throw new Error("The LLM settings are invalid; check LLM_PROVIDER and its API key.");
  }

  const existing = readPrebuiltFile();
  const reusable = existing?.kbVersion === kbVersion && existing.provider === identity.provider && existing.model === identity.model;
  const answers: CachedAnswer[] = reusable ? [...existing.answers] : [];
  const delayMs = Number.parseInt(process.env.PREBUILD_DELAY_MS ?? "", 10) || DEFAULT_DELAY_MS;
  const targets = (Object.keys(SUGGESTED_QUESTIONS) as ApplicantType[]).flatMap((audience) =>
    SUGGESTED_QUESTIONS[audience].flatMap((item) => [item.zh, item.en].map((question) => ({ question, audience })))
  );
  const pending = targets.filter(
    (target) => !answers.some((entry) => normalizeQuestion(entry.question) === normalizeQuestion(target.question))
  );
  let failures = 0;

  console.log(`Knowledge base ${kbVersion}, ${identity.provider}:${identity.model}: ${answers.length} cached, ${pending.length} to generate.`);

  for (const [index, target] of pending.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    try {
      const result = await answerQuestion(target);
      if (result.fallback) {
        throw new Error(`answered by the fallback (${result.provider}:${result.model}), not ${identity.provider}:${identity.model}`);
      }

      answers.push({ ...target, answer: result.answer, sources: result.sources, provider: result.provider, model: result.model });
      writePrebuiltFile({ kbVersion, generatedAt: new Date().toISOString(), ...identity, answers });
      console.log(`  ok   ${target.question}`);
    } catch (error) {
      failures += 1;
      console.log(`  FAIL ${target.question}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`Done: ${answers.length}/${targets.length} cached.${failures ? ` ${failures} failed; re-run to retry.` : ""}`);
  if (failures) process.exitCode = 1;
}

main();
