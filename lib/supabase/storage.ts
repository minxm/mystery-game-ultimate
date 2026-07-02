import { createAdminClientSafe } from './admin';
import { CaseData } from '@/lib/types';

const BUCKET = 'case-images';

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string; ext: string } | null {
  const imageMatch = dataUrl.match(/^data:(image\/\w+);base64,([\s\S]+)$/);
  if (imageMatch) {
    const mime = imageMatch[1];
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    return { buffer: Buffer.from(imageMatch[2], 'base64'), mime, ext };
  }

  const genericMatch = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (genericMatch) {
    const rawMime = genericMatch[1];
    const mime = rawMime.startsWith('image/') ? rawMime : 'image/png';
    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    return { buffer: Buffer.from(genericMatch[2], 'base64'), mime, ext };
  }

  return null;
}

/** 上传 base64 data URL 到 Supabase Storage，返回公开 URL */
export async function uploadDataUrl(
  dataUrl: string,
  path: string
): Promise<string | null> {
  const admin = createAdminClientSafe();
  if (!admin) return null;

  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return dataUrl.startsWith('http') ? dataUrl : null;

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, parsed.buffer, { contentType: parsed.mime, upsert: true });

  if (error) {
    console.warn('[Storage] Upload failed:', path, error.message);
    return null;
  }

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** 将案件中所有 base64 图片上传到 Storage 并替换 URL */
export async function uploadCaseImages(caseData: CaseData): Promise<CaseData> {
  const admin = createAdminClientSafe();
  if (!admin) return caseData;

  const prefix = `${caseData.id}`;
  const result = { ...caseData };

  if (result.victim.imageUrl?.startsWith('data:')) {
    const url = await uploadDataUrl(
      result.victim.imageUrl,
      `${prefix}/victim.${parseDataUrl(result.victim.imageUrl)?.ext ?? 'png'}`
    );
    if (url) result.victim = { ...result.victim, imageUrl: url };
  }

  if (result.sceneImageUrl?.startsWith('data:')) {
    const url = await uploadDataUrl(
      result.sceneImageUrl,
      `${prefix}/scene.${parseDataUrl(result.sceneImageUrl)?.ext ?? 'png'}`
    );
    if (url) result.sceneImageUrl = url;
  }

  result.suspects = await Promise.all(
    result.suspects.map(async (suspect) => {
      if (!suspect.imageUrl?.startsWith('data:')) return suspect;
      const url = await uploadDataUrl(
        suspect.imageUrl,
        `${prefix}/suspect-${suspect.id}.${parseDataUrl(suspect.imageUrl)?.ext ?? 'png'}`
      );
      return url ? { ...suspect, imageUrl: url } : suspect;
    })
  );

  return result;
}

/** 将内联封面图上传到 Storage，供列表页使用（避免响应体携带 MB 级 data URL） */
export async function ensurePublicSceneImageUrl(
  caseId: string,
  url: string | null | undefined
): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (!url.startsWith('data:')) return null;

  const uploaded = await uploadDataUrl(url, `${caseId}/scene.png`);
  if (!uploaded?.startsWith('http')) return null;

  const admin = createAdminClientSafe();
  if (admin) {
    const { error } = await admin
      .from('cases')
      .update({ scene_image_url: uploaded })
      .eq('id', caseId);
    if (error && !error.message.includes('scene_image_url')) {
      console.warn('[Storage] scene_image_url update failed:', caseId, error.message);
    }
  }

  return uploaded;
}
