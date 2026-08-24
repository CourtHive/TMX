/**
 * URLs into the AMS console.
 *
 * The console base was spelled out inline in `openConsole`; a second copy for
 * the tournament Actions deep link would be a second thing to change when the
 * console moves. Pure, and taking `origin` as an argument rather than reading
 * `globalThis`, because TMX runs no DOM shim in unit tests — a decision that
 * reads the global is a decision that gets no coverage.
 */

/** Console routes are hash routes, mirroring the console's own Navigo setup. */
export function consoleUrl(origin: string, hashRoute = ''): string {
  const base = `${origin}/console/`;
  return hashRoute ? `${base}#${hashRoute}` : base;
}

/**
 * Scoped access for one tournament.
 *
 * Grants are per-tournament, which is why this deep link lives on the Actions
 * panel rather than the avatar menu: the avatar carries no tournament context.
 */
export function consoleGrantsRoute(tournamentId: string): string {
  return `/grants/${encodeURIComponent(tournamentId)}`;
}
