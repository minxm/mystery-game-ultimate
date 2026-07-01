import OpenAI from 'openai';
import {
  AI_CONFIG,
  getJsonGenerationClientTimeoutMs,
  isServerlessEnv,
} from '@/lib/ai-config';

console.log('[AI-Service] Initializing unified SiliconFlow client...');
console.log('[AI-Service] Base URL:', AI_CONFIG.baseURL);
console.log('[AI-Service] API Key configured:', !!AI_CONFIG.apiKey);

/** 通用短请求客户端（审讯、评分、embedding） */
export const aiClient = new OpenAI({
  apiKey: AI_CONFIG.apiKey,
  baseURL: AI_CONFIG.baseURL,
  timeout: isServerlessEnv() ? 120000 : 60000,
  maxRetries: 0,
});

/** 长耗时 JSON / 图片 Prompt 专用客户端 */
export const aiJsonClient = new OpenAI({
  apiKey: AI_CONFIG.apiKey,
  baseURL: AI_CONFIG.baseURL,
  timeout: getJsonGenerationClientTimeoutMs(),
  maxRetries: 0,
});
