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

const BASE_THEMES = [
  { era: '民国时期', location: '租界洋楼内的私人宴会', motif: '家族秘辛与政治暗流' },
  { era: '当代', location: '孤悬海外的豪华游轮', motif: '巨额遗产争夺' },
  { era: '当代', location: '山顶封闭式精英学院', motif: '学术竞争与秘密社团' },
  { era: '现代', location: '深山古镇里的百年老宅', motif: '家族诅咒与隐秘复仇' },
  { era: '当代', location: '顶级艺术拍卖行的私藏展厅', motif: '赝品与黑市交易' },
  { era: '现代', location: '荒岛度假别墅', motif: '与外界失联的封闭密室' },
  { era: '当代', location: '顶层豪华私人会所', motif: '商业阴谋与权贵博弈' },
  { era: '现代', location: '废弃制药厂改建的艺术空间', motif: '实验伦理与黑色研究' },
  { era: '民国', location: '西湖边的茶馆与烟花里弄', motif: '谍报交锋与情仇纠葛' },
  { era: '当代', location: '高铁专属包厢内', motif: '短途旅途中的完美不在场证明' },
];

const DEATH_METHODS = [
  '剧毒下药', '机关陷阱', '伪造意外溺水', '高空坠落', '钝器袭击',
  '药物过量伪装自杀', '勒颈窒息', '放火焚烧', '电击伪装触电事故',
];

function buildCaseBasePrompt(difficulty: string) {
  const theme = BASE_THEMES[Math.floor(Math.random() * BASE_THEMES.length)];
  const deathHint = DEATH_METHODS[Math.floor(Math.random() * DEATH_METHODS.length)];
  return `你是悬疑推理编剧，请基于以下随机主题生成一个全新的剧本杀案件基础设定，难度${difficulty}。

主题方向（必须以此为核心，不得偏离）：
- 时代背景：${theme.era}
- 案发地点类型：${theme.location}
- 核心矛盾：${theme.motif}
- 参考死亡方式：${deathHint}（可据情节调整）

命名要求：使用有特色的中文名（取自自然意象、诗词、历史典故，如"凌霜月""方若水""沈云霄"等风格），严禁张三李四。

按以下 JSON 结构输出（字段内容完全原创，不得照抄任何示例）：
{"title":"【原创案件标题】","setting":"【具体案发场所描述】","victim":{"name":"【受害者名】","gender":"male或female","age":数字,"occupation":"【职业】","background":"【50字内背景，含隐秘动机】"},"deathMethod":"【死亡方式】","sceneDescription":"【150字内现场描述，细节生动】"}
只输出 JSON。`;
}

function buildCaseCastPrompt(difficulty: string, base: Record<string, unknown>) {
  const summary = JSON.stringify({
    title: base.title,
    setting: base.setting,
    victim: base.victim,
    deathMethod: base.deathMethod,
  });
  // 随机指定凶手位置，从 AI 生成阶段就打乱，彻底避免凶手总在末位
  const guiltyPos = Math.floor(Math.random() * 3); // 0,1,2
  const guiltyId = `s${guiltyPos + 1}`; // s1, s2, or s3
  const innocentIds = ['s1', 's2', 's3'].filter(id => id !== guiltyId).join(' 和 ');

  return `难度${difficulty}。已知案件背景：${summary}
请生成 3 名嫌疑人和案件真相。
命名要求：使用有特色中文名（取自自然意象、诗词、历史典故），严禁张三李四。
所有内容必须完全原创，与示例无关。

【强制要求】凶手必须是 ${guiltyId}（isGuilty:true），${innocentIds} 的 isGuilty 必须为 false。

按以下 JSON 结构输出（suspects 顺序固定为 s1、s2、s3）：
{"suspects":[{"id":"s1","name":"【名字】","gender":"male或female","age":数字,"occupation":"【职业】","relationship":"【与受害者关系】","alibi":"【不在场证明，30字内】","motive":"【作案动机，30字内】","personality":"【性格特征，20字内】","secrets":["【隐藏秘密】"],"isGuilty":【true或false】},{"id":"s2",...},{"id":"s3",...}],"truth":{"killer":"【与isGuilty:true的嫌疑人同名】","method":"【作案手法，80字内】","motive":"【真实动机，40字内】","process":["步骤1","步骤2","步骤3"],"keyClues":["线索1","线索2"]}}
只输出 JSON。`;
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
