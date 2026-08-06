UC Connect Demo

UC Connect is a campus task and mutual-help platform designed for students across the University of California system. It allows students to discover requests, offer help, and connect with people at UC Berkeley, UC San Diego, UCLA, and eventually other UC campuses.

This repository contains an interactive front-end prototype. It uses mock data and does not currently include a database, real user accounts, or payment processing.

Features

Browse and search campus tasks

Filter tasks by school and category

View task details and submit a mock application

Complete a guided task-posting flow

View posted tasks and submitted applications

Explore a sample user profile and reviews

Responsive design for desktop and mobile devices

Tech Stack

Next.js 16

React 19

TypeScript

Tailwind CSS 4

Getting Started

Prerequisites

Node.js 22 or later

npm

Installation

Clone the repository and install its dependencies:

git clone <your-repository-url>
cd uc-connect
npm install

Start the development server:

npm run dev

Open the local URL shown in your terminal, usually http://localhost:3000.

Supabase MVP Setup

The app can still render demo data without Supabase, but the MVP flow uses Supabase for login, tasks, and applications.

1. Create a Supabase project.

2. Open the Supabase SQL editor and run:

```sql
-- paste and run supabase/schema.sql
```

3. Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Install the new Supabase client dependency:

```bash
npm install
```

5. Start the app:

```bash
npm run dev
```

MVP Flow

The current MVP supports:

- Email and password login through Supabase Auth
- Automatic profile creation for new users
- Public browsing of open tasks
- Creating tasks as a logged-in user
- Applying to tasks as a logged-in user
- Viewing recently posted tasks in "My Tasks"

Google login, real-time messages, application management, payments, and full review workflows are intentionally left for later iterations.

Production Build

To create and run a production build locally:

npm run build
npm run start

Project Structure

app/page.tsx — Page content, mock task data, and interactive behavior

app/globals.css — Global styles and responsive design rules

app/layout.tsx — Site metadata and root layout

public/favicon.svg — Website icon

Deployment

UC Connect is a standard Next.js project and can be deployed directly through Vercel:

Push the project to a GitHub repository.

Import the repository into Vercel.

Keep the default Next.js build settings.

Deploy the project.

Future pushes to the repository's main branch will automatically trigger a new deployment. The project can also be hosted on any platform that supports Next.js.

Current Limitations

All tasks and user profiles use mock data.

Posted tasks and applications are not saved after the page is refreshed.

The login interface does not create or authenticate real accounts.

Supabase, payments, email notifications, and other backend services are not connected.

Planned Next Steps

Test the prototype with students from UCB, UCSD, and UCLA

Improve the interface and user flow based on feedback

Add authentication and UC email verification

Connect Supabase for persistent tasks, applications, reviews, and profiles

Add moderation, reporting, and notification tools

Project Status

UC Connect is currently an early-stage prototype intended for product testing and feedback.
Deployment updated.