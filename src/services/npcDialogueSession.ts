import type { GameRootStateValue, NpcDialogueRuntime } from '../state/gameState';

export interface DialogueRequestLease {
  sessionId: string;
  requestId: number;
  generation: number;
  signal: AbortSignal;
}

interface TailChatInteraction {
  state: GameRootStateValue;
  closed: boolean;
  status: NpcDialogueRuntime['status'];
}

export function canInteractWithTailChat({
  state,
  closed,
  status,
}: TailChatInteraction): boolean {
  return state === 'dayLoop.guest.llmChatSession' && !closed && status !== 'requesting';
}

export class NpcDialogueRequestCoordinator {
  private current: { lease: DialogueRequestLease; controller: AbortController } | null = null;
  private requestId = 0;
  private generation = 0;

  begin(sessionId: string): DialogueRequestLease {
    this.current?.controller.abort();
    this.generation += 1;
    const controller = new AbortController();
    const lease: DialogueRequestLease = {
      sessionId,
      requestId: ++this.requestId,
      generation: this.generation,
      signal: controller.signal,
    };
    this.current = { lease, controller };
    return lease;
  }

  isCurrent(lease: DialogueRequestLease): boolean {
    const current = this.current?.lease;
    return !!current && !lease.signal.aborted && current.sessionId === lease.sessionId &&
      current.requestId === lease.requestId && current.generation === lease.generation &&
      current.signal === lease.signal;
  }

  finish(lease: DialogueRequestLease): void {
    if (this.isCurrent(lease)) this.current = null;
  }

  cancel(): void {
    this.current?.controller.abort();
    this.current = null;
    this.generation += 1;
  }
}
