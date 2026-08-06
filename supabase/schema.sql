create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  school text not null check (school in ('UCB', 'UCSD', 'UCLA')),
  major text,
  avatar_initials text not null default 'UC',
  bio text,
  verified_uc_email boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  school text not null check (school in ('UCB', 'UCSD', 'UCLA')),
  category text not null,
  mode text not null check (mode in ('线上', '线下')),
  reward_amount numeric(10, 2),
  reward_type text not null default 'paid' check (reward_type in ('paid', 'mutual_help')),
  location text not null,
  due_date date,
  applications_count int not null default 0,
  status text not null default 'open' check (status in ('open', 'matched', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  available_time text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (task_id, applicant_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (task_id, reviewer_id, reviewee_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists tasks_status_created_idx on public.tasks(status, created_at desc);
create index if not exists tasks_school_category_idx on public.tasks(school, category);
create index if not exists tasks_author_idx on public.tasks(author_id);
create index if not exists applications_task_idx on public.applications(task_id);
create index if not exists applications_applicant_idx on public.applications(applicant_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

create or replace function public.refresh_task_applications_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_task_id uuid;
begin
  changed_task_id := coalesce(new.task_id, old.task_id);

  update public.tasks
  set applications_count = (
    select count(*)::int
    from public.applications
    where applications.task_id = changed_task_id
    and applications.status <> 'withdrawn'
  )
  where tasks.id = changed_task_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists applications_refresh_task_count on public.applications;
create trigger applications_refresh_task_count
after insert or update or delete on public.applications
for each row execute function public.refresh_task_applications_count();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_domain text;
begin
  email_domain := split_part(new.email, '@', 2);

  insert into public.profiles (
    id,
    display_name,
    school,
    major,
    avatar_initials,
    verified_uc_email
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'UC Student'),
    coalesce(new.raw_user_meta_data->>'school', 'UCB'),
    new.raw_user_meta_data->>'major',
    upper(left(coalesce(new.raw_user_meta_data->>'display_name', new.email, 'UC'), 2)),
    email_domain in (
      'berkeley.edu',
      'ucla.edu',
      'ucsd.edu',
      'ucsb.edu',
      'uci.edu',
      'ucdavis.edu',
      'ucsc.edu',
      'ucr.edu',
      'ucmerced.edu'
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.applications enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
on public.profiles for select
using (true);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Open tasks are readable by everyone" on public.tasks;
create policy "Open tasks are readable by everyone"
on public.tasks for select
using (status = 'open' or auth.uid() = author_id);

drop policy if exists "Users can create their own tasks" on public.tasks;
create policy "Users can create their own tasks"
on public.tasks for insert
with check (auth.uid() = author_id);

drop policy if exists "Authors can update their own tasks" on public.tasks;
create policy "Authors can update their own tasks"
on public.tasks for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "Authors can delete their own tasks" on public.tasks;
create policy "Authors can delete their own tasks"
on public.tasks for delete
using (auth.uid() = author_id);

drop policy if exists "Related users can read applications" on public.applications;
create policy "Related users can read applications"
on public.applications for select
using (
  auth.uid() = applicant_id
  or exists (
    select 1 from public.tasks
    where tasks.id = applications.task_id
    and tasks.author_id = auth.uid()
  )
);

drop policy if exists "Users can apply to other users tasks" on public.applications;
create policy "Users can apply to other users tasks"
on public.applications for insert
with check (
  auth.uid() = applicant_id
  and exists (
    select 1 from public.tasks
    where tasks.id = applications.task_id
    and tasks.author_id <> auth.uid()
    and tasks.status = 'open'
  )
);

drop policy if exists "Applicants can withdraw applications" on public.applications;
create policy "Applicants can withdraw applications"
on public.applications for update
using (auth.uid() = applicant_id)
with check (auth.uid() = applicant_id and status = 'withdrawn');

drop policy if exists "Task authors can decide applications" on public.applications;
create policy "Task authors can decide applications"
on public.applications for update
using (
  exists (
    select 1 from public.tasks
    where tasks.id = applications.task_id
    and tasks.author_id = auth.uid()
  )
);

drop policy if exists "Reviews are readable by everyone" on public.reviews;
create policy "Reviews are readable by everyone"
on public.reviews for select
using (true);

drop policy if exists "Users can create their own reviews" on public.reviews;
create policy "Users can create their own reviews"
on public.reviews for insert
with check (auth.uid() = reviewer_id);

drop policy if exists "Users can create reports" on public.reports;
create policy "Users can create reports"
on public.reports for insert
with check (auth.uid() = reporter_id);

drop policy if exists "Users can read their own reports" on public.reports;
create policy "Users can read their own reports"
on public.reports for select
using (auth.uid() = reporter_id);
