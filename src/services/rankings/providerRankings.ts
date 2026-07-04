/**
 * Provider rankings helpers.
 *
 * Rankings are published by the separate `courthive-rankings` service and
 * viewed in the `courthive-public` app at `<origin>/pub/#/rankings/<ABBR>`.
 *
 * Existence is probed through the CFS rankings proxy (`/api/rankings/bundle`),
 * which today returns a single, non-provider-keyed bundle. We therefore treat
 * rankings as "existing" for a provider only when that bundle's abbreviation
 * matches the active provider AND it carries rankings — mirroring the liveness
 * check the public per-provider page performs. This naturally scopes the icon
 * to the one provider that currently has rankings and grows correctly once the
 * backend adds provider-scoped filtering.
 */
import { platform } from 'platform';

interface RankingsBundle {
  provider?: { name?: string; abbreviation?: string };
  rankings?: { men?: unknown; women?: unknown };
}

// Session-scoped memo keyed by provider abbreviation (upper-cased) so repeated
// home-nav renders don't re-hit the proxy. Cleared on reload.
const existenceCache = new Map<string, boolean>();

function origin(): string {
  return platform.getDefaultServerUrl().replace(/\/$/, '');
}

export function getProviderRankingsUrl(abbreviation: string): string {
  return `${origin()}/pub/#/rankings/${encodeURIComponent(abbreviation.toUpperCase())}`;
}

export async function providerHasRankings(abbreviation?: string): Promise<boolean> {
  if (!abbreviation) return false;
  const key = abbreviation.toUpperCase();
  const cached = existenceCache.get(key);
  if (cached !== undefined) return cached;

  let exists = false;
  try {
    const res = await fetch(`${origin()}/api/rankings/bundle`, { headers: { accept: 'application/json' } });
    if (res.ok) {
      const bundle = (await res.json()) as RankingsBundle;
      const bundleAbbr = bundle?.provider?.abbreviation?.toUpperCase();
      const hasRankings = !!(bundle?.rankings?.men && bundle?.rankings?.women);
      exists = bundleAbbr === key && hasRankings;
    }
  } catch {
    exists = false;
  }

  existenceCache.set(key, exists);
  return exists;
}
