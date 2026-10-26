# UC Connect

UC Connect is a Supabase-backed campus task and mutual-help MVP for UC students. It helps students post requests, apply to help, manage matches, exchange contact info after acceptance, confirm completion, and rate each other.

## Status

Current app version: `0.3.0`. Version 0.3 adds the UC admissions guide, admissions calculators, and an AI admissions assistant (see [Admissions Guide and AI Assistant](#admissions-guide-and-ai-assistant)).

This is no longer a mock-only prototype. Tasks, profiles, applications, notifications, reports, and reviews are stored in Supabase. Payments and real-time chat are not implemented yet.

## Core Features

- Email/password sign-up and login with Supabase Auth.
- UC school email recognition:
  - UCB: `@berkeley.edu`
  - UCSD: `@ucsd.edu`
  - UCLA: `@g.ucla.edu`
  - Other domains display as unverified school accounts.
- Profile editing for display name, major, contact email, phone, and WeChat ID.
- Task discovery with school, category, and search filters.
- Real Supabase task posting, including free mutual-help tasks and online/offline task rules.
- Shareable task detail pages at `/tasks/[id]`, with legacy `?task=` links still supported.
- Application management: apply, withdraw, accept, reject, and prevent applying to your own task.
- Matched-only contact sharing after an application is accepted.
- Messages page for task notifications such as applications, status updates, completion, and ratings.
- Task completion flow where both matched users confirm completion.
- Star-only ratings from 1 to 5 stars after completion.
- Task report submission.
- Chinese/English language toggle, defaulting to Chinese and saved in the browser.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Auth and Postgres
- Tailwind CSS tooling plus custom CSS
- Vercel deployment

## Getting Started

Prerequisites:

- Node.js 22+ and npm
- A Supabase project

Install and run locally:

```powershell
git clone <your-repo-url>
cd uc-connect-web
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Add these values to `.env.local` for local development and to Vercel Environment Variables for production/preview deployments:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not commit real `.env.local` values.

## Supabase Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Enable email/password authentication.
5. Configure Authentication URL settings:
   - Site URL: your production URL, for example `https://uc-connect-omega.vercel.app`
   - Redirect URLs:
     - `http://localhost:3000/**`
     - `https://your-vercel-domain.vercel.app/**`

The schema file includes tables, RLS policies, triggers, RPC functions, notification logic, contact-sharing rules, reports, and reviews. Re-run the latest `supabase/schema.sql` after database or RPC changes.

## Vercel Deployment

1. Import the GitHub repository into Vercel.
2. Add the two Supabase environment variables for Production and Preview.
3. Push to the `main` branch to trigger a production deployment.
4. After changing environment variables, redeploy the latest deployment.

## Admissions Guide and AI Assistant

`/admissions` summarizes UC first-year and transfer admission requirements from official UC pages. Each topic is a Markdown file in `content/admissions/docs/` with its source URL, applicable cycle, and last-reviewed date in frontmatter. The same files power the topic pages and the AI assistant at `/admissions/ask`.

The assistant retrieves relevant sections with keyword scoring (with Chinese query terms mapped to English and an applicant-type filter), sends them to the configured chat model, and streams an answer that cites sources by number. It is instructed not to predict admission chances, guarantee eligibility, or invent course articulation.

### Architecture

```text
app/admissions/ask (browser)
  └─ POST /api/admissions/chat ─ NDJSON stream (meta → delta… → done)
       ├─ lib/admissions/intents.ts   rule answers (dates, TAG campuses, fees), no model call
       ├─ lib/admissions/cache.ts     pre-generated answers + Supabase cache (keyed by provider:model)
       ├─ lib/admissions/quota.ts     shared rate limits
       └─ lib/admissions/assistant.ts retrieval (retriever.ts) + prompt
            └─ lib/llm  getChatProvider()
                 ├─ config.ts      zod-validated LLM_* settings
                 ├─ fallback.ts    switch to LLM_FALLBACK_PROVIDER before any text streams
                 ├─ pricing.ts / usage.ts   cost estimate + one JSON usage log per answer
                 └─ providers/     openai-compatible.ts (DeepSeek, OpenAI), gemini.ts, mock.ts
```

Only `lib/llm/providers/` may import vendor SDKs or contain vendor API URLs; an ESLint rule enforces this.

### Choosing a model

Set `LLM_PROVIDER` (and optionally `LLM_MODEL`); no code changes are needed. Only the selected providers' keys are required, and a missing or invalid setting fails the first request with a message naming the variable.

```env
LLM_PROVIDER=deepseek          # deepseek | openai | gemini | mock
LLM_MODEL=                     # optional; defaults: deepseek-flash, gpt-6-luna, gemini-flash-lite-latest
LLM_FALLBACK_PROVIDER=gemini   # optional backup when the primary fails before streaming
DEEPSEEK_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
```

Reasoning is turned off for these grounded answers: DeepSeek `thinking: disabled` (`DEEPSEEK_THINKING`) and OpenAI `reasoning_effort: none` (`OPENAI_REASONING_EFFORT`). After switching models, run `npm run admissions:prebuild` so the suggested questions have answers from the new model; until then they fall through to the model.

To add a provider: implement `ChatProvider` (`lib/llm/types.ts`) in `lib/llm/providers/`, or reuse `OpenAICompatibleProvider` with a base URL if the vendor speaks the Chat Completions API. Add its name, default model, and key variable in `lib/llm/config.ts`, a `case` in `createChatProvider` (`lib/llm/index.ts`), prices in `lib/llm/pricing.ts`, and tests with a stubbed `fetch`.

### Latest provider comparison

`npm run eval:providers` on 2026-10-26 (52 questions, 8 in Chinese; full report in [`eval-results/2026-10-26.md`](eval-results/2026-10-26.md)):

| Model | Accuracy | Valid citations | p50 / p95 latency | Cost per 1k answers |
|---|---|---|---|---|
| deepseek-flash (default) | 86.5% | 100% | 1.53 s / 2.53 s | $0.47 |
| gemini-flash-lite-latest | 82.7% | 95.9% | 0.90 s / 2.14 s | $0.78 paid tier (free tier: $0, rate limited) |
| gpt-6-luna | 82.7% | 100% | 1.42 s / 2.78 s | $0.19 |
| gpt-5.4-nano (deprecated) | 82.7% | 100% | 1.55 s / 3.06 s | $0.50 |

All four answered every Chinese question correctly. Accuracy uses a substring grader, and most failures are correct answers it misreads (for example "does not guarantee admission" contains the forbidden phrase "guarantee admission"), so the gaps between models are within grader noise. Cost and latency are the real differences. DeepSeek costs assume peak prices.

Other environment variables:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # enables the answer cache and shared rate limits
ADMISSIONS_DAILY_LIMIT=400                        # site-wide model calls per day
```

How the assistant saves model calls:

- Narrow questions are answered by code first (`lib/admissions/intents.ts`): deadlines from the timeline documents, TAG participation by campus, and application fees. Rule values live in `lib/admissions/rules.ts`, and `npm test` checks that each value still appears in its knowledge-base document.
- Suggested questions use answers pre-generated by `npm run admissions:prebuild` (stored in `content/admissions/cache/`). Re-run it after editing the knowledge base; stale answers are ignored automatically because each file is stamped with a knowledge-base version hash.
- Other standalone questions are cached in Supabase (`admissions_answer_cache`) for 30 days per knowledge-base version. Follow-up questions are never cached.
- Model calls are limited per IP (6/minute, 40/hour, hashed), per user (6/minute, 50/day), and site-wide per day through `admissions_consume_quota`. When a daily cap is reached, the assistant shows related topic pages instead.
- Without `SUPABASE_SERVICE_ROLE_KEY` (or if Supabase fails), the cache is skipped and stricter per-instance limits apply: 3 model calls per client per minute, 15 per hour, 100 per instance per day.

Abuse and cost limits (`lib/admissions/guards.ts`, `lib/admissions/quota.ts`):

- The assistant is for signed-in users only: the page sends the Supabase access token, and the API verifies it (`lib/admissions/auth.ts`) before answering anything, including rule and cached answers. Each user gets 50 model calls per day (`ADMISSIONS_USER_DAILY_LIMIT`) and one answer at a time; cross-site browser requests are rejected. Topic pages and calculators stay public.
- Questions are capped at 500 characters and history at the last 4 turns. Earlier answers count as context only if they carry the server's signature (`ADMISSIONS_HISTORY_SECRET`), so a client cannot forge assistant turns to stuff the prompt. The estimated prompt size is checked before every model call.
- Questions that retrieve nothing get a fixed "UC admissions only" reply without a model call; with no sources the model could only decline anyway.
- A site-wide daily spend budget (`ADMISSIONS_DAILY_BUDGET_CNY`, default ¥5) is tracked in Supabase from each call's token usage; once it is reached, the assistant shows related topic pages instead of calling the model.
- `ADMISSIONS_AI_ENABLED=false` turns off model calls immediately; rules, cached answers, topic pages, and calculators keep working.

Calculators at `/admissions/tools` (UC GPA with a statewide top-9% estimate, A-G checker, application fees) use the same rules module and run entirely in the browser.

Evaluation and tests:

```bash
npm test                 # rules, calculators, and rule-based answers
npm run eval:retrieval   # offline: checks that expected sources are retrieved
npm run eval:agent       # calls the configured model for every test question
npm run eval:providers -- --providers deepseek,gemini,openai,openai:gpt-5.4-nano   # side-by-side report in eval-results/
```

Yearly maintenance: update the two dates documents (`freshman-dates-and-deadlines.md`, `uc-dates-and-deadlines.md`), bump `last_reviewed` on any re-checked topic, update `lib/admissions/presentation.ts` highlights if a requirement changes, then run `npm run admissions:prebuild`.

## Main Workflows

- Publish a task: logged-in users create a task that is saved to Supabase.
- Apply to a task: other users can apply, but the publisher cannot apply to their own task.
- Accept an applicant: the task moves from recruiting to in progress, and other applications are rejected.
- Contact the matched user: contact info is shown only after matching.
- Complete a task: both sides confirm completion.
- Rate the other user: each side can give a 1-5 star rating after completion.
- Report a task: users can submit a report for review.

## Current Limitations

- No payment processing. Rewards are display-only for now.
- No real-time chat. Matched users contact each other through profile contact info.
- No admin/report review dashboard yet, although report submission exists.
- No file or image uploads.
- Email delivery depends on Supabase Auth/email provider configuration.
- Only UCB, UCSD, and UCLA email domains are recognized as verified schools.
- No native mobile app.

## Project Structure

```text
app/page.tsx             Main product UI and client workflow logic
app/admissions/          UC admissions guide, topic pages, calculators, and AI assistant UI
app/api/admissions/chat  Streaming admissions assistant API
lib/admissions/          Knowledge-base loader, retriever, assistant, rules, cache, rate limits
lib/llm/                 Model provider layer (DeepSeek, OpenAI, Gemini, mock), fallback, pricing, usage logs
content/admissions/      Admissions knowledge base (Markdown), system prompt, eval questions
scripts/admissions/      Retrieval/answer/provider evaluation and answer pre-generation scripts
eval-results/            Provider comparison reports (.md, .csv)
tests/                   Unit tests (rules, rule answers, LLM providers, eval reports); no network calls
app/tasks/[id]/page.tsx  Shareable task detail route
app/globals.css          App styling
lib/supabase.ts          Supabase client and shared types
supabase/schema.sql      Database schema, RLS policies, triggers, and RPCs
CHANGELOG.md            Product and technical change log
.env.example            Environment variable template
```

## Useful Commands

```powershell
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm test
```

## CI/CD

- **CI** (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `main`: lint, typecheck, unit tests, the offline retrieval eval (fails below 50/51 matched), and a production build. It makes no model calls.
- **Provider eval** (`.github/workflows/eval.yml`) runs only when started by hand from the Actions tab, because it calls paid APIs. It needs `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, and `GEMINI_API_KEY` repository secrets and uploads the report as an artifact.
- **CD** is Vercel's Git integration: every pull request gets a preview deployment, and `main` deploys to production.

## Project Notes

- Update `CHANGELOG.md` for every product, code, database, or documentation change.
- Keep user-generated task titles, descriptions, and contact content in the user's original language.
- Re-run the Supabase schema after SQL/RPC updates before testing affected flows.
