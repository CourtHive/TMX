/**
 * Bracket minimap gating + post-mount wiring.
 *
 * The minimap element itself is built by `buildStructureMinimap` from
 * `courthive-components`. This module decides when it should appear and
 * attaches scroll + click handlers to the live DOM after morphdom mounts
 * the draw frame.
 */
import { drawDefinitionConstants } from 'tods-competition-factory';
import { preferencesConfig } from 'config/preferencesConfig';
import { DRAWS_VIEW } from 'constants/tmxConstants';
import { deviceConfig } from 'config/deviceConfig';

const { SINGLE_ELIMINATION } = drawDefinitionConstants;

interface MinimapEligibilityParams {
  drawType?: string;
  initialRoundNumber: number;
  participantFilter?: string;
  isAdHoc?: boolean;
  roundCount: number;
}

/**
 * Whether the draw is *structurally* eligible for the minimap — bracket
 * size, device class, filter state. Does NOT consult the user's
 * show/hide preference; use this to decide whether to *offer* the toggle.
 */
export function isMinimapEligible({
  drawType,
  initialRoundNumber,
  participantFilter,
  isAdHoc,
  roundCount,
}: MinimapEligibilityParams): boolean {
  if (deviceConfig.get().isMobile) return false;
  if (participantFilter) return false;
  if (isAdHoc) return false;
  if (initialRoundNumber !== 1) return false;
  if (roundCount < 5) return false;
  return drawType === SINGLE_ELIMINATION;
}

export function isMinimapPreferenceVisible(): boolean {
  return preferencesConfig.get().drawMinimapVisible !== false;
}

/** Eligible AND the user hasn't hidden it via the toggle. */
export function shouldShowDrawMinimap(params: MinimapEligibilityParams): boolean {
  return isMinimapEligible(params) && isMinimapPreferenceVisible();
}

/**
 * 4 segments works until each segment outgrows a screenful of bracket;
 * on a 128 draw (round-1 = 64 matches) a quarter spans 16 matches which
 * renders taller than a typical viewport, defeating the navigator. Bump
 * to 8 segments once round-1 hits 64+ so each stays ≈ one screen tall.
 */
export function pickMinimapQuarterCount(round1Count: number): number {
  return round1Count >= 64 ? 8 : 4;
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

  // Keep the minimap's rendered height equal to "top of #drawsView to bottom
  // of the visible viewport". We size it explicitly in pixels rather than
  // letting CSS calc with `100vh` because `100vh` doesn't account for the
  // horizontal scrollbar that #drawsView paints at its bottom edge — that
  // scrollbar steals a few px from window.innerHeight, and the resulting
  // mismatch was hiding the bottom of the minimap. window.innerHeight is the
  // post-scrollbar visible height, so subtracting drawsView's clamped top
  // from it gives a pixel-exact "to bottom of viewport" height. rAF-throttled
  // capture-phase scroll listener picks up any ancestor scroll container.
  // The handler early-returns once the minimap leaves the DOM, so a leaked
  // listener after navigation degrades to a no-op rather than erroring.
  let offsetPending = false;
  const updateOffset = () => {
    offsetPending = false;
    if (!minimap.isConnected) return;
    const dv = document.getElementById(DRAWS_VIEW);
    if (!dv) return;
    const top = Math.max(0, dv.getBoundingClientRect().top);
    minimap.style.height = `${Math.max(0, window.innerHeight - top)}px`;
  };
  const scheduleOffsetUpdate = () => {
    if (offsetPending) return;
    offsetPending = true;
    requestAnimationFrame(updateOffset);
  };
  window.addEventListener('scroll', scheduleOffsetUpdate, { passive: true, capture: true });
  window.addEventListener('resize', scheduleOffsetUpdate);
  requestAnimationFrame(updateOffset);
}
