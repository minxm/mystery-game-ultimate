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
  return { key: '', source: 'none' };
}

const { key: apiKey, source: apiKeySource } = resolveApiKey();

export const AI_CONFIG = {
  baseURL: process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1',
  apiKey,
  apiKeySource,
  /** 案件生成 / 评分 — 推理向免费模型 */
  textModel:
    process.env.AI_TEXT_MODEL || 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
  /** 嫌疑人对话 — 响应更快 */
  chatModel: process.env.AI_CHAT_MODEL || 'Qwen/Qwen3-8B',
  /** 文生图 — 快手 Kolors，悬疑场景表现好 */
  imageModel: process.env.AI_IMAGE_MODEL || 'Kwai-Kolors/Kolors',
};

export function getAiConfigError(): string | null {
  if (AI_CONFIG.apiKey) return null;

  if (process.env.OPENAI_API_KEY) {
    return (
      '检测到 OPENAI_API_KEY，但这是旧的代理密钥，不能用于硅基流动。' +
      '请到 https://cloud.siliconflow.cn 注册并创建 API Key，' +
      '然后在 .env.local 中设置 SILICONFLOW_API_KEY=你的密钥'
    );
  }

  return (
    '未配置 SILICONFLOW_API_KEY。请到 https://cloud.siliconflow.cn 注册并创建 API Key，' +
    '然后在 .env.local 中设置 SILICONFLOW_API_KEY=你的密钥'
  );
}
