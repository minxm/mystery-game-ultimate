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

const { key: apiKey, source: apiKeySource } = resolveApiKey();

export const AI_CONFIG = {
  baseURL: process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1',
  apiKey,
  apiKeySource,
  /** 案件生成 — 线上用 7B 指令模型，单次需在 Netlify 26s 内完成 */
  textModel:
    process.env.AI_TEXT_MODEL ||
    (process.env.NETLIFY === 'true' ? 'Qwen/Qwen2.5-7B-Instruct' : 'Qwen/Qwen3-8B'),
  /** 嫌疑人对话 — 响应更快 */
  chatModel: process.env.AI_CHAT_MODEL || 'Qwen/Qwen3-8B',
  /** 文生图 — 快手 Kolors，悬疑场景表现好 */
  imageModel: process.env.AI_IMAGE_MODEL || 'Kwai-Kolors/Kolors',
};

/** Netlify 等 Serverless 环境默认跳过 AI 生图，避免 502 超时 */
export function shouldGenerateImages(): boolean {
  if (process.env.AI_GENERATE_IMAGES === 'true') return true;
  if (process.env.AI_GENERATE_IMAGES === 'false') return false;
  return process.env.NETLIFY !== 'true';
}

export function getAiConfigError(): string | null {
  if (AI_CONFIG.apiKey) return null;

  return (
    '未配置 SILICONFLOW_API_KEY。请到 https://cloud.siliconflow.cn 注册并创建 API Key，' +
    '然后在环境变量中设置 SILICONFLOW_API_KEY=你的密钥'
  );
}
