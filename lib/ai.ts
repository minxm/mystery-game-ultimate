import OpenAI from 'openai';
import { AI_CONFIG, getAiConfigError, isServerlessEnv } from './ai-config';
import { getScoreRating } from './utils';

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
  timeout: isServerlessEnv() ? 120000 : 40000,
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
  return `生成一个剧本杀案件的基础设定，难度${difficulty}。
角色命名要求：使用有特色、个性鲜明的中文名（参考柯南式人物命名，可取自自然意象、诗词字词、历史典故等），严禁使用张三、李四、王五等平凡名字。
严格按下面的 JSON 结构填写真实内容（不要照抄示例文字），字段简短：
{"title":"沉月楼连环案","setting":"外滩旁的百年洋楼","victim":{"name":"沈云霄","gender":"male","age":52,"occupation":"古玩鉴定师","background":"以鉴定真伪闻名上海，藏有多件国宝，私下却以假乱真欺诈买家"},"deathMethod":"从高处坠落","sceneDescription":"死者被发现在顶层露台边缘，面朝下倒在青石板上，脑后有钝器击打痕迹。栏杆旁散落一枚袖扣，远处灯火阑珊，秋雨打湿了衣衫，现场诡异而静谧。"}
只输出 JSON。`;
}

function buildCaseCastPrompt(difficulty: string, base: Record<string, unknown>) {
  const summary = JSON.stringify({
    title: base.title,
    setting: base.setting,
    victim: base.victim,
    deathMethod: base.deathMethod,
  });
  return `难度${difficulty}。已知案件背景：${summary}
请生成 3 名嫌疑人和案件真相。
角色命名要求：使用有特色、个性鲜明的中文名（参考柯南式人物命名风格，可取自自然意象、诗词、历史典故），严禁使用张三、李四、王五等平凡名字。
严格按下面的 JSON 结构填写真实内容（不要照抄示例文字）：
{"suspects":[{"id":"s1","name":"程烟雨","gender":"female","age":28,"occupation":"秘书","relationship":"死者助理","alibi":"案发时声称在整理档案","motive":"工资拖欠数月","personality":"沉默寡言","secrets":["私下在找新工作"],"isGuilty":false},{"id":"s2","name":"方若水","gender":"male","age":45,"occupation":"合伙人","relationship":"死者商业伙伴","alibi":"案发时声称在打电话","motive":"被死者背刺夺走项目","personality":"城府极深表面和善","secrets":["已暗中转移公司资产"],"isGuilty":true},{"id":"s3","name":"祁凌霜","gender":"female","age":36,"occupation":"前妻","relationship":"离婚配偶","alibi":"案发时声称在餐厅用餐","motive":"争夺抚养权","personality":"情绪化易激动","secrets":["仍持有死者公司股份"],"isGuilty":false}],"truth":{"killer":"方若水","method":"趁其不备推落后伪造意外","motive":"阻止资产转移被曝光","process":["步骤一","步骤二"],"keyClues":["关键线索一"]}}
要求：suspects 恰好 3 人，id 依次为 s1/s2/s3；仅 1 人 isGuilty 为 true，且必须与 truth.killer 同名。只输出 JSON。`;
}

function buildCaseDetailsPrompt(difficulty: string, core: Record<string, unknown>) {
  const summary = JSON.stringify({
    title: core.title,
    setting: core.setting,
    deathMethod: (core as any).deathMethod,
    victim: (core.victim as any)?.name,
    suspects: (core.suspects as any[])?.map((s) => ({ id: s.id, name: s.name })),
    killer: (core.truth as any)?.killer,
    method: (core.truth as any)?.method,
  });
  return `难度${difficulty}。已知案件：${summary}
请根据案件的死亡方式和作案手法，生成与之匹配的证据、时间线和误导信息（证据内容必须与死亡方式、场景高度相关，不要生成与案件不符的物品）。
严格按下面的 JSON 结构填写真实内容（不要照抄示例文字，内容必须基于上方案件信息）：
{"evidence":[{"id":"e1","name":"褪色的门卫记录本","description":"记录了当晚出入人员，某一页被撕去","location":"大楼入口","significance":"关键时间线证据","relatedSuspects":["s2"]}],"timeline":[{"time":"21:15","event":"目击者在走廊看见嫌疑人快步离开","location":"三楼走廊","significance":"critical"}],"redHerrings":["一封语气激烈的匿名信，追查后与案件无关"]}
要求：evidence 4 条（id 为 e1-e4），timeline 5 条，redHerrings 2 条。relatedSuspects 用嫌疑人 id（s1/s2/s3）。只输出 JSON。`;
}

async function callCaseJson(prompt: string, maxTokens: number) {
  assertApiKeyConfigured();
  const completion = await client.chat.completions.create({
    model: AI_CONFIG.textModel,
    messages: [
      {
        role: 'system',
        content:
          '你是悬疑推理编剧。只输出一个合法 JSON 对象，禁止任何解释、markdown 代码块、思考过程或重复内容。',
      },
      { role: 'user', content: prompt },
    ],
    // 降低温度 + 频率惩罚，避免小概率的 token 重复退化（如 "isisis..." 死循环）
    temperature: 0.6,
    frequency_penalty: 0.3,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
  });
  const choice = completion.choices[0];
  const finishReason = choice.finish_reason;
  if (finishReason === 'length') {
    // 输出被 max_tokens 截断，JSON 不完整，直接报错让上层重试或使用 fallback
    throw new Error(`AI output truncated (max_tokens=${maxTokens}, finish_reason=length)`);
  }
  const content = choice.message.content;
  return JSON.parse(extractJsonContent(content || '{}'));
}

export async function generateCaseBaseWithAI(difficulty: string): Promise<any> {
  console.log('[AI] Generating case base...');
  // 中文每字约 1 token；title+setting+victim+deathMethod+sceneDescription 约 400-800 tokens
  return callCaseJson(buildCaseBasePrompt(difficulty), 1500);
}

export async function generateCaseCastWithAI(
  difficulty: string,
  base: Record<string, unknown>
): Promise<any> {
  console.log('[AI] Generating case cast...');
  // 3 名嫌疑人×8个字段 + truth 对象，约 1000-2000 tokens
  return callCaseJson(buildCaseCastPrompt(difficulty, base), 2500);
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
  // evidence(4条) + timeline(5条) + redHerrings(2条)，约 800-1500 tokens
  return callCaseJson(buildCaseDetailsPrompt(difficulty, core), 2000);
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
      temperature: serverless ? 0.7 : 0.8,
      frequency_penalty: 0.3,
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
  const suspectNames = Array.isArray(caseData.suspects)
    ? caseData.suspects.map((s: any) => s.name).filter(Boolean).join('、')
    : '未知';

  const prompt = `你是专业的推理评分系统。请评估用户的推理。

案件嫌疑人名单：${suspectNames}

案件真相：
- 凶手：${killer}
- 手法：${method}
- 动机：${motive}
- 作案过程：${processText}

用户推理：
${userDeduction}

评分标准（各项独立打分，不要相互影响）：
1. 凶手身份（0-40分）：用户指认的凶手是否为「${killer}」。指对得 40 分，指错得 0 分。
2. 作案手法（0-30分）：是否理解作案手法和诡计，可按吻合程度给部分分。
3. 动机分析（0-20分）：是否找到真实动机，可按吻合程度给部分分。
4. 逻辑链条（0-10分）：推理过程是否严密。

重要：killerCorrect 必须严格等于"用户是否把「${killer}」指认为凶手"。即使手法和动机分析错误，只要凶手指对，killerCorrect 也必须为 true。

请返回JSON格式：
{
  "killerCorrect": true 或 false,
  "breakdown": {
    "killer": 得分(0-40),
    "method": 得分(0-30),
    "motive": 得分(0-20),
    "logic": 得分(0-10)
  },
  "feedback": "详细评价（200字）",
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

    const raw = JSON.parse(extractJsonContent(content));

    // 各项得分钳制到上限，避免模型给出越界分数
    const clamp = (v: any, max: number) =>
      Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
    const breakdown = {
      killer: clamp(raw?.breakdown?.killer, 40),
      method: clamp(raw?.breakdown?.method, 30),
      motive: clamp(raw?.breakdown?.motive, 20),
      logic: clamp(raw?.breakdown?.logic, 10),
    };

    // 是否指对凶手：优先用模型显式判定，并与凶手项得分交叉校验
    const killerCorrect =
      typeof raw?.killerCorrect === 'boolean'
        ? raw.killerCorrect
        : breakdown.killer >= 24;

    // 凶手项得分与 killerCorrect 保持一致，防止"指对却给 0 分"或反之
    breakdown.killer = killerCorrect ? Math.max(breakdown.killer, 40) : 0;

    const score = breakdown.killer + breakdown.method + breakdown.motive + breakdown.logic;
    const ratingInfo = getScoreRating(score, killerCorrect);

    return {
      score,
      breakdown,
      killerCorrect,
      rating: ratingInfo.rating,
      feedback: raw?.feedback || '',
      missedClues: Array.isArray(raw?.missedClues) ? raw.missedClues : [],
    };
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
