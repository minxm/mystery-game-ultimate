/**
 * 硅基流动 SiliconFlow — 国内直连，OpenAI 兼容，无需代理
 * 注册：https://cloud.siliconflow.cn
 * 实名认证后可使用全部免费模型
 */
function resolveApiKey(): { key: string; source: string } {
  if (process.env.SILICONFLOW_API_KEY) {
    return { key: process.env.SILICONFLOW_API_KEY, source: 'SILICONFLOW_API_KEY' };
  }
  if (process.env.AI_API_KEY) {
    return { key: process.env.AI_API_KEY, source: 'AI_API_KEY' };
  }
  // 兼容旧部署脚本中的 OPENAI_API_KEY（实际为硅基流动密钥）
  if (process.env.OPENAI_API_KEY) {
    return { key: process.env.OPENAI_API_KEY, source: 'OPENAI_API_KEY (legacy)' };
  }
  return { key: '', source: 'none' };
}

export function isCloudflareEnv(): boolean {
  return (
    process.env.CLOUDFLARE === 'true' ||
    process.env.CF_PAGES === '1' ||
    typeof process.env.CF_PAGES_URL === 'string'
  );
}

export function isServerlessEnv(): boolean {
  return (
    isCloudflareEnv() ||
    process.env.VERCEL === '1' ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined
  );
}

/** Serverless 环境 AI 生成较慢，需要更长超时 */
export function getCaseGenerationTimeoutMs(): number {
  const configured = process.env.AI_CASE_TIMEOUT_MS;
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return isServerlessEnv() ? 25000 : 18000;
}

export function getCaseGenerationMaxRetries(): number {
  return isServerlessEnv() ? 1 : 2;
}

/**
 * 本地案件生成的总超时。
 * Qwen3-8B 一次性输出 + Kolors 5 张图，需预留足够预算。
 */
export function getLocalPhasesTimeoutMs(): number {
  const configured = process.env.AI_LOCAL_TIMEOUT_MS;
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 360000;
}

/** 单个生成阶段的超时，超过则该阶段快速失败并重试 */
export function getPhaseTimeoutMs(): number {
  const configured = process.env.AI_PHASE_TIMEOUT_MS;
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 120000;
}

/** Qwen3 / DeepSeek-R1 等 JSON 生成请求的客户端超时 */
export function getJsonGenerationClientTimeoutMs(): number {
  const configured = process.env.AI_JSON_CLIENT_TIMEOUT_MS;
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return isServerlessEnv() ? 120000 : 150000;
}

const { key: apiKey, source: apiKeySource } = resolveApiKey();

export const AI_CONFIG = {
  baseURL: process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1',
  apiKey,
  apiKeySource,
  /**
   * 案件框架 — Qwen3.5-4B 快速生成结构化骨架（凶手、动机、时间线、证据等）。
   */
  caseFrameworkModel:
    process.env.AI_CASE_FRAMEWORK_MODEL || 'Qwen/Qwen3.5-4B',
  /**
   * 案件润色 — Qwen3-8B 在框架基础上丰富剧情、强化误导与叙事质感。
   * 兼容旧环境变量 AI_CASE_MODEL / AI_TEXT_MODEL。
   */
  casePolishModel:
    process.env.AI_CASE_POLISH_MODEL ||
    process.env.AI_CASE_MODEL ||
    process.env.AI_TEXT_MODEL ||
    'Qwen/Qwen3-8B',
  /** @deprecated 请使用 casePolishModel */
  caseModel:
    process.env.AI_CASE_POLISH_MODEL ||
    process.env.AI_CASE_MODEL ||
    process.env.AI_TEXT_MODEL ||
    'Qwen/Qwen3-8B',
  /**
   * 图片 Prompt 生成 — 默认与润色模型相同。
   */
  imagePromptModel:
    process.env.AI_IMAGE_PROMPT_MODEL ||
    process.env.AI_CASE_POLISH_MODEL ||
    process.env.AI_CASE_MODEL ||
    'Qwen/Qwen3-8B',
  /**
   * 嫌疑人审讯 — GLM-4-9B 读取同一份案件 JSON 进行角色扮演，响应快且设定一致。
   */
  chatModel: process.env.AI_CHAT_MODEL || 'THUDM/GLM-4-9B-0414',
  /**
   * 推理评分 — DeepSeek-R1 结合案件 JSON 与玩家推理，给出评分与遗漏线索说明。
   */
  evaluateModel:
    process.env.AI_EVALUATE_MODEL || 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
  /** 文生图 — Kolors，使用 Qwen 生成的 prompt 绘制角色与现场图 */
  imageModel: process.env.AI_IMAGE_MODEL || 'Kwai-Kolors/Kolors',
  /**
   * 案件知识库向量检索 — BAAI/bge-m3，多语言、8192 token 上下文。
   */
  embeddingModel: process.env.AI_EMBEDDING_MODEL || 'BAAI/bge-m3',
};

/** 默认开启 AI 生图；仅当显式设为 false 时关闭 */
export function shouldGenerateImages(): boolean {
  return process.env.AI_GENERATE_IMAGES !== 'false';
}

export function getAiConfigError(): string | null {
  if (AI_CONFIG.apiKey) return null;

  return (
    '未配置 SILICONFLOW_API_KEY。请到 https://cloud.siliconflow.cn 注册并创建 API Key，' +
    '然后在环境变量中设置 SILICONFLOW_API_KEY=你的密钥'
  );
}
