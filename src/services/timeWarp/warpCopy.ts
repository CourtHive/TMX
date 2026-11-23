const ID_FIELDS = new Set(['tournamentId', 'sourceTournamentId', 'linkedTournamentId', 'targetTournamentId']);
const IDS_FIELDS = new Set(['tournamentIds', 'linkedTournamentIds']);

/** Rebase known tournament URL path/query references; prose and unrelated external ids remain data. */
function rebaseUrl(value: string, source: string, target: string): string {
  if (!/^(https?:\/\/|#?\/)/.test(value)) return value;
  try {
    const url = new URL(value, 'https://copy.invalid');
    const replace = (path: string) =>
      path
        .split('/')
        .map((part, index, parts) =>
          ['tournament', 'tournaments'].includes(parts[index - 1]) && decodeURIComponent(part) === source
            ? target
            : part,
        )
        .join('/');
    url.pathname = replace(url.pathname);
    if (url.hash) {
      const [path, query] = url.hash.slice(1).split('?');
      const params = new URLSearchParams(query);
      if (params.get('tournamentId') === source) params.set('tournamentId', target);
      url.hash = replace(path) + (params.size ? '?' + params.toString() : '');
    }
    if (url.searchParams.get('tournamentId') === source) url.searchParams.set('tournamentId', target);
    if (value.startsWith('#')) return url.hash;
    if (value.startsWith('/')) return url.pathname + url.search + url.hash;
    return url.toString();
  } catch {
    return value;
  }
}

/**
 * A native deep clone guarantees no aliases even if the factory's configurable copy-depth limit is enabled.
 * Rebase the copy in place: identity fields/lists/maps, reference extension values and tournament URLs. Arbitrary
 * prose and opaque non-JSON extension text are preserved; they are never interpreted as tournament identities.
 */
export function buildWarpCopy(record: any, tournamentId: string): any {
  const sourceId = record.tournamentId;
  const copy = structuredClone(record);
  function rewriteList(list: any[]): void {
    for (let i = 0; i < list.length; i++) if (list[i] === sourceId) list[i] = tournamentId;
    visit(list);
  }
  function rewriteExtension(value: string): string {
    if (!/^\s*(?:\[|{)/.test(value)) return value;
    try {
      const decoded = JSON.parse(value);
      if (Array.isArray(decoded)) rewriteList(decoded);
      else visit(decoded);
      return JSON.stringify(decoded);
    } catch {
      return value;
    } // Opaque extension text is not interpreted as a reference.
  }
  function rewriteValue(key: string, value: any): any {
    if ((ID_FIELDS.has(key) || key === 'value') && value === sourceId) return tournamentId;
    if ((IDS_FIELDS.has(key) || key === 'value') && Array.isArray(value)) {
      rewriteList(value);
      return value;
    }
    if (typeof value !== 'string') {
      visit(value, key === 'tournamentRecords');
      return value;
    }
    const url = rebaseUrl(value, sourceId, tournamentId);
    if (url !== value) return url;
    return key === 'value' ? rewriteExtension(value) : value;
  }
  function visit(node: any, idMap = false): void {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      const nextKey = idMap && key === sourceId ? tournamentId : key;
      node[nextKey] = rewriteValue(key, value);
      if (nextKey !== key) delete node[key];
    }
  }
  visit(copy);
  copy.tournamentId = tournamentId;
  copy.isMock = true;
  return copy;
}
