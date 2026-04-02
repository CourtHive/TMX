import { tournamentEngine } from 'tods-competition-factory';
import { env } from 'settings/env';

function isLocalDev(): boolean {
  const { hostname } = globalThis.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function getPublicBaseUrl(): string {
  if (env.PUBLIC_URL) return env.PUBLIC_URL;
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;

  const url = new URL(globalThis.location.href);

  // When running standalone on localhost (not served by the factory server),
  // assume courthive-public is on the next port
  if (isLocalDev() && url.port && !url.pathname.includes('/tmx')) {
    const publicPort = parseInt(url.port, 10) + 1;
    return `${url.protocol}//${url.hostname}:${publicPort}`;
  }

  url.pathname = url.pathname.replace(/\/tmx\b/, '/pub');
  url.hash = '';
  url.search = '';
  const publicURl = url.toString().replace(/\/$/, '');
  return publicURl;
}

export function isEventPublished(eventId: string): boolean {
  const { publishState } = tournamentEngine.getPublishState({ eventId });
  return !!publishState?.status?.published;
}

export function isDrawPublished(drawId: string): boolean {
  const { publishState } = tournamentEngine.getPublishState({ drawId });
  return !!publishState?.status?.published;
}

export function getPublicTournamentUrl(tournamentId: string): string {
  const base = getPublicBaseUrl();
  return `${base}/#/tournament/${tournamentId}`;
}

export function getPublicEventUrl({
  tournamentId,
  eventId,
}: {
  tournamentId: string;
  eventId: string;
}): string | undefined {
  if (!isEventPublished(eventId)) return undefined;
  const base = getPublicBaseUrl();
  return `${base}/#/tournament/${tournamentId}/event/${eventId}`;
}

export function getPublicDrawUrl({
  tournamentId,
  eventId,
  drawId,
}: {
  tournamentId: string;
  eventId: string;
  drawId: string;
}): string | undefined {
  if (!isDrawPublished(drawId)) return undefined;
  const base = getPublicBaseUrl();
  return `${base}/#/tournament/${tournamentId}/event/${eventId}/draw/${drawId}`;
}

export function getPublicStructureUrl({
  tournamentId,
  eventId,
  drawId,
  structureId,
}: {
  tournamentId: string;
  eventId: string;
  drawId: string;
  structureId: string;
}): string | undefined {
  if (!isDrawPublished(drawId)) return undefined;
  const base = getPublicBaseUrl();
  return `${base}/#/tournament/${tournamentId}/event/${eventId}/draw/${drawId}/structure/${structureId}`;
}
