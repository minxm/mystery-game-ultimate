import { CaseData } from '@/lib/types';
import { generateId } from '@/lib/utils';
import { getAvatarPlaceholder, getScenePlaceholder } from '@/lib/placeholder';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 兜底案件模板。AI 生成失败/超时时启用，保证用户永远能拿到一个可玩的完整案件。
 * 多套模板随机选取，避免每次失败都看到同一个案子。
 */
type FallbackTemplate = Omit<CaseData, 'id' | 'createdAt' | 'difficulty'>;

const TEMPLATES: FallbackTemplate[] = [
  {
    title: '雪山旅馆的密室谋杀',
    setting: '与世隔绝的雪山旅馆',
    victim: {
      name: '林雪峰',
      gender: 'male',
      age: 45,
      occupation: '房地产企业家',
      background: '成功的房地产开发商，在商界颇有名望，但私生活复杂，近期资金链紧张。',
    },
    deathMethod: '氰化物中毒',
    sceneDescription:
      '死者被发现在自己的房间内，门窗紧闭，呈现典型的密室状态。房间内有一杯红酒，检测出含有剧毒。死者面部发紫，明显是中毒身亡。房间内没有打斗痕迹，一切都很整齐。窗外大雪纷飞，旅馆与外界的道路已被封锁。',
    suspects: [
      {
        id: 's1', name: '陈美玲', gender: 'female', age: 38, occupation: '律师', relationship: '前妻',
        alibi: '案发时在大厅与其他客人聊天', motive: '离婚时财产分割不公，心怀怨恨',
        personality: '冷静理性，善于隐藏情绪',
        secrets: ['曾雇私家侦探调查林雪峰', '掌握林雪峰的商业秘密'], isGuilty: false,
      },
      {
        id: 's2', name: '王建国', gender: 'male', age: 50, occupation: '商业伙伴', relationship: '合作伙伴',
        alibi: '案发时在自己房间休息', motive: '林雪峰准备撤资，导致项目崩盘',
        personality: '表面和善，实则城府很深',
        secrets: ['公司账目造假', '欠下巨额高利贷'], isGuilty: true,
      },
      {
        id: 's3', name: '李晓雯', gender: 'female', age: 28, occupation: '私人秘书', relationship: '秘书兼情人',
        alibi: '案发时在厨房帮忙', motive: '被承诺的婚姻迟迟未兑现',
        personality: '年轻冲动，情绪化',
        secrets: ['已怀孕但林雪峰不知情', '曾与陈美玲私下接触'], isGuilty: false,
      },
    ],
    evidence: [
      { id: 'e1', name: '毒酒杯', description: '死者房间内的红酒杯，检出氰化物', location: '死者房间', significance: '直接致死物证', relatedSuspects: ['s1', 's2', 's3'] },
      { id: 'e2', name: '房间备用钥匙', description: '一把被偷配的房间钥匙副本', location: '走廊储物柜', significance: '密室破解关键', relatedSuspects: ['s2'] },
      { id: 'e3', name: '撤资协议', description: '死者已签字的撤资文件', location: '死者公文包', significance: '揭示动机', relatedSuspects: ['s2'] },
      { id: 'e4', name: '离婚协议', description: '财产分割明显不公', location: '陈美玲房间', significance: '误导性怨恨证据', relatedSuspects: ['s1'] },
      { id: 'e5', name: '监控录像', description: '显示王建国案发前进入死者房间', location: '旅馆前台', significance: '关键时间线', relatedSuspects: ['s2'] },
    ],
    timeline: [
      { time: '19:30', event: '众人在餐厅共进晚餐', location: '餐厅', significance: 'low' },
      { time: '20:15', event: '林雪峰独自回到房间', location: '死者房间', witness: '服务员', significance: 'medium' },
      { time: '20:30', event: '王建国被监控拍到进入死者房间', location: '走廊', significance: 'critical' },
      { time: '20:45', event: '王建国离开死者房间', location: '走廊', significance: 'critical' },
      { time: '22:15', event: '破门发现死者', location: '死者房间', significance: 'critical' },
    ],
    truth: {
      killer: '王建国',
      method: '用偷配的钥匙副本潜入，在红酒中下氰化物后离开，反锁房门伪造密室',
      motive: '林雪峰撤资致项目崩盘，王建国深陷高利贷走投无路',
      process: ['提前偷配死者房间钥匙', '晚餐时观察死者作息', '趁其回房后潜入', '在红酒中投毒', '反锁离开制造密室'],
      keyClues: ['监控录像', '钥匙副本', '撤资协议'],
    },
    redHerrings: ['陈美玲的怨恨看似可疑', '李晓雯隐瞒的怀孕秘密'],
    sceneImageUrl: '',
  },
  {
    title: '画廊深夜的坠落',
    setting: '市中心的私人当代艺术画廊',
    victim: {
      name: '苏曼青',
      gender: 'female',
      age: 41,
      occupation: '画廊主理人',
      background: '业内知名策展人，眼光毒辣，却被传私下倒卖赝品牟取暴利。',
    },
    deathMethod: '高处坠落（伪装成意外）',
    sceneDescription:
      '闭馆后的画廊空旷幽暗，死者从二层回廊坠落，倒在大理石地面上。现场看似失足意外，但回廊护栏的高度本不该让人轻易翻落。死者手中紧攥着一小片撕碎的展签，地面散落着打翻的红酒，墙上巨幅油画在应急灯下泛着诡异冷光。',
    suspects: [
      {
        id: 's1', name: '范知远', gender: 'male', age: 47, occupation: '收藏家', relationship: '长期客户',
        alibi: '声称闭馆前已离开，在附近餐厅用餐', motive: '高价买入的名画被鉴定为赝品',
        personality: '儒雅克制，言辞滴水不漏',
        secrets: ['用赝品向银行抵押贷款', '与死者有秘密分成协议'], isGuilty: true,
      },
      {
        id: 's2', name: '乔念', gender: 'female', age: 26, occupation: '助理策展人', relationship: '下属',
        alibi: '案发时在地下室整理库存', motive: '长期被压榨且功劳被夺',
        personality: '隐忍敏感，心思缜密',
        secrets: ['偷偷记录了画廊造假证据', '准备跳槽到竞争对手'], isGuilty: false,
      },
      {
        id: 's3', name: '高维', gender: 'male', age: 33, occupation: '修复师', relationship: '合作方',
        alibi: '案发时在工作间修复画作', motive: '被拖欠大笔修复费用',
        personality: '沉默寡言，专注偏执',
        secrets: ['曾亲手参与做旧赝品', '对死者怀有暗恋'], isGuilty: false,
      },
    ],
    evidence: [
      { id: 'e1', name: '撕碎的展签', description: '死者手中残片，标注某画作真伪存疑', location: '死者手中', significance: '指向赝品交易', relatedSuspects: ['s1'] },
      { id: 'e2', name: '回廊护栏螺丝', description: '一处护栏固定螺丝被人为松动', location: '二层回廊', significance: '坠落非意外的关键', relatedSuspects: ['s1'] },
      { id: 'e3', name: '抵押贷款合同', description: '以名画为质押的高额贷款文件', location: '范知远车内', significance: '揭示动机', relatedSuspects: ['s1'] },
      { id: 'e4', name: '造假证据U盘', description: '记录画廊赝品交易的隐秘文件', location: '乔念背包', significance: '误导性可疑物', relatedSuspects: ['s2'] },
      { id: 'e5', name: '门禁记录', description: '显示范知远闭馆后并未真正离开', location: '安保系统', significance: '推翻不在场证明', relatedSuspects: ['s1'] },
    ],
    timeline: [
      { time: '20:00', event: '画廊正常闭馆', location: '正门', significance: 'low' },
      { time: '20:20', event: '范知远谎称离开，实则折返', location: '侧门', significance: 'critical' },
      { time: '20:40', event: '死者与人在二层激烈争执', location: '二层回廊', witness: '乔念隐约听见', significance: 'high' },
      { time: '21:05', event: '一声闷响，死者坠落', location: '展厅大堂', significance: 'critical' },
      { time: '21:30', event: '夜巡保安发现尸体', location: '展厅大堂', significance: 'high' },
    ],
    truth: {
      killer: '范知远',
      method: '提前松动回廊护栏螺丝，争执中将死者推向松动处，伪装成失足坠落',
      motive: '赝品事发将导致他抵押骗贷暴露，杀人灭口',
      process: ['发现所购名画为赝品', '察觉造假交易将曝光', '闭馆后假意离开折返', '预先破坏护栏', '争执中借力推落死者'],
      keyClues: ['护栏螺丝', '门禁记录', '抵押贷款合同'],
    },
    redHerrings: ['乔念手中的造假证据', '高维被拖欠费用的怨气'],
    sceneImageUrl: '',
  },
];

export function createFallbackCase(difficulty = 'medium'): CaseData {
  const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];

  const suspects = shuffleArray(
    template.suspects.map((s) => ({ ...s, imageUrl: getAvatarPlaceholder(s.name) }))
  );

  return {
    ...template,
    id: generateId(),
    difficulty: difficulty as CaseData['difficulty'],
    createdAt: Date.now(),
    victim: { ...template.victim, imageUrl: getAvatarPlaceholder(template.victim.name) },
    sceneImageUrl: getScenePlaceholder(template.title),
    suspects,
  };
}
