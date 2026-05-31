/**
 * Bracket minimap gating + post-mount wiring.
 *
 * The minimap element itself is built by `buildStructureMinimap` from
 * `courthive-components`. This module decides when it should appear and
 * attaches scroll + click handlers to the live DOM after morphdom mounts
 * the draw frame.
 */
import { drawDefinitionConstants } from 'tods-competition-factory';
import { deviceConfig } from 'config/deviceConfig';

const { SINGLE_ELIMINATION } = drawDefinitionConstants;

export function shouldShowDrawMinimap({
  drawType,
  initialRoundNumber,
  participantFilter,
  isAdHoc,
  roundCount,
}: {
  drawType?: string;
  initialRoundNumber: number;
  participantFilter?: string;
  isAdHoc?: boolean;
  roundCount: number;
}): boolean {
  if (deviceConfig.get().isMobile) return false;
  if (participantFilter) return false;
  if (isAdHoc) return false;
  if (initialRoundNumber !== 1) return false;
  if (roundCount < 5) return false;
  return drawType === SINGLE_ELIMINATION;
}

export function wireDrawMinimap(frame: HTMLElement): void {
  // Morphdom keeps the frame element across in-place data updates, so wiring
  // must be idempotent — otherwise scroll/click listeners stack on every
  // redraw. Dataset values are read inside handlers so a fresh minimap
  // (different draw selected) picks up new round-1 / quarter counts.
  if (frame.dataset.minimapWired === '1') return;
  const minimap = frame.querySelector('.chc-minimap') as HTMLElement | null;
  const container = frame.querySelector('.chc-container') as HTMLElement | null;
  if (!minimap || !container) return;
  frame.dataset.minimapWired = '1';

  let pending = false;
  const updateViewport = () => {
    pending = false;
    const viewport = minimap.querySelector('.chc-minimap-viewport') as SVGRectElement | null;
    const round1Count = Number(minimap.dataset.round1Count ?? 0);
    if (!viewport || !round1Count) return;
    const { scrollTop, clientHeight, scrollHeight } = container;
    if (scrollHeight <= 0) return;
    const yTop = (scrollTop / scrollHeight) * round1Count;
    const yH = Math.max(0.5, (clientHeight / scrollHeight) * round1Count);
    viewport.setAttribute('y', String(yTop));
    viewport.setAttribute('height', String(yH));
  };
  container.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(updateViewport);
  });
  requestAnimationFrame(updateViewport);

  minimap.addEventListener('click', (e) => {
    const target = (e.target as Element)?.closest?.('[data-quarter]') as SVGElement | null;
    if (!target) return;
    const q = Number(target.dataset.quarter);
    if (Number.isNaN(q)) return;
    const quarterCount = Number(minimap.dataset.quarters ?? 4);
    const fraction = (q + 0.5) / quarterCount;
    const top = fraction * container.scrollHeight - container.clientHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
}
