import { tools } from 'tods-competition-factory';

/**
 * A stable id for this tab, for the life of the page. Sent with every
 * mutation and echoed by the server on the `tournamentMutation` broadcast, so
 * a client can recognise — and skip — its own mutation coming back.
 *
 * Socket.IO excludes the sender server-side, so today no echo arrives. A
 * transport that cannot exclude a connection (managed pub/sub) relies on this.
 * Unlike a socket id it survives reconnects, which is what makes it usable as
 * an origin marker.
 */
let originClientId: string | undefined;

/** Minted on first use rather than at import, so importing this module has no side effect. */
export function getOriginClientId(): string {
  originClientId ??= tools.UUID();
  return originClientId;
}

/** True when a broadcast carries this tab's own origin marker. */
export function isOwnMutation(data: { originClientId?: string } | undefined): boolean {
  return !!data?.originClientId && data.originClientId === getOriginClientId();
}
