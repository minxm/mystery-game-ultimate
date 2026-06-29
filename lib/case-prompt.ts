import { CaseData } from './types';

/** 将案件序列化为 AI 可读 JSON（去除图片 URL 等无关字段，保证各模型读取同一份设定） */
export function serializeCaseForPrompt(caseData: CaseData | Record<string, unknown>): string {
  const c = caseData as CaseData;
  const payload = {
    title: c.title,
    setting: c.setting,
    victim: c.victim
      ? {
          name: c.victim.name,
          gender: c.victim.gender,
          age: c.victim.age,
          occupation: c.victim.occupation,
          background: c.victim.background,
        }
      : undefined,
    deathMethod: c.deathMethod,
    sceneDescription: c.sceneDescription,
    suspects: Array.isArray(c.suspects)
      ? c.suspects.map((s) => ({
          id: s.id,
          name: s.name,
          gender: s.gender,
          age: s.age,
          occupation: s.occupation,
          relationship: s.relationship,
          alibi: s.alibi,
          motive: s.motive,
          personality: s.personality,
          secrets: s.secrets,
          isGuilty: s.isGuilty,
        }))
      : [],
    evidence: Array.isArray(c.evidence)
      ? c.evidence.map((e) => ({
          id: e.id,
          name: e.name,
          description: e.description,
          location: e.location,
          significance: e.significance,
          relatedSuspects: e.relatedSuspects,
        }))
      : [],
    timeline: c.timeline || [],
    truth: c.truth,
    redHerrings: c.redHerrings || [],
  };
  return JSON.stringify(payload);
}
