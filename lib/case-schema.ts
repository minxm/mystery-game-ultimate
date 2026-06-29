/** 各阶段 AI 输出的校验与合并，避免 JSON 可解析但字段缺失导致运行时崩溃 */

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : {};
}

function pickArray(obj: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const val = obj[key];
    if (Array.isArray(val) && val.length > 0) return val;
  }
  return [];
}

function normalizeSuspects(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw.filter((s) => s && typeof s === 'object') as Record<string, unknown>[];
  }
  const obj = asRecord(raw);
  const list = pickArray(obj, ['suspects', 'characters', 'suspectList', '嫌疑人']);
  return list.filter((s) => s && typeof s === 'object') as Record<string, unknown>[];
}

/** 将 truth 规范为前端可安全展示的结构（兼容 AI 返回字符串或中文键名） */
export function normalizeTruthShape(truth: unknown): {
  killer: string;
  method: string;
  motive: string;
  process: string[];
  keyClues: string[];
} {
  const t =
    truth && typeof truth === 'object' && !Array.isArray(truth)
      ? (truth as Record<string, unknown>)
      : {};

  const toStringList = (raw: unknown): string[] => {
    if (Array.isArray(raw)) {
      return raw.map((item) => String(item).trim()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      const parts = trimmed.split(/[→\n;；,、]+/).map((s) => s.trim()).filter(Boolean);
      return parts.length > 0 ? parts : [trimmed];
    }
    return [];
  };

  const process = toStringList(t.process ?? t.作案过程 ?? t.steps);
  const keyClues = toStringList(t.keyClues ?? t.key_clues ?? t.关键线索 ?? t.clues);

  return {
    killer: String(t.killer ?? t.凶手 ?? '未知'),
    method: String(t.method ?? t.手法 ?? '暂无记录'),
    motive: String(t.motive ?? t.动机 ?? '暂无记录'),
    process: process.length > 0 ? process : ['暂无详细过程记录'],
    keyClues: keyClues.length > 0 ? keyClues : ['暂无关键线索记录'],
  };
}

function normalizeTruth(raw: unknown): Record<string, unknown> | null {
  const obj = asRecord(raw);
  const truth = obj.truth ?? obj.真相;
  if (truth && typeof truth === 'object' && !Array.isArray(truth)) {
    return truth as Record<string, unknown>;
  }
  return null;
}

export function validateCaseBase(data: unknown): Record<string, unknown> {
  const d = asRecord(data);
  if (!d.title || !d.setting) {
    throw new Error(`base 阶段缺少 title/setting，实际 keys: ${Object.keys(d).join(',') || '空'}`);
  }
  const victim = asRecord(d.victim);
  if (!victim.name) {
    throw new Error('base 阶段缺少 victim.name');
  }
  if (!d.deathMethod || !d.sceneDescription) {
    throw new Error('base 阶段缺少 deathMethod 或 sceneDescription');
  }
  return d;
}

export function validateCaseCast(data: unknown): { suspects: Record<string, unknown>[]; truth: Record<string, unknown> } {
  const d = asRecord(data);
  let suspects = normalizeSuspects(d.suspects);
  if (suspects.length < 3) {
    suspects = normalizeSuspects(d);
  }
  if (suspects.length < 3) {
    throw new Error(
      `cast 阶段 suspects 不足 3 人（实际 ${suspects.length}），keys: ${Object.keys(d).join(',') || '空'}`
    );
  }

  const normalizedSuspects = suspects.slice(0, 3).map((s, i) => {
    const secrets = Array.isArray(s.secrets)
      ? s.secrets.map(String)
      : s.secrets
        ? [String(s.secrets)]
        : ['未知秘密'];
    return {
      ...s,
      id: String(s.id || `s${i + 1}`),
      name: String(s.name || `嫌疑人${i + 1}`),
      secrets,
      isGuilty: s.isGuilty === true || s.isGuilty === 'true',
    };
  });

  const guiltyCount = normalizedSuspects.filter((s) => s.isGuilty).length;
  if (guiltyCount !== 1) {
    throw new Error(`cast 阶段 isGuilty 必须为 1 人，实际 ${guiltyCount}`);
  }

  const truth = normalizeTruth(d);
  if (!truth?.killer) {
    throw new Error('cast 阶段缺少 truth.killer');
  }

  return { suspects: normalizedSuspects, truth };
}

export function validateCaseDetails(data: unknown): {
  evidence: Record<string, unknown>[];
  timeline: Record<string, unknown>[];
  redHerrings: string[];
} {
  const d = asRecord(data);
  let evidence = pickArray(d, ['evidence', 'evidences', '证据']) as Record<string, unknown>[];
  let timeline = pickArray(d, ['timeline', 'timelines', '时间线']) as Record<string, unknown>[];

  if (evidence.length < 1) {
    throw new Error(`details 阶段 evidence 缺失，keys: ${Object.keys(d).join(',') || '空'}`);
  }
  if (timeline.length < 1) {
    throw new Error('details 阶段 timeline 缺失');
  }

  const redHerringsRaw = d.redHerrings ?? d.red_herrings ?? d.误导;
  const redHerrings = Array.isArray(redHerringsRaw)
    ? redHerringsRaw.map(String)
    : redHerringsRaw
      ? [String(redHerringsRaw)]
      : [];

  return { evidence, timeline, redHerrings };
}

/** 校验 Qwen3-8B 一次性输出的完整案件 JSON */
export function validateFullCase(data: unknown): Record<string, unknown> {
  const base = validateCaseBase(data);
  const cast = validateCaseCast(data);
  const details = validateCaseDetails(data);
  return mergeCasePhases(base, cast, details);
}

/** 显式合并三阶段，避免 spread 覆盖掉 suspects/truth 等核心字段 */
export function mergeCasePhases(
  base: Record<string, unknown>,
  cast: { suspects: Record<string, unknown>[]; truth: Record<string, unknown> },
  details: {
    evidence: Record<string, unknown>[];
    timeline: Record<string, unknown>[];
    redHerrings: string[];
  }
): Record<string, unknown> {
  return {
    ...base,
    suspects: cast.suspects,
    truth: cast.truth,
    evidence: details.evidence,
    timeline: details.timeline,
    redHerrings: details.redHerrings,
  };
}
