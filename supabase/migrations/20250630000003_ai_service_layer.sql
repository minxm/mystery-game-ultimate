-- AI 服务层 + 案件库存 + 社区功能迁移
-- 在 Supabase Dashboard → SQL Editor 中执行

-- ============================================================
-- 1. AI 调用日志
-- ============================================================

create table if not exists public.ai_call_logs (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  model text not null,
  status text not null check (status in ('success', 'error', 'timeout')),
  latency_ms int not null default 0,
  prompt_tokens int,
  completion_tokens int,
  total_tokens int,
  error_message text,
  user_id uuid references public.profiles(id) on delete set null,
  case_id text,
  job_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_call_logs_operation_idx on public.ai_call_logs(operation);
create index if not exists ai_call_logs_status_idx on public.ai_call_logs(status);
create index if not exists ai_call_logs_created_at_idx on public.ai_call_logs(created_at desc);
create index if not exists ai_call_logs_model_idx on public.ai_call_logs(model);

alter table public.ai_call_logs enable row level security;

drop policy if exists "ai_logs_service_only" on public.ai_call_logs;
create policy "ai_logs_service_only" on public.ai_call_logs
  for all using (false);

-- ============================================================
-- 2. 案件库存（预生成队列）
-- ============================================================

create table if not exists public.case_inventory (
  id uuid primary key default gen_random_uuid(),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'expert')),
  case_id text not null references public.cases(id) on delete cascade,
  status text not null default 'available' check (status in ('available', 'claimed', 'archived')),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists case_inventory_difficulty_status_idx
  on public.case_inventory(difficulty, status) where status = 'available';
create unique index if not exists case_inventory_case_id_idx on public.case_inventory(case_id);

alter table public.case_inventory enable row level security;

drop policy if exists "inventory_select_available_count" on public.case_inventory;
create policy "inventory_select_available_count" on public.case_inventory
  for select using (status = 'available');

-- ============================================================
-- 3. 案件分享
-- ============================================================

alter table public.cases add column if not exists share_token text unique;
alter table public.cases add column if not exists is_public boolean not null default false;
alter table public.cases add column if not exists play_count int not null default 0;

create index if not exists cases_share_token_idx on public.cases(share_token) where share_token is not null;

drop policy if exists "cases_select_own" on public.cases;
create policy "cases_select_own" on public.cases for select
  using (auth.uid() = user_id or user_id is null or is_public = true);

-- ============================================================
-- 4. 评论 / 收藏 / 举报
-- ============================================================

create table if not exists public.case_comments (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references public.cases(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists case_comments_case_id_idx on public.case_comments(case_id, created_at desc);

create table if not exists public.case_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  case_id text not null references public.cases(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, case_id)
);

create table if not exists public.case_reports (
  id uuid primary key default gen_random_uuid(),
  case_id text not null references public.cases(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 200),
  detail text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.case_comments enable row level security;
alter table public.case_favorites enable row level security;
alter table public.case_reports enable row level security;

drop policy if exists "comments_select_all" on public.case_comments;
create policy "comments_select_all" on public.case_comments for select using (true);
drop policy if exists "comments_insert_auth" on public.case_comments;
create policy "comments_insert_auth" on public.case_comments
  for insert with check (auth.uid() = user_id);
drop policy if exists "comments_delete_own" on public.case_comments;
create policy "comments_delete_own" on public.case_comments
  for delete using (auth.uid() = user_id);

drop policy if exists "favorites_select_own" on public.case_favorites;
create policy "favorites_select_own" on public.case_favorites
  for select using (auth.uid() = user_id);
drop policy if exists "favorites_insert_own" on public.case_favorites;
create policy "favorites_insert_own" on public.case_favorites
  for insert with check (auth.uid() = user_id);
drop policy if exists "favorites_delete_own" on public.case_favorites;
create policy "favorites_delete_own" on public.case_favorites
  for delete using (auth.uid() = user_id);

drop policy if exists "reports_insert_auth" on public.case_reports;
create policy "reports_insert_auth" on public.case_reports
  for insert with check (auth.uid() = user_id or user_id is null);

-- ============================================================
-- 5. 运营工具（签到 / 积分 / 邀请码 — 预留）
-- ============================================================

create table if not exists public.user_points (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  total_earned int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  check_in_date date not null default current_date,
  streak int not null default 1,
  points_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, check_in_date)
);

create table if not exists public.invite_codes (
  code text primary key,
  owner_id uuid references public.profiles(id) on delete set null,
  max_uses int not null default 10,
  use_count int not null default 0,
  points_reward int not null default 50,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.invite_codes(code) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (code, user_id)
);

alter table public.user_points enable row level security;
alter table public.check_ins enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_redemptions enable row level security;

drop policy if exists "points_select_own" on public.user_points;
create policy "points_select_own" on public.user_points for select using (auth.uid() = user_id);
drop policy if exists "checkins_select_own" on public.check_ins;
create policy "checkins_select_own" on public.check_ins for select using (auth.uid() = user_id);

-- ============================================================
-- 6. 监控视图
-- ============================================================

create or replace view public.ai_monitor_stats as
select
  count(*) filter (where status = 'pending')::int as pending_jobs,
  count(*) filter (where status = 'pending' and created_at > now() - interval '1 hour')::int as recent_pending,
  (select count(*)::int from public.ai_call_logs where created_at > now() - interval '1 hour') as ai_calls_last_hour,
  (select coalesce(avg(latency_ms), 0)::int from public.ai_call_logs where status = 'success' and created_at > now() - interval '1 hour') as avg_latency_ms,
  (select coalesce(sum(total_tokens), 0)::bigint from public.ai_call_logs where created_at > now() - interval '1 hour') as tokens_last_hour
from public.case_generation_jobs;

create or replace view public.case_inventory_stats as
select
  difficulty,
  count(*) filter (where status = 'available')::int as available,
  count(*) filter (where status = 'claimed')::int as claimed
from public.case_inventory
group by difficulty;

-- Realtime: 监控页订阅 job 变化
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'ai_call_logs'
  ) then
    alter publication supabase_realtime add table public.ai_call_logs;
  end if;
end $$;
