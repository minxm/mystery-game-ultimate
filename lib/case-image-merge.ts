import { isAvatarPlaceholder, isScenePlaceholder } from '@/lib/placeholder';
import type { CaseData } from '@/lib/types';

export function listMissingCharacterImageIds(caseData: CaseData): string[] {
  const missing: string[] = [];
  if (isAvatarPlaceholder(caseData.victim.imageUrl)) missing.push('victim');
  for (const suspect of caseData.suspects) {
    if (isAvatarPlaceholder(suspect.imageUrl)) missing.push(suspect.id);
  }
  return missing;
}

export function caseDataHasMissingCharacterImages(caseData: CaseData): boolean {
  return listMissingCharacterImageIds(caseData).length > 0;
}

/** 服务端/本地之间合并肖像：远程有真实图时覆盖本地占位或旧 base64 */
export function isBetterCharacterImageUrl(
  next?: string | null,
  prev?: string | null
): boolean {
  if (!next || isAvatarPlaceholder(next)) return false;
  if (!prev || isAvatarPlaceholder(prev)) return true;
  if (next.startsWith('http') && prev.startsWith('data:')) return true;
  return false;
}

export function mergeCaseCharacterImages(local: CaseData, remote: CaseData): CaseData {
  let changed = false;

  const victim = { ...local.victim };
  if (isBetterCharacterImageUrl(remote.victim.imageUrl, local.victim.imageUrl)) {
    victim.imageUrl = remote.victim.imageUrl;
    changed = true;
  }

  const suspects = local.suspects.map((suspect) => {
    const remoteSuspect = remote.suspects.find((s) => s.id === suspect.id);
    if (!remoteSuspect) return suspect;
    if (isBetterCharacterImageUrl(remoteSuspect.imageUrl, suspect.imageUrl)) {
      changed = true;
      return { ...suspect, imageUrl: remoteSuspect.imageUrl };
    }
    return suspect;
  });

  let sceneImageUrl = local.sceneImageUrl;
  if (
    remote.sceneImageUrl?.startsWith('http') &&
    isScenePlaceholder(local.sceneImageUrl)
  ) {
    sceneImageUrl = remote.sceneImageUrl;
    changed = true;
  }

  if (!changed) return local;
  return { ...local, victim, suspects, sceneImageUrl };
}
