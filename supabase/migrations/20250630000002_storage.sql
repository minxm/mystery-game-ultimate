-- Storage bucket：AI 生成图片缓存
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-images',
  'case-images',
  true,
  5242880, -- 5MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- 公开读取
create policy "case_images_public_read"
  on storage.objects for select
  using (bucket_id = 'case-images');

-- 认证用户可上传到自己的目录
create policy "case_images_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'case-images'
    and (auth.role() = 'authenticated' or auth.role() = 'service_role')
  );

-- service_role 可更新/删除
create policy "case_images_service_manage"
  on storage.objects for all
  using (bucket_id = 'case-images' and auth.role() = 'service_role');
