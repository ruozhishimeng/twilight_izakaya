import type { NpcDialogueRequest, NpcDialogueResponse } from '../types/npcDialogue';

interface ErrorPayload {
  error?: string;
}

function getErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.error === 'string' ? candidate.error : null;
}

function isNpcDialogueResponse(value: unknown): value is NpcDialogueResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.replyLines) &&
    candidate.replyLines.every(line => typeof line === 'string' && line.trim().length > 0) &&
    typeof candidate.mood === 'string' &&
    typeof candidate.endChat === 'boolean'
  );
}

export async function requestNpcDialogue(
  payload: NpcDialogueRequest,
): Promise<NpcDialogueResponse> {
  const response = await fetch('/api/npc-dialogue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = (await response.json().catch(() => null)) as NpcDialogueResponse | ErrorPayload | null;

  if (!response.ok) {
    const errorMessage = getErrorMessage(raw) || '本地对话服务暂时不可用。';
    throw new Error(errorMessage);
  }

  if (!isNpcDialogueResponse(raw)) {
    throw new Error('本地对话服务返回了无效内容。');
  }

  return raw;
}
