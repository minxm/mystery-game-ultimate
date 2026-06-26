import OpenAI from 'openai';
import { AI_CONFIG, getAiConfigError, isServerlessEnv } from './ai-config';

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
  timeout: isServerlessEnv() ? 26000 : 55000,
  maxRetries: 0,
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

function buildFullCasePrompt(difficulty: string, theme?: string) {
  return `你是世界顶级悬疑推理编剧。请生成一个完整的剧本杀案件。

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
- title, setting
- victim: { name, gender(male/female), age, occupation, background }
- deathMethod, sceneDescription(500字)
- suspects: 3人，每人 { id, name, gender, age, occupation, relationship, alibi, motive, personality, secrets[2], isGuilty }
- evidence: 6条 { id, name, description, location, significance, relatedSuspects }
- timeline: 8个事件 { time, event, location, witness, significance }
- truth: { killer, method, motive, process[5], keyClues }
- redHerrings: 3条

只返回JSON。`;
}

function buildServerlessCasePrompt(difficulty: string, theme?: string) {
  return `生成一个剧本杀案件 JSON，难度：${difficulty}${theme ? `，主题：${theme}` : ''}。

字段（保持简洁，控制总输出长度）：
- title, setting
- victim: { name, gender(male/female), age, occupation, background(50字内) }
- deathMethod, sceneDescription(150字内)
- suspects: 3人 { id(s1/s2/s3), name, gender, age, occupation, relationship, alibi(30字), motive(30字), personality(20字), secrets[1], isGuilty }
- evidence: 5条 { id(e1-e5), name, description(40字), location, significance, relatedSuspects }
- timeline: 5个 { time, event(30字), location, significance }
- truth: { killer, method(80字), motive(40字), process[4], keyClues[3] }
- redHerrings: 2条

要求：逻辑闭环，真凶仅1人，只返回JSON。`;
}

function buildCaseBasePrompt(difficulty: string) {
  return `难度${difficulty}。只输出JSON：
{"title":"","setting":"","victim":{"name","gender","age","occupation","background"},"deathMethod":"","sceneDescription":""}
字段简短。`;
}

function buildCaseCastPrompt(difficulty: string, base: Record<string, unknown>) {
  return `难度${difficulty}。案件：${JSON.stringify(base)}
只输出JSON：
{"suspects":[{"id":"s1|s2|s3","name","gender","age","occupation","relationship","alibi","motive","personality","secrets":[""],"isGuilty":false}],
"truth":{"killer":"","method":"","motive":"","process":[""],"keyClues":[""]}}
3嫌疑人，1真凶。`;
}

function buildCaseDetailsPrompt(difficulty: string, core: Record<string, unknown>) {
  const summary = JSON.stringify({
    title: core.title,
    setting: core.setting,
    victim: (core.victim as any)?.name,
    suspects: (core.suspects as any[])?.map((s) => ({ id: s.id, name: s.name })),
    killer: (core.truth as any)?.killer,
  });
  return `难度${difficulty}。案件：${summary}
只输出JSON：
{"evidence":[{"id":"e1-e4","name","description","location","significance","relatedSuspects":[]}],
"timeline":[{"time","event","location","significance"}],
"redHerrings":[""]}`;
}

async function callCaseJson(prompt: string, maxTokens: number) {
  assertApiKeyConfigured();
  const serverless = isServerlessEnv();
  const completion = await client.chat.completions.create({
    model: AI_CONFIG.textModel,
    messages: [
      {
        role: 'system',
        content: '你是悬疑推理编剧。只输出合法 JSON，不要 markdown 或思考过程。',
      },
      { role: 'user', content: prompt },
    ],
    temperature: serverless ? 0.6 : 0.9,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });
  const content = completion.choices[0].message.content;
  return JSON.parse(extractJsonContent(content || '{}'));
}

export async function generateCaseBaseWithAI(difficulty: string): Promise<any> {
  console.log('[AI] Generating case base...');
  return callCaseJson(buildCaseBasePrompt(difficulty), 512);
}

export async function generateCaseCastWithAI(
  difficulty: string,
  base: Record<string, unknown>
): Promise<any> {
  console.log('[AI] Generating case cast...');
  return callCaseJson(buildCaseCastPrompt(difficulty, base), 800);
}

export async function generateCaseCoreWithAI(difficulty: string, theme?: string): Promise<any> {
  const base = await generateCaseBaseWithAI(difficulty);
  const cast = await generateCaseCastWithAI(difficulty, base);
  return { ...base, ...cast };
}

export async function generateCaseDetailsWithAI(
  difficulty: string,
  core: Record<string, unknown>,
  theme?: string
): Promise<any> {
  console.log('[AI] Generating case details...');
  return callCaseJson(buildCaseDetailsPrompt(difficulty, core), 900);
}

export async function generateCaseWithAI(difficulty: string, theme?: string): Promise<any> {
  const serverless = isServerlessEnv();

  const prompt = serverless
    ? buildServerlessCasePrompt(difficulty, theme)
    : buildFullCasePrompt(difficulty, theme);

  try {
    assertApiKeyConfigured();
    console.log('[AI] Starting case generation...');
    console.log('[AI] Difficulty:', difficulty);
    console.log('[AI] Theme:', theme || 'none');
    console.log('[AI] Serverless mode:', serverless);
    console.log('[AI] Text model:', AI_CONFIG.textModel);

    const completion = await client.chat.completions.create({
      model: AI_CONFIG.textModel,
      messages: [
        {
          role: 'system',
          content:
            '你是悬疑推理编剧。必须直接输出合法 JSON，不要输出思考过程或 markdown 代码块。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: serverless ? 0.7 : 0.9,
      max_tokens: serverless ? 3072 : 8192,
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
