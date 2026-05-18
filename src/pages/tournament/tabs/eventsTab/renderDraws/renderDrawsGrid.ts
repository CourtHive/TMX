/**
 * Card-grid renderer for the per-event draws list.
 *
 * Mirrors `createEventsGrid` — reads draws via the factory, walks each
 * through `mapDrawDefinitionToCardData`, and renders a responsive CSS
 * grid of `buildDrawCard` elements. Ungenerated flights are surfaced
 * with `generated: false` and a click handler that opens the addDraw
 * drawer (same behaviour as the table). Single-draw click navigates
 * directly to the draw view.
 */

import { buildDrawCard, DrawCardData, mapDrawDefinitionToCardData } from 'courthive-components';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { tournamentEngine } from 'services/factory/engine';
import { addDraw } from 'components/drawers/addDraw/addDraw';
import { extensionConstants, publishingGovernor, entryStatusConstants } from 'tods-competition-factory';

import './drawsGrid.css';

const WRAP_CLASS = 'tmx-draws-grid-wrap';
const GRID_CLASS = 'tmx-draws-grid';
const EMPTY_CLASS = 'tmx-draws-empty';

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
    embargoActive: publishingGovernor.isEmbargoed(drawDetail)
  };
}

export function readDrawCardData(eventId: string): DrawCardData[] {
  const event = tournamentEngine.getEvent({ eventId })?.event;
  if (!event) return [];

  const { drawDefinitions = [], extensions } = event;
  const { scaleValues } = (tournamentEngine as any).getRatingsStats?.({ eventId }) || {};
  const utrAvg = scaleValues?.ratingsStats?.UTR?.avg;
  const wtnAvg = scaleValues?.ratingsStats?.WTN?.avg;

  // Attach flightNumber from FLIGHT_PROFILE for already-generated draws so the card chip matches the table.
  const flightProfile = extensions?.find((ext: any) => ext.name === FLIGHT_PROFILE)?.value;
  const flights: any[] = flightProfile?.flights ?? [];
  for (const flight of flights) {
    const dd = drawDefinitions.find((d: any) => d.drawId === flight.drawId);
    if (dd) dd.flightNumber = flight.flightNumber;
  }

  const generated: DrawCardData[] = drawDefinitions.map((dd: any) => {
    const { published, embargoActive } = publishFlagsFor(dd.drawId);
    return mapDrawDefinitionToCardData(dd, {
      entryCount: entryCountFor(dd),
      utrAvg,
      wtnAvg,
      published,
      embargoActive,
      eventId
    });
  });

  // Surface ungenerated flights as cards with `generated: false`.
  const ungenerated: DrawCardData[] = flights
    .filter((f: any) => !drawDefinitions.some((d: any) => d.drawId === f.drawId))
    .map((f: any) => ({
      drawId: f.drawId,
      drawName: f.drawName,
      flightNumber: f.flightNumber,
      entryCount: f.drawEntries?.length || 0,
      generated: false,
      eventId,
      status: { kind: 'ungenerated', label: 'Not generated' }
    }));

  return [...generated, ...ungenerated];
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

export function renderDrawsGrid({ eventId, target }: { eventId: string; target: HTMLElement }): number {
  clearAnchor(target);
  const rows = readDrawCardData(eventId);

  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = EMPTY_CLASS;
    empty.textContent = 'No draws yet.';
    target.appendChild(empty);
    return 0;
  }

  const wrap = document.createElement('div');
  wrap.className = WRAP_CLASS;
  const grid = document.createElement('div');
  grid.className = GRID_CLASS;
  wrap.appendChild(grid);

  for (const row of rows) {
    grid.appendChild(buildDrawCard(row, undefined, { onClick: openDrawCard }));
  }

  target.appendChild(wrap);
  return rows.length;
}
