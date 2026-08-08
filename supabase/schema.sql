create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  school text not null check (school in ('UCB', 'UCSD', 'UCLA')),
  major text,
  contact_email text,
  phone text,
  wechat_id text,
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
  author_completed_at timestamptz,
  applicant_completed_at timestamptz,
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

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('new_application', 'application_status', 'completion_waiting', 'task_completed', 'review_received')),
  title text not null,
  body text not null,
  task_id uuid references public.tasks(id) on delete cascade,
  application_id uuid references public.applications(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists tasks_status_created_idx on public.tasks(status, created_at desc);
create index if not exists tasks_school_category_idx on public.tasks(school, category);
create index if not exists tasks_author_idx on public.tasks(author_id);
create index if not exists applications_task_idx on public.applications(task_id);
create index if not exists applications_applicant_idx on public.applications(applicant_id);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id, read_at) where read_at is null;

alter table public.profiles add column if not exists contact_email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists wechat_id text;
alter table public.tasks add column if not exists author_completed_at timestamptz;
alter table public.tasks add column if not exists applicant_completed_at timestamptz;

grant usage on schema public to anon, authenticated;
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, school, major, avatar_initials, bio, verified_uc_email, created_at, updated_at) on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.tasks to anon, authenticated;
grant insert, update, delete on public.tasks to authenticated;
grant select, insert, update on public.applications to authenticated;
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant select, insert on public.reports to authenticated;
grant select, update on public.notifications to authenticated;

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

create or replace function public.prevent_self_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.tasks
    where tasks.id = new.task_id
    and tasks.author_id = new.applicant_id
  ) then
    raise exception 'Task authors cannot apply to their own tasks';
  end if;

  return new;
end;
$$;

drop trigger if exists applications_prevent_self_application on public.applications;
create trigger applications_prevent_self_application
before insert or update of applicant_id, task_id on public.applications
for each row execute function public.prevent_self_application();

create or replace function public.validate_review_participants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_author uuid;
  accepted_applicant uuid;
begin
  select tasks.author_id
  into task_author
  from public.tasks
  where tasks.id = new.task_id
  and tasks.status = 'completed';

  if task_author is null then
    raise exception 'Reviews can only be created for completed tasks';
  end if;

  select applications.applicant_id
  into accepted_applicant
  from public.applications
  where applications.task_id = new.task_id
  and applications.status = 'accepted'
  limit 1;

  if accepted_applicant is null then
    raise exception 'Reviews require an accepted application';
  end if;

  if not (
    (new.reviewer_id = task_author and new.reviewee_id = accepted_applicant)
    or
    (new.reviewer_id = accepted_applicant and new.reviewee_id = task_author)
  ) then
    raise exception 'Reviewer and reviewee must be matched task participants';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_validate_participants on public.reviews;
create trigger reviews_validate_participants
before insert or update of task_id, reviewer_id, reviewee_id on public.reviews
for each row execute function public.validate_review_participants();

create or replace function public.get_my_profile()
returns table (
  id uuid,
  display_name text,
  school text,
  major text,
  contact_email text,
  phone text,
  wechat_id text,
  avatar_initials text,
  verified_uc_email boolean
)
language sql
security definer
set search_path = public
as $$
  select
    profiles.id,
    profiles.display_name,
    profiles.school,
    profiles.major,
    profiles.contact_email,
    profiles.phone,
    profiles.wechat_id,
    profiles.avatar_initials,
    profiles.verified_uc_email
  from public.profiles
  where profiles.id = auth.uid();
$$;

grant execute on function public.get_my_profile() to authenticated;

create or replace function public.get_matched_contact(target_profile_id uuid, target_task_id uuid)
returns table (
  display_name text,
  contact_email text,
  phone text,
  wechat_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester uuid;
  task_author uuid;
  accepted_applicant uuid;
begin
  requester := auth.uid();

  if requester is null then
    raise exception 'Login required';
  end if;

  select tasks.author_id
  into task_author
  from public.tasks
  where tasks.id = target_task_id;

  select applications.applicant_id
  into accepted_applicant
  from public.applications
  where applications.task_id = target_task_id
  and applications.status = 'accepted'
  limit 1;

  if not (
    requester = target_profile_id
    or (requester = task_author and target_profile_id = accepted_applicant)
    or (requester = accepted_applicant and target_profile_id = task_author)
  ) then
    raise exception 'Contact info is only available to matched task participants';
  end if;

  return query
  select
    profiles.display_name,
    profiles.contact_email,
    profiles.phone,
    profiles.wechat_id
  from public.profiles
  where profiles.id = target_profile_id;
end;
$$;

grant execute on function public.get_matched_contact(uuid, uuid) to authenticated;

create or replace function public.create_notification(
  target_user_id uuid,
  notification_type text,
  notification_title text,
  notification_body text,
  target_task_id uuid default null,
  target_application_id uuid default null,
  target_review_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    task_id,
    application_id,
    review_id
  )
  values (
    target_user_id,
    notification_type,
    notification_title,
    notification_body,
    target_task_id,
    target_application_id,
    target_review_id
  );
end;
$$;

create or replace function public.notify_application_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_author uuid;
  task_title text;
  applicant_name text;
begin
  select tasks.author_id, tasks.title
  into task_author, task_title
  from public.tasks
  where tasks.id = new.task_id;

  select profiles.display_name
  into applicant_name
  from public.profiles
  where profiles.id = new.applicant_id;

  perform public.create_notification(
    task_author,
    'new_application',
    '收到新的任务申请',
    coalesce(applicant_name, 'UC Student') || ' 申请了「' || coalesce(task_title, '任务') || '」',
    new.task_id,
    new.id,
    null
  );

  return new;
end;
$$;

drop trigger if exists applications_notify_insert on public.applications;
create trigger applications_notify_insert
after insert on public.applications
for each row execute function public.notify_application_insert();

create or replace function public.notify_application_status_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_title text;
  status_label text;
begin
  if new.status = old.status then
    return new;
  end if;

  select tasks.title
  into task_title
  from public.tasks
  where tasks.id = new.task_id;

  status_label := case new.status
    when 'accepted' then '已接受'
    when 'rejected' then '未通过'
    when 'withdrawn' then '已撤回'
    else '等待回复'
  end;

  perform public.create_notification(
    new.applicant_id,
    'application_status',
    '申请状态已更新',
    '你申请的「' || coalesce(task_title, '任务') || '」当前状态：' || status_label,
    new.task_id,
    new.id,
    null
  );

  return new;
end;
$$;

drop trigger if exists applications_notify_status_update on public.applications;
create trigger applications_notify_status_update
after update of status on public.applications
for each row execute function public.notify_application_status_update();

create or replace function public.notify_task_completion_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepted_applicant uuid;
begin
  select applications.applicant_id
  into accepted_applicant
  from public.applications
  where applications.task_id = new.id
  and applications.status = 'accepted'
  limit 1;

  if accepted_applicant is null then
    return new;
  end if;

  if new.status = 'completed' and old.status <> 'completed' then
    perform public.create_notification(new.author_id, 'task_completed', '任务已完成，可进行评价', '「' || new.title || '」已完成。', new.id, null, null);
    perform public.create_notification(accepted_applicant, 'task_completed', '任务已完成，可进行评价', '「' || new.title || '」已完成。', new.id, null, null);
  elsif new.applicant_completed_at is not null and old.applicant_completed_at is null and new.author_completed_at is null then
    perform public.create_notification(new.author_id, 'completion_waiting', '任务等待完成确认', '对方已确认完成「' || new.title || '」，请你确认。', new.id, null, null);
  elsif new.author_completed_at is not null and old.author_completed_at is null and new.applicant_completed_at is null then
    perform public.create_notification(accepted_applicant, 'completion_waiting', '任务等待完成确认', '对方已确认完成「' || new.title || '」，请你确认。', new.id, null, null);
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_notify_completion_update on public.tasks;
create trigger tasks_notify_completion_update
after update of status, author_completed_at, applicant_completed_at on public.tasks
for each row execute function public.notify_task_completion_update();

create or replace function public.notify_review_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.create_notification(
    new.reviewee_id,
    'review_received',
    '收到新的评分',
    '你收到了一条 ' || new.rating || ' 星评分。',
    new.task_id,
    null,
    new.id
  );

  return new;
end;
$$;

drop trigger if exists reviews_notify_insert on public.reviews;
create trigger reviews_notify_insert
after insert on public.reviews
for each row execute function public.notify_review_insert();

create or replace function public.confirm_task_completion(target_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  task_author uuid;
  accepted_applicant uuid;
begin
  select tasks.author_id
  into task_author
  from public.tasks
  where tasks.id = target_task_id
  and tasks.status in ('matched', 'in_progress');

  if task_author is null then
    raise exception 'Task is not ready for completion confirmation';
  end if;

  select applications.applicant_id
  into accepted_applicant
  from public.applications
  where applications.task_id = target_task_id
  and applications.status = 'accepted'
  limit 1;

  if accepted_applicant is null then
    raise exception 'No accepted applicant found for this task';
  end if;

  if auth.uid() = task_author then
    update public.tasks
    set author_completed_at = coalesce(author_completed_at, now())
    where tasks.id = target_task_id;
  elsif auth.uid() = accepted_applicant then
    update public.tasks
    set applicant_completed_at = coalesce(applicant_completed_at, now())
    where tasks.id = target_task_id;
  else
    raise exception 'Only matched task participants can confirm completion';
  end if;

  update public.tasks
  set status = 'completed'
  where tasks.id = target_task_id
  and author_completed_at is not null
  and applicant_completed_at is not null;
end;
$$;

grant execute on function public.confirm_task_completion(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_domain text;
  profile_school text;
begin
  email_domain := split_part(new.email, '@', 2);
  profile_school := case
    when new.raw_user_meta_data->>'school' in ('UCB', 'UCSD', 'UCLA') then new.raw_user_meta_data->>'school'
    when email_domain = 'ucsd.edu' then 'UCSD'
    when email_domain = 'ucla.edu' then 'UCLA'
    else 'UCB'
  end;

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
    profile_school,
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
alter table public.notifications enable row level security;

drop policy if exists "Profiles are readable by everyone" on public.profiles;
create policy "Profiles are readable by everyone"
on public.profiles for select
using (true);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Open tasks are readable by everyone" on public.tasks;
create policy "Open tasks are readable by everyone"
on public.tasks for select
using (
  status = 'open'
  or auth.uid() = author_id
  or exists (
    select 1 from public.applications
    where applications.task_id = tasks.id
    and applications.applicant_id = auth.uid()
  )
);

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

drop policy if exists "Users can read their own notifications" on public.notifications;
create policy "Users can read their own notifications"
on public.notifications for select
using (auth.uid() = user_id);

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
on public.notifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
