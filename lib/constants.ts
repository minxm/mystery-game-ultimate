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

export const IMAGE_GENERATION_PROMPTS = {
  victim: (name: string, age: number, occupation: string) =>
    `Professional portrait photo of ${name}, ${age} years old ${occupation}, cinematic lighting, mysterious atmosphere, film noir style, high quality, realistic`,

  suspect: (name: string, age: number, occupation: string, personality: string) =>
    `Professional portrait photo of ${name}, ${age} years old ${occupation}, ${personality} expression, cinematic lighting, mysterious atmosphere, film noir style, high quality, realistic`,

  scene: (setting: string, description: string) =>
    `Crime scene at ${setting}, ${description}, dark atmospheric lighting, cinematic composition, mystery thriller style, high detail, realistic, wide angle`,

  evidence: (name: string, description: string) =>
    `Close-up photo of ${name}, ${description}, evidence photography style, dramatic lighting, high detail, forensic quality, realistic`,

  map: (setting: string) =>
    `Floor plan and layout map of ${setting}, architectural blueprint style, top-down view, labeled rooms, professional diagram, clean lines, dark theme`
};

export const INTERROGATION_SYSTEM_PROMPT = (suspect: any, evidence: string[], caseContext: string) => `
你正在扮演嫌疑人：${suspect.name}

角色信息：
- 年龄：${suspect.age}
- 职业：${suspect.occupation}
- 性格：${suspect.personality}
- 与死者关系：${suspect.relationship}
- 不在场证明：${suspect.alibi}
- 动机：${suspect.motive}
- 秘密：${suspect.secrets.join('、')}
- 是否是真凶：${suspect.isGuilty ? '是' : '否'}

案件背景：
${caseContext}

已发现的证据：
${evidence.join('\n')}

扮演规则：
1. 保持角色一致性，根据性格特点回答
2. 如果是真凶，要巧妙撒谎和回避，但不能太明显
3. 如果不是真凶，要真实回答，但可以隐藏与案件无关的秘密
4. 当被确凿证据击破时，可以改口或情绪波动
5. 回答要自然，像真人对话，不要太机械
6. 可以反问侦探，表现出紧张、愤怒、悲伤等情绪
7. 每次回答控制在100字以内

请以第一人称回答侦探的问题。
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
