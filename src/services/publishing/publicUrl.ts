import { tournamentEngine } from 'services/factory/engine';
import { env } from 'settings/env';

function isLocalDev(): boolean {
  const { hostname } = globalThis.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function resolvePublicBaseUrl({
  configuredUrl,
  currentHref,
}: {
  configuredUrl?: string;
  currentHref: string;
}): string {
  const currentUrl = new URL(currentHref);

  if (configuredUrl) {
    // Treat path-only configuration as origin-relative. Resolving `pub` against
    // the current document would turn /tmx/pub/ into /tmx/pub/pub.
    return new URL(configuredUrl, `${currentUrl.origin}/`).toString().replace(/\/$/, '');
  }

  const tmxPathIndex = currentUrl.pathname.indexOf('/tmx');
  currentUrl.pathname = tmxPathIndex >= 0 ? `${currentUrl.pathname.slice(0, tmxPathIndex)}/pub` : '/pub';
  currentUrl.hash = '';
  currentUrl.search = '';
  return currentUrl.toString().replace(/\/$/, '');
}

export function getPublicBaseUrl(): string {
  const url = new URL(globalThis.location.href);
  const configuredUrl = env.PUBLIC_URL || process.env.PUBLIC_URL;

  if (configuredUrl) {
    return resolvePublicBaseUrl({ configuredUrl, currentHref: globalThis.location.href });
  }

  // When running standalone on localhost (not served by the factory server),
  // assume courthive-public is on the next port
  if (isLocalDev() && url.port && !url.pathname.includes('/tmx')) {
    const publicPort = parseInt(url.port, 10) + 1;
    return `${url.protocol}//${url.hostname}:${publicPort}`;
  }

  return resolvePublicBaseUrl({
    currentHref: globalThis.location.href,
  });
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
