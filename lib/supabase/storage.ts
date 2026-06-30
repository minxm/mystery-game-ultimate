import { createAdminClientSafe } from './admin';
import { CaseData } from '@/lib/types';

const BUCKET = 'case-images';

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string; ext: string } | null {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  return { buffer: Buffer.from(match[2], 'base64'), mime, ext };
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
