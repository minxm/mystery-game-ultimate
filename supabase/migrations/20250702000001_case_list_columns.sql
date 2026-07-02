-- 列表查询专用列：避免读取 case_data 大 JSONB（含 base64 图片时单次可达数 MB）
alter table public.cases add column if not exists setting text;

update public.cases
set setting = coalesce(nullif(setting, ''), case_data->>'setting', '')
where setting is null or setting = '';

create index if not exists case_inventory_status_created_idx
  on public.case_inventory (created_at desc)
  where status = 'available';

create index if not exists game_progress_user_updated_idx
  on public.game_progress (user_id, updated_at desc);
