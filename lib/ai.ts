import OpenAI from 'openai';

// 添加详细的环境变量日志
console.log('[AI] Initializing OpenAI client...');
console.log('[AI] API Key exists:', !!process.env.OPENAI_API_KEY);
console.log('[AI] API Key length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('[AI] Base URL:', 'https://api.gptsapi.net/v1');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseURL: 'https://api.gptsapi.net/v1',
  timeout: 50000, // 50 秒超时
  maxRetries: 2, // 最多重试 2 次
});

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
- victim: 受害者信息（姓名、年龄、职业、背景）
- deathMethod: 死亡方式
- sceneDescription: 案发现场详细描述（500字）
- suspects: 三名嫌疑人数组，每人包含：
  - id, name, age, occupation, relationship（与死者关系）
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
    console.log('[AI] Starting case generation...');
    console.log('[AI] Difficulty:', difficulty);
    console.log('[AI] Theme:', theme || 'none');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '你是专业的悬疑推理编剧，擅长创作高质量剧本杀案件。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      response_format: { type: 'json_object' }
    });

    console.log('[AI] Case generation successful');
    const content = completion.choices[0].message.content;
    return JSON.parse(content || '{}');
  } catch (error: any) {
    console.error('[AI] Case generation failed:', {
      message: error.message,
      status: error.status,
      type: error.type,
      code: error.code,
      stack: error.stack,
    });
    throw error;
  }
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    console.log('[AI] Generating image with prompt:', prompt.substring(0, 100));

    const response = await openai.images.generate({
      model: 'gpt-image-1.5',
      prompt: prompt,
      n: 1,
      size: '1024x1024',
    });

    const imageUrl = response.data?.[0]?.url || '';
    console.log('[AI] Image generated successfully:', imageUrl ? 'Yes' : 'No');

    return imageUrl;
  } catch (error: any) {
    console.error('[AI] Image generation failed:', {
      message: error.message,
      status: error.status,
      type: error.type,
      code: error.code,
    });

    // 如果图片生成失败，返回空字符串
    return '';
  }
}

export async function chatWithSuspect(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string
): Promise<string> {
  try {
    console.log('开始调用 OpenAI API 进行对话...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      ],
      temperature: 0.8,
      max_tokens: 300,
    }, {
      timeout: 30000,
    });

    console.log('OpenAI API 对话返回成功');
    return completion.choices[0].message.content || '我不想回答这个问题。';
  } catch (error: any) {
    console.error('对话生成失败详细信息:', {
      message: error.message,
      status: error.status,
      type: error.type,
      code: error.code,
      response: error.response?.data,
    });

    // 返回更详细的错误信息用于调试
    if (error.status === 401) {
      return '（系统错误：API 密钥无效）';
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
  // 数据验证
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
    console.log('开始调用 OpenAI API 进行评分...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: '你是专业的推理评分系统。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }, {
      timeout: 50000,
    });

    const content = completion.choices[0].message.content;
    console.log('OpenAI API 返回成功');

    if (!content) {
      throw new Error('OpenAI 返回内容为空');
    }

    const result = JSON.parse(content);
    return result;
  } catch (error: any) {
    console.error('评分失败详细信息:', {
      message: error.message,
      status: error.status,
      type: error.type,
      code: error.code,
    });

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error('API 请求超时，请稍后重试');
    }
    if (error.status === 429) {
      throw new Error('API 调用频率过高，请稍后重试');
    }
    if (error.status === 401) {
      throw new Error('API 密钥无效');
    }

    throw error;
  }
}
