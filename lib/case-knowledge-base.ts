import { createEmbeddings } from '@/lib/ai';
import { CaseData } from '@/lib/types';

export type KnowledgeCategory =
  | 'overview'
  | 'victim'
  | 'suspect'
  | 'evidence'
  | 'timeline'
  | 'truth'
  | 'red_herring';

export interface KnowledgeChunk {
  id: string;
  category: KnowledgeCategory;
  suspectId?: string;
  text: string;
}

export interface CaseKnowledgeIndex {
  caseId: string;
  chunks: KnowledgeChunk[];
  embeddings: number[][];
}

const globalForKnowledge = globalThis as typeof globalThis & {
  __caseKnowledgeIndexes?: Map<string, CaseKnowledgeIndex>;
};

function getIndexCache(): Map<string, CaseKnowledgeIndex> {
  if (!globalForKnowledge.__caseKnowledgeIndexes) {
    globalForKnowledge.__caseKnowledgeIndexes = new Map();
  }
  return globalForKnowledge.__caseKnowledgeIndexes;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

/** 将案件拆分为可检索的知识片段 */
export function buildKnowledgeChunks(caseData: CaseData | Record<string, unknown>): KnowledgeChunk[] {
  const c = caseData as CaseData;
  const chunks: KnowledgeChunk[] = [];

  chunks.push({
    id: 'overview',
    category: 'overview',
    text: [
      `案件：${c.title}`,
      `地点：${c.setting}`,
      `死因：${c.deathMethod}`,
      `现场：${c.sceneDescription}`,
    ].join('\n'),
  });

  if (c.victim) {
    chunks.push({
      id: 'victim',
      category: 'victim',
      text: [
        `受害者：${c.victim.name}`,
        `${c.victim.age}岁，${c.victim.occupation}`,
        `背景：${c.victim.background}`,
      ].join('\n'),
    });
  }

  if (Array.isArray(c.suspects)) {
    for (const s of c.suspects) {
      const id = String(s.id || '');
      chunks.push({
        id: `suspect-${id}`,
        category: 'suspect',
        suspectId: id,
        text: [
          `嫌疑人 ${s.name}（id: ${id}）`,
          `${s.age}岁，${s.occupation}，与死者关系：${s.relationship}`,
          `性格：${s.personality}`,
          `不在场证明：${s.alibi}`,
          `动机：${s.motive}`,
          `秘密：${Array.isArray(s.secrets) ? s.secrets.join('；') : ''}`,
          `是否真凶：${s.isGuilty ? '是' : '否'}`,
        ].join('\n'),
      });
    }
  }

  if (Array.isArray(c.evidence)) {
    for (const e of c.evidence) {
      chunks.push({
        id: `evidence-${e.id}`,
        category: 'evidence',
        text: [
          `证据 ${e.name}（${e.id}）`,
          `描述：${e.description}`,
          `位置：${e.location}`,
          `意义：${e.significance}`,
          `相关嫌疑人：${Array.isArray(e.relatedSuspects) ? e.relatedSuspects.join('、') : ''}`,
        ].join('\n'),
      });
    }
  }

  if (Array.isArray(c.timeline)) {
    for (const ev of c.timeline) {
      const key = `${ev.time}-${ev.event}`.slice(0, 40);
      chunks.push({
        id: `timeline-${key}`,
        category: 'timeline',
        text: [
          `时间线 ${ev.time}`,
          `事件：${ev.event}`,
          `地点：${ev.location}`,
          `重要程度：${ev.significance}`,
          ev.witness ? `目击者：${ev.witness}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }
  }

  if (c.truth) {
    const process = Array.isArray(c.truth.process) ? c.truth.process.join(' → ') : '';
    chunks.push({
      id: 'truth',
      category: 'truth',
      text: [
        `案件真相（仅真凶知晓，禁止向侦探直接泄露）`,
        `凶手：${c.truth.killer}`,
        `手法：${c.truth.method}`,
        `动机：${c.truth.motive}`,
        `过程：${process}`,
        `关键线索：${Array.isArray(c.truth.keyClues) ? c.truth.keyClues.join('；') : ''}`,
      ].join('\n'),
    });
  }

  if (Array.isArray(c.redHerrings)) {
    for (let i = 0; i < c.redHerrings.length; i++) {
      chunks.push({
        id: `red-herring-${i}`,
        category: 'red_herring',
        text: `误导线索：${c.redHerrings[i]}`,
      });
    }
  }

  return chunks;
}

/** 构建或读取缓存的案件向量索引（BAAI/bge-m3） */
export async function getOrBuildKnowledgeIndex(
  caseData: CaseData | Record<string, unknown>
): Promise<CaseKnowledgeIndex> {
  const caseId = String((caseData as CaseData).id || 'unknown');
  const cache = getIndexCache();
  const cached = cache.get(caseId);
  if (cached) return cached;

  const chunks = buildKnowledgeChunks(caseData);
  const texts = chunks.map((c) => c.text);
  const embeddings = await createEmbeddings(texts);

  const index: CaseKnowledgeIndex = { caseId, chunks, embeddings };
  cache.set(caseId, index);
  console.log(`[KnowledgeBase] Index built: ${caseId}, ${chunks.length} chunks`);
  return index;
}

export interface RetrieveOptions {
  suspectId: string;
  isGuilty: boolean;
  query: string;
  topK?: number;
}

/** 按用户问题检索相关片段；真凶强制附带真相，无辜嫌疑人永不检索到真相 */
export async function retrieveKnowledgeContext(
  index: CaseKnowledgeIndex,
  options: RetrieveOptions
): Promise<string[]> {
  const { suspectId, isGuilty, query, topK = 6 } = options;
  const trimmed = query.trim();
  if (!trimmed) {
    return formatMandatoryChunks(index, suspectId, isGuilty);
  }

  const queryEmbedding = await createEmbeddings([trimmed]);
  const queryVec = queryEmbedding[0];
  if (!queryVec) {
    return formatMandatoryChunks(index, suspectId, isGuilty);
  }

  const mandatoryIds = new Set<string>();
  const mandatory = index.chunks.filter((chunk) => {
    if (chunk.suspectId === suspectId && chunk.category === 'suspect') {
      mandatoryIds.add(chunk.id);
      return true;
    }
    if (isGuilty && chunk.category === 'truth') {
      mandatoryIds.add(chunk.id);
      return true;
    }
    return false;
  });

  const scored = index.chunks
    .map((chunk, i) => ({
      chunk,
      score: cosineSimilarity(queryVec, index.embeddings[i]),
    }))
    .filter(({ chunk }) => {
      if (mandatoryIds.has(chunk.id)) return false;
      if (!isGuilty && chunk.category === 'truth') return false;
      return true;
    })
    .sort((a, b) => b.score - a.score);

  const retrieved = scored.slice(0, topK).map((s) => s.chunk);
  const merged = [...mandatory, ...retrieved];

  return merged.map((c) => c.text);
}

function formatMandatoryChunks(
  index: CaseKnowledgeIndex,
  suspectId: string,
  isGuilty: boolean
): string[] {
  return index.chunks
    .filter(
      (chunk) =>
        (chunk.suspectId === suspectId && chunk.category === 'suspect') ||
        (isGuilty && chunk.category === 'truth')
    )
    .map((c) => c.text);
}
