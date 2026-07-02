-- 列表页封面图：仅存 CDN/HTTP URL，避免列表查询拉取 case_data 大 JSON
alter table public.cases add column if not exists scene_image_url text;

update public.cases
set scene_image_url = case_data->>'sceneImageUrl'
where scene_image_url is null
  and case_data->>'sceneImageUrl' like 'http%';

create index if not exists cases_scene_image_url_idx
  on public.cases(scene_image_url)
  where scene_image_url is not null;
