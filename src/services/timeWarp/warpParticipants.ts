/** Page owners register their own draft guards and teardown. The lifecycle never imports a page. */
export type WarpParticipant = {
  canEnter?(): boolean;
  beforeSwitch?(phase: 'enter' | 'exit'): void;
};
const participants = new Set<WarpParticipant>();

export function registerWarpParticipant(participant: WarpParticipant): () => void {
  participants.add(participant);
  return () => participants.delete(participant);
}

export const warpParticipantsReady = (): boolean => [...participants].every((owner) => owner.canEnter?.() !== false);
export function prepareWarpSwitch(phase: 'enter' | 'exit'): void {
  for (const owner of [...participants]) owner.beforeSwitch?.(phase);
}
