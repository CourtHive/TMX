/**
 * The draw a director is building, kept per event while they look elsewhere (CA, 2026-11-17): the draw builder is one
 * of the event's views, so leaving it for the entries and coming back finds the canvas as it was. The event's tab bar
 * shows the builder's tab while a draft is kept. Held for the session only; generating the draw, or discarding the
 * draft, lets it go.
 */
import type { TopologyState } from 'courthive-components';

const drafts = new Map<string, Partial<TopologyState>>();

export function getTopologyDraft(eventId: string): Partial<TopologyState> | undefined {
  return drafts.get(eventId);
}

export function hasTopologyDraft(eventId: string): boolean {
  return drafts.has(eventId);
}

/** An empty canvas is no draft: clearing it lets the draft go. */
export function keepTopologyDraft(eventId: string, state: Partial<TopologyState>): void {
  if (state.nodes?.length) drafts.set(eventId, { ...state, selectedNodeId: null, selectedEdgeId: null });
  else drafts.delete(eventId);
}

export function discardTopologyDraft(eventId: string): void {
  drafts.delete(eventId);
}
