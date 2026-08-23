# UC Connect

UC Connect is a Supabase-backed campus task and mutual-help MVP for UC students. It helps students post requests, apply to help, manage matches, exchange contact info after acceptance, confirm completion, and rate each other.

## Status

Current app version: `0.2.0` package / `v0.2.x` MVP.

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
```

## Project Notes

- Update `CHANGELOG.md` for every product, code, database, or documentation change.
- Keep user-generated task titles, descriptions, and contact content in the user's original language.
- Re-run the Supabase schema after SQL/RPC updates before testing affected flows.
