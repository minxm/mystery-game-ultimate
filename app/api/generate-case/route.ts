import { NextRequest, NextResponse } from 'next/server';
import { generateCaseWithAI, generateImage } from '@/lib/ai';
import { generateId } from '@/lib/utils';
import { CaseData } from '@/lib/types';
import { SETTINGS, DEATH_METHODS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { difficulty } = await request.json();

    console.log('[API] Starting case generation, difficulty:', difficulty);

    // 生成案件数据
    const caseContent = await generateCaseWithAI(difficulty);

    console.log('[API] Case content generated, creating case data...');

    // 快速生成占位图（同步，不需要等待）
    const victimImage = generateImage(`Professional portrait photo of ${caseContent.victim.name}, ${caseContent.victim.age} years old ${caseContent.victim.occupation}`);
    const sceneImage = generateImage(`Crime scene at ${caseContent.setting}`);
    const suspectImages = caseContent.suspects.map((suspect: any) =>
      generateImage(`Professional portrait photo of ${suspect.name}, ${suspect.age} years old ${suspect.occupation}`)
    );

    // 组装完整案件数据
    const caseData: CaseData = {
      id: generateId(),
      title: caseContent.title,
      difficulty,
      setting: caseContent.setting,
      victim: {
        ...caseContent.victim,
        imageUrl: victimImage,
      },
      deathMethod: caseContent.deathMethod,
      sceneDescription: caseContent.sceneDescription,
      sceneImageUrl: sceneImage,
      suspects: caseContent.suspects.map((suspect: any, index: number) => ({
        ...suspect,
        imageUrl: suspectImages[index],
      })),
      evidence: caseContent.evidence,
      timeline: caseContent.timeline,
      truth: caseContent.truth,
      redHerrings: caseContent.redHerrings,
      createdAt: Date.now(),
    };

    console.log('[API] Case data created successfully, id:', caseData.id);

    return NextResponse.json({ success: true, caseId: caseData.id, caseData });
  } catch (error: any) {
    console.error('[API] Case generation failed:', {
      message: error.message,
      status: error.status,
      type: error.type,
      stack: error.stack?.substring(0, 500),
    });

    // 返回备用案件
    console.log('[API] Using fallback case');
    const fallbackCase = createFallbackCase(request);
    return NextResponse.json({ success: true, caseId: fallbackCase.id, caseData: fallbackCase });
  }
}

function createFallbackCase(request: NextRequest): CaseData {
  const id = generateId();
  return {
    id,
    title: '雪山旅馆的密室谋杀',
    difficulty: 'medium',
    setting: '雪山旅馆',
    victim: {
      name: '林雪峰',
      age: 45,
      occupation: '企业家',
      background: '成功的房地产开发商，在商界颇有名望，但私生活复杂。',
    },
    deathMethod: '神秘中毒',
    sceneDescription: '死者被发现在自己的房间内，门窗紧闭，呈现典型的密室状态。房间内有一杯红酒，检测出含有剧毒。死者面部发紫，明显是中毒身亡。房间内没有打斗痕迹，一切都很整齐。窗外大雪纷飞，旅馆与外界的道路已被封锁。',
    suspects: [
      {
        id: 's1',
        name: '陈美玲',
        age: 38,
        occupation: '律师',
        relationship: '前妻',
        alibi: '案发时在大厅与其他客人聊天',
        motive: '离婚时财产分割不公，心怀怨恨',
        personality: '冷静理性，善于隐藏情绪',
        secrets: ['曾经雇佣私家侦探调查林雪峰', '知道林雪峰的商业秘密'],
        isGuilty: false,
      },
      {
        id: 's2',
        name: '王建国',
        age: 50,
        occupation: '商业伙伴',
        relationship: '合作伙伴',
        alibi: '案发时在自己房间休息',
        motive: '林雪峰准备撤资，导致项目面临崩盘',
        personality: '表面和善，实则城府很深',
        secrets: ['公司账目有问题', '欠了高利贷'],
        isGuilty: true,
      },
      {
        id: 's3',
        name: '李晓雯',
        age: 28,
        occupation: '秘书',
        relationship: '秘书兼情人',
        alibi: '案发时在厨房帮忙',
        motive: '被承诺的婚姻迟迟未兑现',
        personality: '年轻冲动，情绪化',
        secrets: ['怀孕了但林雪峰不知道', '与陈美玲有过接触'],
        isGuilty: false,
      },
    ],
    evidence: [
      {
        id: 'e1',
        name: '毒酒杯',
        description: '死者房间内的红酒杯，检测出氰化物',
        location: '死者房间',
        significance: '直接致死物证',
        relatedSuspects: ['s1', 's2', 's3'],
      },
      {
        id: 'e2',
        name: '房间钥匙',
        description: '只有死者和旅馆老板有房间钥匙',
        location: '死者口袋',
        significance: '密室关键',
        relatedSuspects: ['s2'],
      },
      {
        id: 'e3',
        name: '商业合同',
        description: '撤资协议，死者已签字',
        location: '死者公文包',
        significance: '揭示动机',
        relatedSuspects: ['s2'],
      },
      {
        id: 'e4',
        name: '离婚协议',
        description: '财产分割明显不公平',
        location: '陈美玲房间',
        significance: '揭示怨恨',
        relatedSuspects: ['s1'],
      },
      {
        id: 'e5',
        name: '验孕棒',
        description: '阳性结果',
        location: '李晓雯房间',
        significance: '隐藏的秘密',
        relatedSuspects: ['s3'],
      },
      {
        id: 'e6',
        name: '监控录像',
        description: '显示王建国在案发前进入过死者房间',
        location: '旅馆前台',
        significance: '关键时间线',
        relatedSuspects: ['s2'],
      },
    ],
    timeline: [
      {
        time: '19:30',
        event: '晚餐时间，所有人在餐厅',
        location: '餐厅',
        significance: 'low',
      },
      {
        time: '20:15',
        event: '林雪峰回到房间',
        location: '死者房间',
        witness: '旅馆服务员',
        significance: 'medium',
      },
      {
        time: '20:30',
        event: '王建国被监控拍到进入死者房间',
        location: '走廊',
        significance: 'critical',
      },
      {
        time: '20:45',
        event: '王建国离开死者房间',
        location: '走廊',
        significance: 'critical',
      },
      {
        time: '21:00',
        event: '陈美玲在大厅与其他客人聊天',
        location: '大厅',
        witness: '多名客人',
        significance: 'medium',
      },
      {
        time: '21:30',
        event: '李晓雯在厨房帮忙',
        location: '厨房',
        witness: '厨师',
        significance: 'medium',
      },
      {
        time: '22:00',
        event: '服务员敲门无人应答',
        location: '死者房间',
        significance: 'high',
      },
      {
        time: '22:15',
        event: '破门发现死者',
        location: '死者房间',
        significance: 'critical',
      },
    ],
    truth: {
      killer: '王建国',
      method: '利用提前准备的房间钥匙副本进入，在红酒中下毒后离开',
      motive: '林雪峰撤资导致项目崩盘，王建国欠下巨额高利贷，走投无路',
      process: [
        '提前偷配了死者房间钥匙',
        '在晚餐时观察死者习惯',
        '趁死者回房间后进入',
        '在红酒中下氰化物',
        '伪装成正常拜访离开',
        '制造不在场证明',
      ],
      keyClues: ['监控录像', '钥匙副本', '商业合同', '王建国的财务危机'],
    },
    redHerrings: [
      '陈美玲的怨恨看起来很可疑',
      '李晓雯的怀孕秘密',
      '死者的复杂私生活',
    ],
    createdAt: Date.now(),
  };
}
