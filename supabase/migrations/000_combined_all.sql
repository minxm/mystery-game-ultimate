-- Conan AI Detective — 完整迁移（合并版）
-- 在 Supabase Dashboard → SQL Editor 中一次性执行此文件
-- 来源：https://github.com/minxm/conan-ai-db

-- ============================================================
-- PART 1: 初始 Schema
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into public.user_stats (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.user_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  cases_completed int not null default 0,
  average_score numeric(5,2) not null default 0,
  perfect_solves int not null default 0,
  streak int not null default 0,
  achievements jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.cases (
  id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  title text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  case_data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists cases_user_id_idx on public.cases(user_id);
create index if not exists cases_created_at_idx on public.cases(created_at desc);

create table if not exists public.game_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id text not null references public.cases(id) on delete cascade,
  discovered_evidence text[] not null default '{}',
  interrogated_suspects text[] not null default '{}',
  notes text not null default '',
  start_time bigint not null,
  end_time bigint,
  score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, case_id)
);

create index if not exists game_progress_user_id_idx on public.game_progress(user_id);

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  case_id text not null references public.cases(id) on delete cascade,
  score int not null check (score >= 0 and score <= 100),
  breakdown jsonb not null,
  feedback text,
  rating text,
  killer_correct boolean,
  missed_clues text[] not null default '{}',
  user_deduction text,
  created_at timestamptz not null default now()
);

create index if not exists evaluations_user_id_idx on public.evaluations(user_id);
create index if not exists evaluations_score_idx on public.evaluations(score desc);
create index if not exists evaluations_created_at_idx on public.evaluations(created_at desc);

create table if not exists public.interrogations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id text not null,
  suspect_id text not null,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, case_id, suspect_id)
);

create index if not exists interrogations_user_case_idx on public.interrogations(user_id, case_id);

create table if not exists public.case_generation_jobs (
  job_id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  difficulty text not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'error')),
  stage text not null default 'pending',
  case_data jsonb,
  error text,
  progress_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists case_generation_jobs_status_idx on public.case_generation_jobs(status);
create index if not exists case_generation_jobs_user_id_idx on public.case_generation_jobs(user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists case_generation_jobs_updated_at on public.case_generation_jobs;
create trigger case_generation_jobs_updated_at
  before update on public.case_generation_jobs
  for each row execute function public.set_updated_at();

drop trigger if exists game_progress_updated_at on public.game_progress;
create trigger game_progress_updated_at
  before update on public.game_progress
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_stats_updated_at on public.user_stats;
create trigger user_stats_updated_at
  before update on public.user_stats
  for each row execute function public.set_updated_at();

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_action_idx on public.activity_logs(action);
create index if not exists activity_logs_created_at_idx on public.activity_logs(created_at desc);

create or replace view public.leaderboard as
select
  p.id as user_id,
  coalesce(p.display_name, '匿名侦探') as display_name,
  p.avatar_url,
  count(e.id)::int as total_cases,
  coalesce(avg(e.score), 0)::numeric(5,2) as avg_score,
  coalesce(max(e.score), 0)::int as best_score,
  count(*) filter (where e.score >= 95)::int as perfect_solves
from public.profiles p
inner join public.evaluations e on e.user_id = p.id
group by p.id, p.display_name, p.avatar_url
having count(e.id) >= 1
order by avg_score desc, best_score desc;

alter table public.profiles enable row level security;
alter table public.user_stats enable row level security;
alter table public.cases enable row level security;
alter table public.game_progress enable row level security;
alter table public.evaluations enable row level security;
alter table public.interrogations enable row level security;
alter table public.case_generation_jobs enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles for select using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

drop policy if exists "user_stats_select_own" on public.user_stats;
create policy "user_stats_select_own" on public.user_stats for select using (auth.uid() = user_id);
drop policy if exists "user_stats_update_own" on public.user_stats;
create policy "user_stats_update_own" on public.user_stats for update using (auth.uid() = user_id);
drop policy if exists "user_stats_insert_own" on public.user_stats;
create policy "user_stats_insert_own" on public.user_stats for insert with check (auth.uid() = user_id);

drop policy if exists "cases_select_own" on public.cases;
create policy "cases_select_own" on public.cases for select using (auth.uid() = user_id or user_id is null);
drop policy if exists "cases_insert_own" on public.cases;
create policy "cases_insert_own" on public.cases for insert with check (auth.uid() = user_id or user_id is null);
drop policy if exists "cases_update_own" on public.cases;
create policy "cases_update_own" on public.cases for update using (auth.uid() = user_id);

drop policy if exists "progress_all_own" on public.game_progress;
create policy "progress_all_own" on public.game_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "evaluations_select_all" on public.evaluations;
create policy "evaluations_select_all" on public.evaluations for select using (true);
drop policy if exists "evaluations_insert_own" on public.evaluations;
create policy "evaluations_insert_own" on public.evaluations for insert with check (auth.uid() = user_id or user_id is null);

drop policy if exists "interrogations_all_own" on public.interrogations;
create policy "interrogations_all_own" on public.interrogations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "jobs_select_own" on public.case_generation_jobs;
create policy "jobs_select_own" on public.case_generation_jobs for select
  using (auth.uid() = user_id or user_id is null);

drop policy if exists "logs_select_own" on public.activity_logs;
create policy "logs_select_own" on public.activity_logs for select using (auth.uid() = user_id);
drop policy if exists "logs_insert_own" on public.activity_logs;
create policy "logs_insert_own" on public.activity_logs for insert with check (auth.uid() = user_id or user_id is null);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'case_generation_jobs'
  ) then
    alter publication supabase_realtime add table public.case_generation_jobs;
  end if;
end $$;

-- ============================================================
-- PART 2: Storage
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-images',
  'case-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "case_images_public_read" on storage.objects;
create policy "case_images_public_read"
  on storage.objects for select
  using (bucket_id = 'case-images');

drop policy if exists "case_images_auth_upload" on storage.objects;
create policy "case_images_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'case-images'
    and (auth.role() = 'authenticated' or auth.role() = 'service_role')
  );

drop policy if exists "case_images_service_manage" on storage.objects;
create policy "case_images_service_manage"
  on storage.objects for all
  using (bucket_id = 'case-images' and auth.role() = 'service_role');

-- ============================================================
-- PART 3: 表级权限（SQL 迁移创建的表需显式 GRANT）
-- ============================================================

grant usage on schema public to postgres, anon, authenticated, service_role;

grant all on all tables in schema public to postgres, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;

grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all routines in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to postgres, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant select on tables to anon;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines to postgres, anon, authenticated, service_role;
