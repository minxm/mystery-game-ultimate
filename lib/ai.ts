import {
  AI_CONFIG,
  getAiConfigError,
  isServerlessEnv,
  chatJsonCompletion,
  chatCompletion,
  chatCompletionStream,
  imageGeneration,
  createEmbeddings as aiCreateEmbeddings,
  buildContext,
} from './ai-service';
import {
  validateCaseBase,
  validateCaseCast,
  validateCaseDetails,
  validateFullCase,
} from './case-schema';
import { serializeCaseForPrompt } from './case-prompt';
import {
  CaseImagePrompts,
  IMAGE_CHARACTER_EXTRA,
  IMAGE_NEGATIVE_HINT,
  IMAGE_SCENE_NEGATIVE_HINT,
  IMAGE_STYLE_SUFFIX,
  ageAppropriateFaceHint,
  buildFallbackImagePrompts,
  normalizeImagePrompts,
} from './image-prompt';
import { getScoreRating } from './utils';

const configError = getAiConfigError();

console.log('[AI] Initializing SiliconFlow client...');
console.log('[AI] API Key source:', AI_CONFIG.apiKeySource);
console.log('[AI] API Key exists:', !!AI_CONFIG.apiKey);
console.log('[AI] Base URL:', AI_CONFIG.baseURL);
console.log('[AI] Case framework model:', AI_CONFIG.caseFrameworkModel);
console.log('[AI] Case polish model:', AI_CONFIG.casePolishModel);
console.log('[AI] Chat model:', AI_CONFIG.chatModel);
console.log('[AI] Evaluate model:', AI_CONFIG.evaluateModel);
console.log('[AI] Image prompt model:', AI_CONFIG.imagePromptModel);
console.log('[AI] Image model:', AI_CONFIG.imageModel);
console.log('[AI] Embedding model:', AI_CONFIG.embeddingModel);
if (configError) {
  console.error('[AI] Configuration error:', configError);
}

function isQwen3Model(model: string): boolean {
  return /Qwen\/Qwen3/i.test(model);
}

/** Qwen3 / Qwen3.5 思考模型默认极慢；JSON 生成必须关闭 thinking */
function getThinkingDisabledExtraBody(model: string): Record<string, unknown> {
  if (!isQwen3Model(model)) return {};
  return { extra_body: { enable_thinking: false } };
}

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

function buildStructuredCasePrompt(difficulty: string, theme?: string) {
  const era = pick(ERAS);
  const location = pick(LOCATIONS);
  const motif = pick(MOTIFS);
  const deathHint = pick(DEATH_METHODS);
  const victimRole = pick(VICTIM_ROLES);
  const guiltyPos = Math.floor(Math.random() * 3);
  const guiltyId = `s${guiltyPos + 1}`;
  const innocentIds = ['s1', 's2', 's3'].filter((id) => id !== guiltyId).join(' 和 ');

  return `你是世界顶级悬疑推理编剧。请一次性生成完整剧本杀案件的结构化 JSON。

难度：${difficulty}
${theme ? `主题偏好：${theme}` : ''}

【本次随机创作参数，必须严格遵照】
- 时代背景：${era}
- 案发地点：${location}
- 核心矛盾：${motif}
- 死亡方式参考：${deathHint}
- 受害者职业参考：${victimRole}

【质量要求】
1. 三名嫌疑人动机与可疑行为均充分，真凶仅 ${guiltyId}（isGuilty:true），${innocentIds} 必须为 false
2. 至少两层误导（redHerrings），至少 3 条关键线索需交叉推理
3. 作案手法逻辑闭环；每个角色有 secrets，但并非都与案件相关
4. 使用个性中文名（如凌霜月、方若水），严禁张三李四

【JSON 结构】
{
  "title": "5-10字标题",
  "setting": "具体场所",
  "victim": { "name", "gender": "male|female", "age", "occupation", "background": "50字内" },
  "deathMethod": "死亡方式",
  "sceneDescription": "150字内现场描述，含一处异常细节",
  "suspects": [
    { "id": "s1|s2|s3", "name", "gender", "age", "occupation", "relationship", "alibi": "30字内", "motive": "30字内", "personality": "20字内", "secrets": ["..."], "isGuilty": true|false }
  ],
  "evidence": [ { "id": "e1-e4", "name", "description": "40字内", "location", "significance", "relatedSuspects": ["s1"] } ],
  "timeline": [ { "time", "event": "30字内", "location", "significance": "low|medium|high|critical" } ],
  "truth": { "killer": "与 isGuilty:true 同名", "method": "80字内", "motive": "40字内", "process": ["步骤1","步骤2","步骤3"], "keyClues": ["线索1","线索2"] },
  "redHerrings": ["误导1","误导2"]
}

evidence 4 条，timeline 5 条，redHerrings 2 条。只输出 JSON，不要 markdown 或解释。`;
}

/** Qwen3.5-4B 框架 prompt：字段齐全但文案从简，供后续 8B 润色 */
function buildCaseFrameworkPrompt(difficulty: string, theme?: string) {
  const era = pick(ERAS);
  const location = pick(LOCATIONS);
  const motif = pick(MOTIFS);
  const deathHint = pick(DEATH_METHODS);
  const victimRole = pick(VICTIM_ROLES);
  const guiltyPos = Math.floor(Math.random() * 3);
  const guiltyId = `s${guiltyPos + 1}`;
  const innocentIds = ['s1', 's2', 's3'].filter((id) => id !== guiltyId).join(' 和 ');

  return `你是悬疑案件架构师。请快速输出一份「案件框架 JSON」（骨架即可，描述从简，后续会润色）。

难度：${difficulty}
${theme ? `主题：${theme}` : ''}

【创作参数，必须遵照】
时代：${era} | 地点：${location} | 矛盾：${motif} | 死因参考：${deathHint} | 受害者职业参考：${victimRole}

【逻辑约束】
- 真凶仅 ${guiltyId}（isGuilty:true），${innocentIds} 为 false
- 逻辑闭环，个性中文名，严禁张三李四
- 文案从简：background/alibi/motive 各 20 字内，sceneDescription 80 字内

【JSON 结构 — 字段必须齐全】
{
  "title", "setting",
  "victim": { "name", "gender", "age", "occupation", "background" },
  "deathMethod", "sceneDescription",
  "suspects": [ { "id":"s1|s2|s3", "name", "gender", "age", "occupation", "relationship", "alibi", "motive", "personality", "secrets":["..."], "isGuilty" } ],
  "evidence": [ { "id":"e1-e4", "name", "description", "location", "significance", "relatedSuspects" } ],
  "timeline": [ { "time", "event", "location", "significance" } ],
  "truth": { "killer", "method", "motive", "process":["..."], "keyClues":["..."] },
  "redHerrings": ["...", "..."]
}

suspects 3 人，evidence 4 条，timeline 5 条，redHerrings 2 条。只输出 JSON。`;
}

function buildCasePolishPrompt(
  difficulty: string,
  framework: Record<string, unknown>,
  theme?: string
) {
  return `你是世界顶级悬疑推理编剧。请对下方「案件框架 JSON」进行润色，输出同结构的完整 JSON。

难度：${difficulty}
${theme ? `主题：${theme}` : ''}

【硬性约束 — 不得修改】
1. suspects 的 id、isGuilty、真凶身份（truth.killer 与 isGuilty:true 同名）
2. evidence / timeline 的数量与各 id（e1-e4、s1-s3）
3. relatedSuspects 与 truth.keyClues 的逻辑指向
4. 整体作案逻辑闭环

【润色要求】
1. 丰富 sceneDescription（150 字内）、victim.background、嫌疑人 personality/secrets
2. 强化 evidence 与 timeline 的交叉推理价值，完善 redHerrings 误导层
3. 润色 truth.method/process，增强「原来如此」的反转感
4. 保持个性中文名，禁止张三李四

【案件框架 JSON】
${JSON.stringify(framework)}

只输出润色后的完整 JSON，不要 markdown 或解释。`;
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

// 多个独立维度各自随机选取，组合数 = 各维度数量之积（可达数十万），
// 加上 AI 自身创造性，实际案件几乎不会重复。
const ERAS = [
  '民国时期', '清末民初', '二十世纪七十年代', '当代都市', '近未来科技社会',
  '架空古代', '八十年代改革浪潮中', '九十年代香港回归前夕', '当代小城镇', '抗战时期后方',
];
const LOCATIONS = [
  '孤悬海外的豪华游轮', '封闭式山顶精英学院', '荒岛度假别墅',
  '高档私人会所顶层', '百年家族老宅', '跨国艺术品拍卖行后台',
  '高铁私人包厢', '星级温泉酒店', '废弃工厂改建的艺术空间',
  '深山禅修道场', '南极科考站', '孤立山区小镇', '地下赌场隐秘包间',
  '豪华私人飞机机舱', '著名大学图书馆密室', '租界时代的洋楼',
  '古镇戏班后台', '顶级医疗美容机构', '高档游艇俱乐部码头', '军事要地废弃营房',
];
const MOTIFS = [
  '巨额遗产争夺', '商业机密泄露', '隐秘复仇计划', '学术造假与利益链',
  '黑市文物交易', '政治献金丑闻', '伪造身份与过去的秘密',
  '多角情感纠葛', '医学伦理违规', '宗教极端组织渗透',
  '家族诅咒与祖传秘密', '谍报交锋与双面间谍', '高利贷与地下钱庄',
  '网络诈骗与数字证据', '演艺圈潜规则与权力游戏',
];
const DEATH_METHODS = [
  '剧毒下药', '机关陷阱致死', '伪造意外溺水', '高空坠落伪装跌落',
  '钝器袭击后移尸', '药物过量伪装自杀', '勒颈窒息', '放火焚烧毁证',
  '电击伪装触电事故', '过敏原投毒', '一氧化碳中毒伪装取暖事故',
  '枪伤伪装自卫', '锐器刺伤后二次移尸制造密室',
];
const VICTIM_ROLES = [
  '私家侦探', '前任政界人士', '顶级厨师', '著名作家', '古董鉴定师',
  '医学研究员', '金融操盘手', '退役特工', '娱乐圈经纪人', '慈善基金会会长',
  '黑帮洗白的企业家', '遗产律师', '知名博主', '大学院长', '航运公司老板',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildCaseBasePrompt(difficulty: string) {
  const era = pick(ERAS);
  const location = pick(LOCATIONS);
  const motif = pick(MOTIFS);
  const deathHint = pick(DEATH_METHODS);
  const victimRole = pick(VICTIM_ROLES);
  // 将多个维度注入 prompt，使每次生成的创作种子几乎独一无二
  return `你是顶级悬疑推理编剧。请生成一个剧本杀案件的基础设定，难度${difficulty}。

【本次随机创作参数，必须严格遵照，不得替换】
- 时代背景：${era}
- 案发地点：${location}
- 核心矛盾：${motif}
- 死亡方式参考：${deathHint}（可微调，但不得换成完全不同类型）
- 受害者职业参考：${victimRole}（可微调，保持职业大类）

【命名要求】使用个性鲜明的中文名，风格参考：凌霜月、方若水、沈云霄、祁凌霜、程烟雨。严禁张三李四王五。

【输出格式】严格按以下 JSON 结构，所有字段内容必须完全原创，不得照抄或套用任何已有示例：
{"title":"（原创标题，含地名或意象，5-10字）","setting":"（具体场所，含环境细节）","victim":{"name":"（原创名字）","gender":"male或female","age":（数字）,"occupation":"（职业）","background":"（50字内，含一个隐秘的把柄或秘密）"},"deathMethod":"（死亡方式）","sceneDescription":"（150字内生动现场描述，包含至少一处异常细节）"}
只输出 JSON，不要任何解释或 markdown。`;
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

async function callCaseJson(
  prompt: string,
  maxTokens: number,
  model: string = AI_CONFIG.casePolishModel,
  roleHint = '悬疑推理编剧',
  operation: 'case_framework' | 'case_polish' | 'case_full' | 'case_base' | 'case_cast' | 'case_details' | 'image_prompt' = 'case_full'
) {
  assertApiKeyConfigured();
  const completion = await chatJsonCompletion(
    buildContext(operation),
    model,
    [
      {
        role: 'system',
        content: `/no_think\n你是${roleHint}。只输出一个合法 JSON 对象，禁止任何解释、markdown 代码块、思考过程或重复内容。`,
      },
      { role: 'user', content: prompt },
    ],
    {
      maxTokens,
      temperature: 0.6,
      frequencyPenalty: 0.3,
      extra: getThinkingDisabledExtraBody(model),
    }
  );
  const choice = completion.choices[0];
  const finishReason = choice.finish_reason;
  if (finishReason === 'length') {
    throw new Error(`AI output truncated (max_tokens=${maxTokens}, finish_reason=length)`);
  }
  const content = choice.message.content;
  return JSON.parse(extractJsonContent(content || '{}'));
}

/** Qwen3.5-4B 生成案件框架 JSON */
export async function generateCaseFrameworkWithAI(
  difficulty: string,
  theme?: string
): Promise<Record<string, unknown>> {
  const serverless = isServerlessEnv();
  const prompt = serverless
    ? buildServerlessCasePrompt(difficulty, theme)
    : buildCaseFrameworkPrompt(difficulty, theme);
  const maxTokens =
    difficulty === 'hard' || difficulty === 'expert'
      ? serverless
        ? 4096
        : 6144
      : serverless
        ? 3072
        : 4096;

  console.log('[AI] Generating case framework...');
  console.log('[AI] Framework model:', AI_CONFIG.caseFrameworkModel);

  const raw = await callCaseJson(
    prompt,
    maxTokens,
    AI_CONFIG.caseFrameworkModel,
    '悬疑案件架构师',
    'case_framework'
  );
  return validateFullCase(raw);
}

/** Qwen3-8B 润色案件框架为完整可玩 JSON */
export async function polishCaseWithAI(
  difficulty: string,
  framework: Record<string, unknown>,
  theme?: string
): Promise<Record<string, unknown>> {
  const serverless = isServerlessEnv();
  const prompt = buildCasePolishPrompt(difficulty, framework, theme);
  const maxTokens = serverless ? 4096 : 6144;

  console.log('[AI] Polishing case JSON...');
  console.log('[AI] Polish model:', AI_CONFIG.casePolishModel);

  const raw = await callCaseJson(
    prompt,
    maxTokens,
    AI_CONFIG.casePolishModel,
    '悬疑推理编剧',
    'case_polish'
  );
  return validateFullCase(raw);
}

/** 框架 + 润色两阶段生成（推荐路径） */
export async function generateCaseWithFrameworkAndPolish(
  difficulty: string,
  theme?: string
): Promise<Record<string, unknown>> {
  const framework = await generateCaseFrameworkWithAI(difficulty, theme);
  return polishCaseWithAI(difficulty, framework, theme);
}

/** Qwen3-8B 一次性生成完整案件（备用） */
export async function generateFullCaseWithAI(
  difficulty: string,
  theme?: string
): Promise<Record<string, unknown>> {
  const serverless = isServerlessEnv();
  const prompt = serverless
    ? buildServerlessCasePrompt(difficulty, theme)
    : buildStructuredCasePrompt(difficulty, theme);
  const maxTokens = serverless ? 4096 : 6144;

  console.log('[AI] Generating full case JSON (single-shot fallback)...');
  console.log('[AI] Polish model:', AI_CONFIG.casePolishModel);
  console.log('[AI] Serverless mode:', serverless);

  const raw = await callCaseJson(
    prompt,
    maxTokens,
    AI_CONFIG.casePolishModel,
    '悬疑推理编剧',
    'case_full'
  );
  return validateFullCase(raw);
}

export async function generateCaseBaseWithAI(difficulty: string): Promise<any> {
  console.log('[AI] Generating case base...');
  const maxTokens =
    difficulty === 'hard' || difficulty === 'expert' ? 3000 : difficulty === 'medium' ? 2000 : 1500;
  const raw = await callCaseJson(
    buildCaseBasePrompt(difficulty),
    maxTokens,
    AI_CONFIG.caseFrameworkModel,
    '悬疑推理编剧',
    'case_base'
  );
  return validateCaseBase(raw);
}

export async function generateCaseCastWithAI(
  difficulty: string,
  base: Record<string, unknown>
): Promise<any> {
  console.log('[AI] Generating case cast...');
  const raw = await callCaseJson(
    buildCaseCastPrompt(difficulty, base),
    3000,
    AI_CONFIG.caseFrameworkModel,
    '悬疑推理编剧',
    'case_cast'
  );
  return validateCaseCast(raw);
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
  const raw = await callCaseJson(
    buildCaseDetailsPrompt(difficulty, core),
    2000,
    AI_CONFIG.caseFrameworkModel,
    '悬疑推理编剧',
    'case_details'
  );
  return validateCaseDetails(raw);
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
    console.log('[AI] Case model:', AI_CONFIG.casePolishModel);

    const completion = await chatJsonCompletion(
      buildContext('case_full'),
      AI_CONFIG.casePolishModel,
      [
        {
          role: 'system',
          content:
            '/no_think\n你是悬疑推理编剧。必须直接输出合法 JSON，不要输出思考过程或 markdown 代码块。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      {
        maxTokens: serverless ? 3072 : 6144,
        temperature: serverless ? 0.7 : 0.8,
        frequencyPenalty: 0.3,
        extra: getThinkingDisabledExtraBody(AI_CONFIG.casePolishModel),
      }
    );

    console.log('[AI] Case generation successful');
    const content = completion.choices[0].message.content;
    const raw = JSON.parse(extractJsonContent(content || '{}'));
    return validateFullCase(raw);
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

/** Qwen3-8B 根据案件 JSON 批量生成 Kolors 英文绘画 prompt */
export async function generateImagePromptsWithAI(
  caseContent: Record<string, unknown>
): Promise<CaseImagePrompts> {
  const fallback = buildFallbackImagePrompts(caseContent);
  try {
    assertApiKeyConfigured();
    const caseJson = serializeCaseForPrompt(caseContent as Parameters<typeof serializeCaseForPrompt>[0]);
    const suspectIds = Array.isArray(caseContent.suspects)
      ? (caseContent.suspects as Array<{ id?: string }>).map((s, i) => s.id || `s${i + 1}`)
      : ['s1', 's2', 's3'];

    const prompt = `你是 AI 绘画提示词工程师。根据下方案件 JSON，为 Kwai-Kolors 文生图模型生成英文 prompt。

【案件 JSON】
${caseJson}

【画风 — 必须严格贴近「名侦探柯南」TV 动画（TMS 赛璐珞）】
- 细线条、平涂赛璐珞、冷色悬疑光影、2000 年代日本 TV 动画质感
- 现场图参考柯南剧集里的案发现场背景美术
- 每条 prompt 末尾必须包含画风标签：${IMAGE_STYLE_SUFFIX}

【人物 — 原创角色，严禁撞脸柯南/工藤新一】
- 禁止：圆脸大眼镜、红领结、蓝色校服、小学生侦探、工藤新一/柯南标志性发型与五官
- 必须：original unique character design, distinctive face, unique hairstyle
- 必须根据 age 写清面部年龄感：${ageAppropriateFaceHint(30)}（按各角色实际 age 替换）
- 人物 prompt 还必须包含：${IMAGE_CHARACTER_EXTRA}

【负向描述 — 每条 prompt 末尾追加】
- 人物：${IMAGE_NEGATIVE_HINT}
- 现场 scene：${IMAGE_SCENE_NEGATIVE_HINT}

【生成要求】
1. scene：案发现场背景，宽景构图，无人物，与 sceneDescription、deathMethod、setting 一致，柯南动画背景画风
2. victim：受害者半身肖像，符合 name/gender/age/occupation/background，哀婉气质，成人用成人比例
3. suspects：为 ${suspectIds.join('、')} 各生成一条半身肖像，体现 personality、occupation、relationship；guarded/suspicious；三人脸型/发型/五官必须互不相同

每条 prompt 80-130 英文词，专注视觉描述（外貌、服装、光线、构图）。

返回 JSON：
{
  "scene": "英文 prompt",
  "victim": "英文 prompt",
  "suspects": { "${suspectIds[0] || 's1'}": "...", ... }
}

只输出 JSON。`;

    console.log('[AI] Generating image prompts with Qwen3-8B...');
    const completion = await chatJsonCompletion(
      buildContext('image_prompt'),
      AI_CONFIG.imagePromptModel,
      [
        {
          role: 'system',
          content:
            '/no_think\n你是 AI 绘画提示词工程师。画风固定为名侦探柯南 TV 动画赛璐珞风，人物必须是原创面孔、禁止工藤新一/柯南造型。只输出合法 JSON，prompt 为英文。',
        },
        { role: 'user', content: prompt },
      ],
      {
        maxTokens: 2048,
        temperature: 0.7,
        extra: getThinkingDisabledExtraBody(AI_CONFIG.imagePromptModel),
      }
    );

    const content = completion.choices[0].message.content;
    if (!content) throw new Error('图片 prompt 返回为空');

    const raw = JSON.parse(extractJsonContent(content));
    const normalized = normalizeImagePrompts(raw, caseContent);
    console.log('[AI] Image prompts generated successfully');
    return normalized;
  } catch (error) {
    console.warn('[AI] Image prompt generation failed, using fallback:', (error as Error)?.message);
    return fallback;
  }
}

export async function generateImage(prompt: string): Promise<string> {
  return generateImageWithRetry(prompt);
}

/** 单张图片生成，失败自动重试，优先返回 data URI 避免 S3 签名 URL 过期 */
export async function generateImageWithRetry(prompt: string, maxAttempts = 3): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await generateImageOnce(prompt);
      if (result) {
        if (attempt > 1) {
          console.log(`[AI] Image generated on attempt ${attempt}`);
        }
        return result;
      }
    } catch (error) {
      lastError = error;
      console.warn(`[AI] Image attempt ${attempt}/${maxAttempts} failed:`, (error as Error)?.message);
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  if (lastError) {
    console.error('[AI] Image generation failed after retries:', (lastError as Error)?.message);
  }
  return '';
}

async function generateImageOnce(prompt: string): Promise<string> {
  assertApiKeyConfigured();
  console.log('[AI] Generating image with prompt:', prompt.substring(0, 100));

  let response;
  try {
    response = await imageGeneration(buildContext('image_generate'), prompt, {
      responseFormat: 'b64_json',
    });
  } catch (error: any) {
    // 部分模型不支持 response_format，降级为默认返回
    console.warn('[AI] b64_json request failed, retrying without response_format:', error?.message);
    response = await imageGeneration(buildContext('image_generate'), prompt);
  }

  const imageData = response.data?.[0];
  if (!imageData) {
    console.log('[AI] No image data returned');
    return '';
  }

  // 优先 b64：嵌入案件数据，不会因 S3 临时 URL 过期而「过一阵没图」
  if (imageData.b64_json) {
    console.log('[AI] Image generated as base64');
    return `data:image/png;base64,${imageData.b64_json}`;
  }

  if (imageData.url) {
    console.log('[AI] Image URL generated, persisting to data URI...');
    return persistRemoteImage(imageData.url);
  }

  console.log('[AI] No valid image data found');
  return '';
}

/** 将远程图片拉取为 data URI，避免签名 URL 过期后前端加载失败 */
async function persistRemoteImage(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
    if (!res.ok) return url;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type')?.split(';')[0] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (e) {
    console.warn('[AI] Failed to persist remote image, using URL:', (e as Error)?.message);
    return url;
  }
}

/** 案件知识库向量嵌入（BAAI/bge-m3） */
export async function createEmbeddings(inputs: string[]): Promise<number[][]> {
  return aiCreateEmbeddings(buildContext('embedding'), inputs);
}

function cleanSuspectReply(content: string): string {
  return content.replace(/[\s\S]*?<\/think>/g, '').trim() || '我不想回答这个问题。';
}

export function formatSuspectChatError(error: unknown): string {
  const err = error as { status?: number; code?: string; message?: string };
  if (err.status === 401) {
    return '（系统错误：API 密钥无效，请检查 SILICONFLOW_API_KEY）';
  }
  if (err.status === 429) {
    return '（系统错误：API 调用频率过高，请稍后重试）';
  }
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return '（系统错误：API 请求超时）';
  }
  if (err.message) {
    return `（系统错误：${err.message}）`;
  }
  return '抱歉，我现在有点紧张，不知道该说什么...';
}

/** 流式审讯对话，返回 OpenAI SSE chunk 迭代器 */
export async function createSuspectChatStream(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
) {
  assertApiKeyConfigured();
  console.log('[AI] Starting suspect chat stream (GLM roleplay)...');
  return chatCompletionStream(
    buildContext('chat_interrogate'),
    AI_CONFIG.chatModel,
    [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
    { temperature: 0.8, maxTokens: 300 }
  );
}

export async function chatWithSuspect(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<string> {
  try {
    assertApiKeyConfigured();
    console.log('[AI] Starting suspect chat (GLM roleplay)...');
    const completion = await chatCompletion(
      buildContext('chat_interrogate'),
      AI_CONFIG.chatModel,
      [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      { temperature: 0.8, maxTokens: 300 }
    );

    console.log('[AI] Suspect chat successful');
    const content = completion.choices[0].message.content || '';
    return cleanSuspectReply(content);
  } catch (error: unknown) {
    console.error('[AI] Chat failed:', {
      message: (error as Error)?.message,
      status: (error as { status?: number })?.status,
    });
    return formatSuspectChatError(error);
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

  const caseJson = serializeCaseForPrompt(caseData);
  const processText = Array.isArray(process) ? process.join(' → ') : '未知';

  const prompt = `你是专业的推理评分系统。请基于下方「案件设定 JSON」评估玩家的推理过程。

【案件设定 JSON】
${caseJson}

【标准答案摘要】
- 凶手：${killer}
- 手法：${method}
- 动机：${motive}
- 作案过程：${processText}

【玩家推理】
${userDeduction}

【评分标准】（各项独立，互不影响）
1. 凶手身份（0-40 分）：是否指认「${killer}」。指对 40 分，指错 0 分。
2. 作案手法（0-30 分）：是否理解手法与诡计，可按吻合程度给部分分。
3. 动机分析（0-20 分）：是否找到真实动机，可按吻合程度给部分分。
4. 逻辑链条（0-10 分）：推理是否严密、是否利用 keyClues 与 evidence。

【输出要求】
- killerCorrect 必须严格等于「玩家是否把 ${killer} 指认为凶手」
- missedClues 从 truth.keyClues 与 evidence 中列出玩家未提及的关键线索
- feedback 需解释各项得分依据（约 200 字）

返回 JSON：
{
  "killerCorrect": true 或 false,
  "breakdown": { "killer": 0-40, "method": 0-30, "motive": 0-20, "logic": 0-10 },
  "feedback": "详细评价",
  "missedClues": ["遗漏线索"]
}

只返回 JSON。`;

  try {
    assertApiKeyConfigured();
    console.log('[AI] Starting deduction evaluation (DeepSeek-R1)...');
    const completion = await chatJsonCompletion(
      buildContext('evaluate'),
      AI_CONFIG.evaluateModel,
      [
        {
          role: 'system',
          content: '你是专业的推理评分系统。请直接输出合法 JSON。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      { maxTokens: 2048, temperature: 0.3 }
    );

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
