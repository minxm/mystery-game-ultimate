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

export function isServerlessEnv(): boolean {
  return (
    process.env.NETLIFY === 'true' ||
    process.env.VERCEL === '1' ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined
  );
}

/** Serverless 环境 AI 生成较慢，需要更长超时（Netlify 函数上限 60s） */
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
 * 本地多阶段生成（base→cast→details）的总超时。
 * 本地 Next dev 没有 Serverless 的网关硬超时，提示词变长后生成更慢，
 * 这里给足预算，避免还没生成完就回退默认案件。
 */
export function getLocalPhasesTimeoutMs(): number {
  const configured = process.env.AI_LOCAL_TIMEOUT_MS;
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 150000;
}

/** 单个生成阶段的超时，超过则该阶段快速失败并重试，避免卡死拖垮总预算 */
export function getPhaseTimeoutMs(): number {
  const configured = process.env.AI_PHASE_TIMEOUT_MS;
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 50000;
}

const { key: apiKey, source: apiKeySource } = resolveApiKey();

export const AI_CONFIG = {
  baseURL: process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1',
  apiKey,
  apiKeySource,
  /**
   * 案件生成 — 免费的 GLM-4-9B（非思考型，JSON 遵循能力优于 7B，不收费）。
   * 7B 在小模型下常漏掉 suspects 等字段；9B + 分阶段校验/重试更稳，剧情质量也更好。
   * 对话仍用 Qwen2.5-7B（响应快）。可通过 AI_TEXT_MODEL 覆盖。
   */
  textModel: process.env.AI_TEXT_MODEL || 'THUDM/GLM-4-9B-0414',
  /**
   * 嫌疑人对话 — 用 7B 指令模型（非思考模型，响应快）。
   * 注意：Qwen3 系列是思考模型，在硅基流动上会输出大量 reasoning_content，
   * 单轮对话耗时 ~24s 且 max_tokens 易被思考链占满；短问答用 7B 更合适（~6s）。
   */
  chatModel: process.env.AI_CHAT_MODEL || 'Qwen/Qwen2.5-7B-Instruct',
  /** 文生图 — 快手 Kolors，悬疑场景表现好 */
  imageModel: process.env.AI_IMAGE_MODEL || 'Kwai-Kolors/Kolors',
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
