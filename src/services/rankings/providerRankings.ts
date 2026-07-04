/**
 * Provider rankings helpers.
 *
 * Rankings are published by the separate `courthive-rankings` service and
 * viewed in the `courthive-public` app at `<origin>/pub/#/rankings/<ABBR>`.
 *
 * Existence is probed through the CFS rankings proxy's provider directory
 * (`GET /api/rankings/providers` → `[{ abbreviation, name }]`): a provider
 * "has rankings" when its abbreviation appears in that list. The whole list
 * is fetched once and memoized, so probing any number of providers costs a
 * single request per session.
 */
import { platform } from 'platform';

interface RankingsProvider {
  abbreviation?: string;
  name?: string;
}

// Session-scoped memo of the upper-cased abbreviations that have rankings.
// Fetched once (a single in-flight promise coalesces concurrent probes) and
// reused across home-nav renders; cleared on reload.
let providerSetPromise: Promise<Set<string>> | undefined;

function origin(): string {
  return platform.getDefaultServerUrl().replace(/\/$/, '');
}

export function getProviderRankingsUrl(abbreviation: string): string {
  return `${origin()}/pub/#/rankings/${encodeURIComponent(abbreviation.toUpperCase())}`;
}

function fetchProviderSet(): Promise<Set<string>> {
  if (!providerSetPromise) {
    providerSetPromise = (async () => {
      try {
        const res = await fetch(`${origin()}/api/rankings/providers`, { headers: { accept: 'application/json' } });
        if (!res.ok) return new Set<string>();
        const providers = (await res.json()) as RankingsProvider[];
        if (!Array.isArray(providers)) return new Set<string>();
        return new Set(providers.map((p) => p?.abbreviation?.toUpperCase()).filter((a): a is string => !!a));
      } catch {
        return new Set<string>();
      }
    })();
  }
  return providerSetPromise;
}

export async function providerHasRankings(abbreviation?: string): Promise<boolean> {
  if (!abbreviation) return false;
  const providers = await fetchProviderSet();
  return providers.has(abbreviation.toUpperCase());
}
