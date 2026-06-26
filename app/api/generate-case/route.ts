import { NextRequest, NextResponse } from 'next/server';
import { generateCaseWithAI } from '@/lib/ai';
import { buildCaseDataWithImages } from '@/lib/case-assembler';
import { buildCaseFromPhases } from '@/lib/generate-case-orchestrator';
import {
  getCaseGenerationMaxRetries,
  getCaseGenerationTimeoutMs,
  isServerlessEnv,
} from '@/lib/ai-config';
import { generateId } from '@/lib/utils';
import { CaseData } from '@/lib/types';

export const maxDuration = 60;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function generateCaseWithRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const timeoutMs = getCaseGenerationTimeoutMs();
  const maxRetries = getCaseGenerationMaxRetries();
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[API] ${label} attempt ${attempt}/${maxRetries}, timeout: ${timeoutMs}ms`);
      return await withTimeout(fn(), timeoutMs, label);
    } catch (error: any) {
      lastError = error;
      console.warn(`[API] ${label} attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  throw lastError ?? new Error(`${label} failed`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { difficulty, phase } = body;

    console.log('[API] Case generation request:', { difficulty, phase, serverless: isServerlessEnv() });

    if (phase === 'start') {
      if (isServerlessEnv()) {
        // Serverless 环境（Netlify 等）：单次 AI 调用，在 60s 函数时限内完成
        // 注意：background function 需要 Functions v2 才能访问 Netlify Blobs，
        //       为避免 MissingBlobsEnvironmentError，改用同步生成
        const caseContent = await generateCaseWithRetry('Serverless case generation', () =>
          generateCaseWithAI(difficulty)
        );
        const caseData = await buildCaseDataWithImages(difficulty, caseContent);
        return NextResponse.json({ success: true, sync: true, caseId: caseData.id, caseData });
      }

      // 本地开发：多阶段生成，55s 总超时（3阶段×~15s，留余量；单次 AI 调用上限 40s）
      const caseData = await withTimeout(
        buildCaseFromPhases(difficulty),
        55000,
        'Local buildCaseFromPhases'
      );
      return NextResponse.json({ success: true, sync: true, caseId: caseData.id, caseData });
    }

    const caseContent = await generateCaseWithRetry('Case generation', () =>
      generateCaseWithAI(difficulty)
    );
    const caseData = await buildCaseDataWithImages(difficulty, caseContent);

    console.log('[API] Case data created successfully, id:', caseData.id);

    return NextResponse.json({ success: true, caseId: caseData.id, caseData });
  } catch (error: any) {
    console.error('[API] Case generation failed:', {
      message: error.message,
      status: error.status,
      type: error.type,
      stack: error.stack?.substring(0, 500),
    });

    if (error.status === 401 || error.message?.includes('SILICONFLOW_API_KEY')) {
      return NextResponse.json(
        {
          success: false,
          error:
            error.message ||
            'API 密钥无效。请在 .env.local 配置 SILICONFLOW_API_KEY（从 https://cloud.siliconflow.cn 获取）',
        },
        { status: 401 }
      );
    }

    const isTimeout =
      error.message?.includes('timed out') ||
      error.message?.includes('timeout') ||
      error.code === 'ECONNABORTED';

    console.log('[API] Using fallback case, isTimeout:', isTimeout);
    const fallbackCase = createFallbackCase();
    return NextResponse.json({
      success: true,
      sync: true,
      isFallback: true,
      caseId: fallbackCase.id,
      caseData: fallbackCase,
      error: isTimeout
        ? 'AI 生成超时（网络较慢），已使用默认案件，可正常游戏。'
        : 'AI 生成失败，已使用默认案件。请检查 SILICONFLOW_API_KEY 配置或稍后重试。',
    });
  }
}

function createFallbackCase(): CaseData {
  const id = generateId();
  return {
    id,
    title: '雪山旅馆的密室谋杀',
    difficulty: 'medium',
    setting: '雪山旅馆',
    victim: {
      name: '林雪峰',
      gender: 'male',
      age: 45,
      occupation: '企业家',
      background: '成功的房地产开发商，在商界颇有名望，但私生活复杂。',
    },
    deathMethod: '神秘中毒',
    sceneDescription:
      '死者被发现在自己的房间内，门窗紧闭，呈现典型的密室状态。房间内有一杯红酒，检测出含有剧毒。死者面部发紫，明显是中毒身亡。房间内没有打斗痕迹，一切都很整齐。窗外大雪纷飞，旅馆与外界的道路已被封锁。',
    suspects: [
      {
        id: 's1',
        name: '陈美玲',
        gender: 'female',
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
        gender: 'male',
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
        gender: 'female',
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
    redHerrings: ['陈美玲的怨恨看起来很可疑', '李晓雯的怀孕秘密', '死者的复杂私生活'],
    createdAt: Date.now(),
  };
}
