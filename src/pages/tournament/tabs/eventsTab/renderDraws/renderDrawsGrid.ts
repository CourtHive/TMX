/**
 * Card-grid renderer for the per-event draws list.
 *
 * Mirrors `createEventsGrid` — reads draws via the factory, walks each
 * through `mapDrawDefinitionToCardData`, and renders a responsive CSS
 * grid of `buildDrawCard` elements. Ungenerated flights are surfaced
 * with `generated: false` and a click handler that opens the addDraw
 * drawer (same behaviour as the table). Single-draw click navigates
 * directly to the draw view.
 *
 * Optional `displayMode` picks a per-card visualization
 * (histogram / competitiveness / sunburst). Gating is applied via
 * `resolveDisplayMode` — too-many-draws downgrades to `'none'`, and
 * sunburst expands the grid to wider columns.
 */

import { buildDrawCard, DrawCardData, mapDrawDefinitionToCardData } from 'courthive-components';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tournamentEngine } from 'services/factory/engine';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { extensionConstants, publishingGovernor, entryStatusConstants } from 'tods-competition-factory';

import { buildDrawCardVisualization } from './buildDrawCardVisualization';
import { DrawCardDisplayMode } from './drawCardDisplayMode';
import {
  GateReason,
  ResolvedDisplayMode,
  VizDataAvailability,
  gateReasonLabel,
  resolveDisplayMode,
} from './drawCardVizGating';

import './drawsGrid.css';

const WRAP_CLASS = 'tmx-draws-grid-wrap';
const GRID_CLASS = 'tmx-draws-grid';
const GRID_EXPANDED_CLASS = 'tmx-draws-grid--expanded';
const EMPTY_CLASS = 'tmx-draws-empty';
const NOTICE_CLASS = 'tmx-draws-notice';

const { FLIGHT_PROFILE } = extensionConstants;
const { WITHDRAWN } = entryStatusConstants;

function clearAnchor(anchor: HTMLElement): void {
  while (anchor.firstChild) anchor.removeChild(anchor.firstChild);
}

function entryCountFor(drawDefinition: any): number {
  const entries = drawDefinition?.entries ?? [];
  const filtered = entries.filter(({ entryStatus }: any) => entryStatus !== WITHDRAWN);
  const assigned = tournamentEngine.getAssignedParticipantIds({ drawDefinition }).assignedParticipantIds?.filter(Boolean);
  return assigned?.length || filtered.length || 0;
}

function publishFlagsFor(drawId: string): { published?: boolean; embargoActive?: boolean } {
  const publishState = tournamentEngine.getPublishState({ drawId }).publishState;
  const drawDetail = publishState?.status?.drawDetails?.[drawId]?.publishingDetail;
  return {
    published: publishState?.status?.published,
    embargoActive: publishingGovernor.isEmbargoed(drawDetail),
  };
}

interface ResolvedEvent {
  event: any;
  drawDefinitions: any[];
  flights: any[];
}

function resolveEventData(eventId: string): ResolvedEvent | null {
  const event = tournamentEngine.getEvent({ eventId })?.event;
  if (!event) return null;
  const { drawDefinitions = [], extensions } = event;
  const flightProfile = extensions?.find((ext: any) => ext.name === FLIGHT_PROFILE)?.value;
  const flights: any[] = flightProfile?.flights ?? [];
  for (const flight of flights) {
    const dd = drawDefinitions.find((d: any) => d.drawId === flight.drawId);
    if (dd) dd.flightNumber = flight.flightNumber;
  }
  return { event, drawDefinitions, flights };
}

function pickRatingScaleName(drawDefinitions: any[]): string | undefined {
  for (const dd of drawDefinitions) {
    for (const entry of dd?.entries ?? []) {
      const ratings = entry?.participant?.ratings;
      if (!ratings) continue;
      for (const category of Object.values(ratings as Record<string, any>)) {
        if (!Array.isArray(category)) continue;
        const item = category.find((r: any) => typeof r?.scaleValue === 'number' && r?.scaleName);
        if (item) return item.scaleName;
      }
    }
  }
  return undefined;
}

function computeAvailability(eventId: string): VizDataAvailability {
  const resolved = resolveEventData(eventId);
  if (!resolved) return { hasRatings: false, hasCompetitiveness: false };
  const ratingScale = pickRatingScaleName(resolved.drawDefinitions);
  let hasCompetitiveness = false;
  outer: for (const dd of resolved.drawDefinitions) {
    for (const s of dd?.structures ?? []) {
      for (const m of s?.matchUps ?? []) {
        if (m?.competitiveProfile?.competitiveness) {
          hasCompetitiveness = true;
          break outer;
        }
      }
    }
  }
  return { hasRatings: !!ratingScale, hasCompetitiveness };
}

export function readEventDrawsAvailability(eventId: string): VizDataAvailability {
  return computeAvailability(eventId);
}

function buildGeneratedRows(
  resolved: ResolvedEvent,
  eventId: string,
  utrAvg: number | undefined,
  wtnAvg: number | undefined,
): DrawCardData[] {
  return resolved.drawDefinitions.map((dd: any) => {
    const { published, embargoActive } = publishFlagsFor(dd.drawId);
    return mapDrawDefinitionToCardData(dd, {
      entryCount: entryCountFor(dd),
      utrAvg,
      wtnAvg,
      published,
      embargoActive,
      eventId,
    });
  });
}

function buildUngeneratedRows(resolved: ResolvedEvent, eventId: string): DrawCardData[] {
  return resolved.flights
    .filter((f: any) => !resolved.drawDefinitions.some((d: any) => d.drawId === f.drawId))
    .map((f: any) => ({
      drawId: f.drawId,
      drawName: f.drawName,
      flightNumber: f.flightNumber,
      entryCount: f.drawEntries?.length || 0,
      generated: false,
      eventId,
      status: { kind: 'ungenerated', label: 'Not generated' },
    }));
}

export function readDrawCardData(eventId: string): DrawCardData[] {
  const resolved = resolveEventData(eventId);
  if (!resolved) return [];
  const { scaleValues } = (tournamentEngine as any).getRatingsStats?.({ eventId }) || {};
  const utrAvg = scaleValues?.ratingsStats?.UTR?.avg;
  const wtnAvg = scaleValues?.ratingsStats?.WTN?.avg;
  return [
    ...buildGeneratedRows(resolved, eventId, utrAvg, wtnAvg),
    ...buildUngeneratedRows(resolved, eventId),
  ];
}

function openDrawCard(data: DrawCardData): void {
  const { drawId, eventId, generated, flightNumber } = data;
  if (!eventId) return;
  if (generated) {
    navigateToEvent({ eventId, drawId, renderDraw: true });
    return;
  }
  const callback = (result: any) => {
    if (result.success) {
      navigateToEvent({ eventId, drawId: result.drawDefinition?.drawId, renderDraw: true });
    }
  };
  (addDraw as any)({ eventId, drawId, flightNumber, callback });
}

function renderGateNotice(parent: HTMLElement, reason: GateReason): void {
  const notice = document.createElement('div');
  notice.className = NOTICE_CLASS;
  notice.textContent = gateReasonLabel(reason);
  parent.appendChild(notice);
}

export interface RenderDrawsGridResult {
  count: number;
  availability: VizDataAvailability;
  resolved: ResolvedDisplayMode;
}

export function renderDrawsGrid({
  eventId,
  target,
  displayMode = 'none',
}: {
  eventId: string;
  target: HTMLElement;
  displayMode?: DrawCardDisplayMode;
}): RenderDrawsGridResult {
  clearAnchor(target);
  const rows = readDrawCardData(eventId);
  const availability = computeAvailability(eventId);
  const resolved = resolveDisplayMode({ requested: displayMode, drawCount: rows.length, availability });

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = EMPTY_CLASS;
    empty.textContent = 'No draws yet.';
    target.appendChild(empty);
    return { count: 0, availability, resolved };
  }

  const wrap = document.createElement('div');
  wrap.className = WRAP_CLASS;
  if (resolved.gated && resolved.reason) renderGateNotice(wrap, resolved.reason);

  const grid = document.createElement('div');
  grid.className = GRID_CLASS;
  if (resolved.mode === 'sunburst') grid.classList.add(GRID_EXPANDED_CLASS);
  wrap.appendChild(grid);

  const resolvedEvent = resolveEventData(eventId);
  const ratingScaleName = resolvedEvent ? pickRatingScaleName(resolvedEvent.drawDefinitions) : undefined;
  const showViz = resolved.mode !== 'none';

  for (const row of rows) {
    let visualization: HTMLElement | null = null;
    if (showViz && row.generated) {
      const dd = resolvedEvent?.drawDefinitions.find((d: any) => d.drawId === row.drawId);
      if (dd) {
        visualization = buildDrawCardVisualization({
          mode: resolved.mode,
          drawDefinition: dd,
          expanded: resolved.mode === 'sunburst',
          ratingScaleName,
        });
      }
    }
    grid.appendChild(
      buildDrawCard(
        { ...row, visualization },
        { showVisualization: showViz },
        { onClick: openDrawCard },
      ),
    );
  }

  target.appendChild(wrap);
  return { count: rows.length, availability, resolved };
}
