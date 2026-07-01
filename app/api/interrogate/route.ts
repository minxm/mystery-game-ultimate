import { NextRequest } from 'next/server';
import { createSuspectChatStream, formatSuspectChatError } from '@/lib/ai';
import { setAiRequestContext, clearAiRequestContext } from '@/lib/ai-service';
import { serializeCaseForPrompt } from '@/lib/case-prompt';
import {
  getOrBuildKnowledgeIndex,
  retrieveKnowledgeContext,
} from '@/lib/case-knowledge-base';
import { INTERROGATION_FALLBACK_PROMPT, INTERROGATION_SYSTEM_PROMPT } from '@/lib/constants';

function sseData(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

function cleanSuspectReply(content: string): string {
  return content.replace(/[\s\S]*?<\/think>/g, '').trim() || '我不想回答这个问题。';
}

function resolveSuspectGuilty(
  suspect: { id: string; isGuilty?: boolean },
  caseData: Record<string, unknown>
): boolean {
  if (typeof suspect.isGuilty === 'boolean') return suspect.isGuilty;
  const suspects = Array.isArray(caseData.suspects) ? caseData.suspects : [];
  const match = suspects.find((s) => String(s.id) === suspect.id);
  return Boolean(match?.isGuilty);
}

function lastUserQuery(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && messages[i].content?.trim()) {
      return messages[i].content.trim();
    }
  }
  return messages.at(-1)?.content?.trim() || '';
}

async function buildInterrogationSystemPrompt(
  suspect: { id: string; name: string; isGuilty?: boolean },
  evidence: string[],
  caseData: Record<string, unknown>,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const isGuilty = resolveSuspectGuilty(suspect, caseData);
  const query = lastUserQuery(messages);

  try {
    const index = await getOrBuildKnowledgeIndex(caseData);
    const knowledgeContext = await retrieveKnowledgeContext(index, {
      suspectId: suspect.id,
      isGuilty,
      query,
    });
    console.log(
      `[Interrogate] Knowledge retrieval: ${knowledgeContext.length} chunks, guilty=${isGuilty}`
    );
    return INTERROGATION_SYSTEM_PROMPT(suspect, evidence, knowledgeContext);
  } catch (error) {
    console.warn(
      '[Interrogate] Knowledge base failed, using full JSON:',
      (error as Error)?.message
    );
    const caseJson = serializeCaseForPrompt(caseData);
    return INTERROGATION_FALLBACK_PROMPT(suspect, evidence, caseJson);
  }
}

export async function POST(request: NextRequest) {
  let suspect: { id: string; name: string; isGuilty?: boolean };
  let messages: Array<{ role: string; content: string }>;
  let evidence: string[];
  let caseData: Record<string, unknown> | null = null;

  try {
    const body = await request.json();
    const { caseJson } = body;
    suspect = body.suspect;
    messages = body.messages;
    evidence = body.evidence || [];

    if (body.caseData && typeof body.caseData === 'object') {
      caseData = body.caseData as Record<string, unknown>;
    } else if (caseJson) {
      caseData = JSON.parse(caseJson) as Record<string, unknown>;
    }

    if (!caseData) {
      return new Response(JSON.stringify({ success: false, error: '缺少案件设定，无法开始审问' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {
    return new Response(JSON.stringify({ success: false, error: '请求格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = await buildInterrogationSystemPrompt(
    suspect,
    evidence,
    caseData,
    messages
  );

  const caseId = typeof caseData.id === 'string' ? caseData.id : undefined;
  setAiRequestContext({ caseId, metadata: { suspectId: suspect.id } });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const aiStream = await createSuspectChatStream(messages, systemPrompt);
        let rawContent = '';

        for await (const chunk of aiStream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (!delta) continue;

          rawContent += delta;
          controller.enqueue(sseData({ delta }));
        }

        const content = cleanSuspectReply(rawContent);
        controller.enqueue(sseData({ done: true, content }));
        console.log('[AI] Suspect chat stream completed');
      } catch (error) {
        console.error('审问流式输出失败:', error);
        const message = formatSuspectChatError(error);
        controller.enqueue(sseData({ error: message, content: message }));
      } finally {
        clearAiRequestContext();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
