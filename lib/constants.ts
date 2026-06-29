import { CaseData } from './types';

export const SETTINGS = [
  '雪山旅馆', '豪华别墅', '名校校园', '豪华邮轮', '古老宅邸',
  '现代美术馆', '秘密科研所', '未来空间站', '废弃医院', '暴雨山庄'
];

export const DEATH_METHODS = [
  '神秘中毒', '触电身亡', '高处坠落', '窒息死亡', '冷冻致死',
  '精密机关', '伪装自杀', '机械陷阱', '密室窒息', '延时毒杀'
];

export const TRICKS = [
  '时间差诡计', '监控伪造', '空间盲区', '录音误导', '双重密室',
  '身份互换', '延时杀人', '假死反转', '心理暗示', '物理陷阱'
];

export const MOTIVES = [
  '复仇计划', '遗产争夺', '婚外情纠葛', '学术剽窃', '旧案重启',
  '身份替代', '家族秘密', '秘密组织', '商业竞争', '情感背叛'
];

export const OCCUPATIONS = [
  '企业家', '律师', '医生', '教授', '艺术家', '记者', '侦探',
  '科学家', '演员', '作家', '警察', '心理医生', '建筑师', '厨师'
];

export const FIRST_NAMES = [
  '张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '郭', '林', '何', '高', '梁'
];

export const GIVEN_NAMES = [
  '明', '华', '强', '伟', '芳', '娜', '敏', '静', '丽', '军',
  '杰', '涛', '磊', '鹏', '婷', '雪', '梅', '霞', '燕', '玲'
];

export const CASE_GENERATION_PROMPT = `你是世界顶级悬疑推理编剧。请生成一个完整的剧本杀案件。

要求：
1. 三名嫌疑人都必须有充分的作案动机和可疑行为
2. 真凶不能一眼看出，至少有两层误导
3. 至少3条关键线索需要交叉推理才能得出真相
4. 作案手法必须逻辑闭环，经得起推敲
5. 结局要有"原来如此"的震撼感
6. 每个角色都有秘密，但不是所有秘密都与案件相关

请以JSON格式返回，包含：
- title: 案件标题（吸引人）
- setting: 案发地点
- victim: 受害者信息（姓名、年龄、职业、背景）
- deathMethod: 死亡方式
- sceneDescription: 案发现场详细描述（500字）
- suspects: 三名嫌疑人数组，每人包含：
  - name, age, occupation, relationship（与死者关系）
  - alibi（不在场证明）
  - motive（动机）
  - personality（性格特点）
  - secrets（秘密数组，至少2个）
  - isGuilty（是否是真凶）
- evidence: 证据数组（至少6条），每条包含：
  - name, description, location, significance
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

难度级别：{{difficulty}}
主题偏好：{{theme}}

请确保案件质量达到专业剧本杀水平，推理链条严密，不要有逻辑漏洞。`;

import { applyImageStyle, ageAppropriateFaceHint } from './image-prompt';

export const IMAGE_GENERATION_PROMPTS = {
  victim: (name: string, age: number, occupation: string) =>
    applyImageStyle(
      `Detective Conan anime portrait, original character ${name}, ${ageAppropriateFaceHint(age)}, ${age} years old ${occupation}, half body shot, dark navy background, dramatic side lighting`,
      'character'
    ),

  suspect: (name: string, age: number, occupation: string, personality: string) =>
    applyImageStyle(
      `Detective Conan anime portrait, original suspect ${name}, ${ageAppropriateFaceHint(age)}, ${age} years old ${occupation}, ${personality} expression, suspicious look, unique face, half body shot, dark navy background`,
      'character'
    ),

  scene: (setting: string, description: string) =>
    applyImageStyle(
      `Detective Conan anime crime scene background, wide angle, ${setting}, ${description}, empty scene no people, dark navy atmosphere, dramatic lighting, anime background art`,
      'scene'
    ),

  evidence: (name: string, description: string) =>
    applyImageStyle(
      `Detective Conan anime evidence illustration, ${name}, ${description}, dramatic spotlight, dark background, cel shading`,
      'scene'
    ),

  map: (setting: string) =>
    applyImageStyle(
      `Detective Conan anime investigation map of ${setting}, top-down floor plan, glowing blue lineart on dark navy background, cel shading`,
      'scene'
    ),
};

export const INTERROGATION_SYSTEM_PROMPT = (
  suspect: { id: string; name: string; isGuilty?: boolean },
  evidence: string[],
  knowledgeContext: string[]
) => `
你是剧本杀中的嫌疑人「${suspect.name}」（id: ${suspect.id}）。以下片段来自本案知识库，是与当前对话最相关的设定，所有回答必须与之一致，不得编造矛盾信息。

【案件知识库（检索片段）】
${knowledgeContext.map((block, i) => `--- 片段 ${i + 1} ---\n${block}`).join('\n\n')}

【侦探已发现的证据】
${evidence.length > 0 ? evidence.join('\n') : '（暂无）'}

【扮演规则】
1. 严格以知识库片段为准：时间线、证据、人物关系不得与设定冲突
2. 若你是真凶（片段中含「是否真凶：是」或真相片段）：知晓作案细节，需巧妙撒谎、回避或转移话题，但不能与 timeline/evidence 明显矛盾
3. 若非真凶：如实回答与己相关的问题，可隐藏与案件无关的隐私
4. 被确凿证据击破时可改口或情绪波动，但仍需符合性格设定
5. 第一人称、口语化，每次回答 100 字以内，可表现紧张/愤怒/悲伤
6. 禁止向侦探透露「你是 AI」或知识库结构；禁止直接泄露真相（除非被证据逼到绝境）

请以第一人称回答侦探的问题。
`;

/** 知识库检索失败时回退为完整案件 JSON */
export const INTERROGATION_FALLBACK_PROMPT = (
  suspect: { id: string; name: string },
  evidence: string[],
  caseJson: string
) => `
你是剧本杀中的嫌疑人「${suspect.name}」（id: ${suspect.id}）。以下 JSON 是本案的权威设定，所有回答必须与之一致。

【案件设定 JSON】
${caseJson}

【侦探已发现的证据】
${evidence.length > 0 ? evidence.join('\n') : '（暂无）'}

请以第一人称、口语化回答，每次 100 字以内。
`;

export const DEDUCTION_EVALUATION_PROMPT = (caseData: CaseData, userDeduction: string) => `
你是专业的推理评分系统。请评估用户的推理。

案件真相：
- 凶手：${caseData.truth.killer}
- 手法：${caseData.truth.method}
- 动机：${caseData.truth.motive}
- 作案过程：${caseData.truth.process.join(' → ')}

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
`;
