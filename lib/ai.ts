import OpenAI from 'openai';
import { AI_CONFIG, getAiConfigError } from './ai-config';

const configError = getAiConfigError();

console.log('[AI] Initializing SiliconFlow client...');
console.log('[AI] API Key source:', AI_CONFIG.apiKeySource);
console.log('[AI] API Key exists:', !!AI_CONFIG.apiKey);
console.log('[AI] Base URL:', AI_CONFIG.baseURL);
console.log('[AI] Text model:', AI_CONFIG.textModel);
console.log('[AI] Chat model:', AI_CONFIG.chatModel);
console.log('[AI] Image model:', AI_CONFIG.imageModel);
if (configError) {
  console.error('[AI] Configuration error:', configError);
}

const client = new OpenAI({
  apiKey: AI_CONFIG.apiKey,
  baseURL: AI_CONFIG.baseURL,
  timeout: 55000,
  maxRetries: 1,
});

function assertApiKeyConfigured() {
  const error = getAiConfigError();
  if (error) throw new Error(error);
}

/** 从 DeepSeek R1 等推理模型的回复中提取 JSON */
function extractJsonContent(content: string): string {
  const withoutThink = content.replace(/[\s\S]*?<\/think>/g, '').trim();
  const jsonBlock = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonBlock) return jsonBlock[1].trim();

  const jsonStart = withoutThink.indexOf('{');
  const jsonEnd = withoutThink.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    return withoutThink.slice(jsonStart, jsonEnd + 1);
  }

  return withoutThink;
}

export async function generateCaseWithAI(difficulty: string, theme?: string): Promise<any> {
  const prompt = `你是世界顶级悬疑推理编剧。请生成一个完整的剧本杀案件。

要求：
1. 三名嫌疑人都必须有充分的作案动机和可疑行为
2. 真凶不能一眼看出，至少有两层误导
3. 至少3条关键线索需要交叉推理才能得出真相
4. 作案手法必须逻辑闭环，经得起推敲
5. 结局要有"原来如此"的震撼感
6. 每个角色都有秘密，但不是所有秘密都与案件相关

难度级别：${difficulty}
${theme ? `主题偏好：${theme}` : ''}

请以JSON格式返回，包含：
- title: 案件标题（吸引人）
- setting: 案发地点
- victim: 受害者信息（姓名、性别male或female、年龄、职业、背景）
- deathMethod: 死亡方式
- sceneDescription: 案发现场详细描述（500字）
- suspects: 三名嫌疑人数组，每人包含：
  - id, name, gender（male或female）, age, occupation, relationship（与死者关系）
  - alibi（不在场证明）
  - motive（动机）
  - personality（性格特点）
  - secrets（秘密数组，至少2个）
  - isGuilty（是否是真凶）
- evidence: 证据数组（至少6条），每条包含：
  - id, name, description, location, significance
  - relatedSuspects（相关嫌疑人ID数组）
- timeline: 时间线数组（至少8个事件），每个包含：
  - time, event, location, witness
  - significance（low/medium/high/critical）
- truth: 真相对象，包含：
  - killer（凶手姓名）
  - method（详细作案手法）
  - motive（真实动机）
  - process（作案过程数组，至少5步）
  - keyClues（关键线索数组）
- redHerrings: 红鲱鱼误导线索数组（至少3条）

请确保案件质量达到专业剧本杀水平，推理链条严密，不要有逻辑漏洞。只返回JSON，不要其他文字。`;

  try {
    assertApiKeyConfigured();
    console.log('[AI] Starting case generation...');
    console.log('[AI] Difficulty:', difficulty);
    console.log('[AI] Theme:', theme || 'none');

    const completion = await client.chat.completions.create({
      model: AI_CONFIG.textModel,
      messages: [
        {
          role: 'system',
          content: '你是专业的悬疑推理编剧，擅长创作高质量剧本杀案件。请直接输出合法 JSON。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.9,
      response_format: { type: 'json_object' },
    });

    console.log('[AI] Case generation successful');
    const content = completion.choices[0].message.content;
    return JSON.parse(extractJsonContent(content || '{}'));
  } catch (error: any) {
    console.error('[AI] Case generation failed:', {
      message: error.message,
      status: error.status,
      type: error.type,
      code: error.code,
    });
    throw error;
  }
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    assertApiKeyConfigured();
    console.log('[AI] Generating image with prompt:', prompt.substring(0, 100));

    const response = await client.images.generate({
      model: AI_CONFIG.imageModel,
      prompt,
      n: 1,
      size: '1024x1024',
    });

    const imageData = response.data?.[0];

    if (!imageData) {
      console.log('[AI] No image data returned');
      return '';
    }

    if (imageData.url) {
      console.log('[AI] Image URL generated successfully');
      return imageData.url;
    }

    if (imageData.b64_json) {
      const dataUrl = `data:image/png;base64,${imageData.b64_json}`;
      console.log('[AI] Image generated as base64');
      return dataUrl;
    }

    console.log('[AI] No valid image data found');
    return '';
  } catch (error: any) {
    console.error('[AI] Image generation failed:', {
      message: error.message,
      status: error.status,
    });
    return '';
  }
}

export async function chatWithSuspect(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<string> {
  try {
    assertApiKeyConfigured();
    console.log('[AI] Starting suspect chat...');
    const completion = await client.chat.completions.create({
      model: AI_CONFIG.chatModel,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      temperature: 0.8,
      max_tokens: 300,
    });

    console.log('[AI] Suspect chat successful');
    const content = completion.choices[0].message.content || '';
    return content.replace(/[\s\S]*?<\/think>/g, '').trim() || '我不想回答这个问题。';
  } catch (error: any) {
    console.error('[AI] Chat failed:', {
      message: error.message,
      status: error.status,
    });

    if (error.status === 401) {
      return '（系统错误：API 密钥无效，请检查 SILICONFLOW_API_KEY）';
    }
    if (error.status === 429) {
      return '（系统错误：API 调用频率过高，请稍后重试）';
    }
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return '（系统错误：API 请求超时）';
    }
    if (error.message) {
      return `（系统错误：${error.message}）`;
    }

    return '抱歉，我现在有点紧张，不知道该说什么...';
  }
}

export async function evaluateDeduction(
  caseData: any,
  userDeduction: string
): Promise<any> {
  if (!caseData?.truth) {
    console.error('案件数据缺少 truth 对象:', caseData);
    throw new Error('案件数据不完整：缺少真相信息');
  }

  const { killer, method, motive, process } = caseData.truth;
  if (!killer || !method || !motive) {
    console.error('truth 对象字段不完整:', caseData.truth);
    throw new Error('案件真相数据不完整');
  }

  const processText = Array.isArray(process) ? process.join(' → ') : '未知';

  const prompt = `你是专业的推理评分系统。请评估用户的推理。

案件真相：
- 凶手：${killer}
- 手法：${method}
- 动机：${motive}
- 作案过程：${processText}

用户推理：
${userDeduction}

评分标准：
1. 凶手身份（40分）：是否正确指认凶手
2. 作案手法（30分）：是否理解作案手法和诡计
3. 动机分析（20分）：是否找到真实动机
4. 逻辑链条（10分）：推理过程是否严密

请返回JSON格式：
{
  "score": 总分（0-100）,
  "breakdown": {
    "killer": 得分,
    "method": 得分,
    "motive": 得分,
    "logic": 得分
  },
  "feedback": "详细评价（200字）",
  "rating": "评级（神探/优秀侦探/合格侦探/被凶手玩弄/冤枉好人）",
  "missedClues": ["遗漏的关键线索"]
}

只返回JSON，不要其他文字。`;

  try {
    assertApiKeyConfigured();
    console.log('[AI] Starting deduction evaluation...');
    const completion = await client.chat.completions.create({
      model: AI_CONFIG.textModel,
      messages: [
        {
          role: 'system',
          content: '你是专业的推理评分系统。请直接输出合法 JSON。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0].message.content;
    console.log('[AI] Evaluation successful');

    if (!content) {
      throw new Error('AI 返回内容为空');
    }

    return JSON.parse(extractJsonContent(content));
  } catch (error: any) {
    console.error('[AI] Evaluation failed:', {
      message: error.message,
      status: error.status,
    });

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('API 请求超时，请稍后重试');
    }
    if (error.status === 429) {
      throw new Error('API 调用频率过高，请稍后重试');
    }
    if (error.status === 401) {
      throw new Error('API 密钥无效，请检查 SILICONFLOW_API_KEY');
    }

    throw error;
  }
}
