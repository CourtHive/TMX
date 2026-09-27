/**
 * Schedule2 — resolving a search query to participant IDENTITY rather than cell text.
 *
 * ── The defect this exists for ──
 *
 * The court grid's search matched on rendered cell text (`gridSearchMatch.ts`), and
 * for a doubles cell that text is the PAIR participant's own `participantName` —
 * which the factory composes as **family names joined by `/`**. So the cell for
 * Aiden Phoebus playing doubles reads `Phoebus/Smith`, and the Inspector's rest row,
 * which drives the box with the full name it displays, highlighted his singles cells
 * and silently missed every doubles cell he was in.
 *
 * No smarter text matcher fixes that. The given name is not truncated by the
 * renderer — `nameFormat` defaults to `'full'` — it is **absent from the DOM**,
 * because the pair participant never carried it. The haystack is missing the data,
 * so the query has to stop being a string and start being an identity.
 *
 * ── Why this UNIONS with the text match rather than replacing it ──
 *
 * Cells render more than participants: round labels, event names, umpire, score,
 * court annotation. All of that is searchable today and none of it is in this index.
 * Replacing the text walk would fix doubles and quietly break "find the cell with
 * the umpire I need to move", so `searchGridCells` takes the union — identity
 * matching only ever ADDS cells.
 *
 * That also makes the diacritic folding below safe to apply here and not there.
 *
 * ── Why the paint needs no new DOM attribute ──
 *
 * Grid cells already carry `data-matchup-id`, so this module resolves a query to a
 * set of matchUpIds and the caller looks them up. Stamping participant ids onto
 * every cell would have duplicated identity that the matchUps already hold, and
 * gone stale on any render that missed one.
 *
 * ── Pure on purpose ──
 *
 * No DOM, no engine, no clock — the same split `participantRest.ts` /
 * `inspectorRest.ts` uses in this directory. TMX runs vitest **without jsdom**, so a
 * rule that touches `document` can only be tested through an e2e journey. This one
 * is a decision about strings and ids, which is exactly the shape that belongs in
 * the unit suite.
 */

// constants and types
import type { ReadinessMatchUp, ReadinessSide } from './matchUpReadiness';

/**
 * A single character is not a name search.
 *
 * The text path still runs on one character, so nothing becomes unfindable — this
 * only declines to EXPAND a one-letter query across every participant whose name
 * happens to start with it, which would light cells whose visible text the operator
 * cannot connect to what they typed.
 */
const MIN_QUERY_LENGTH = 2;

export interface GridSearchIndex {
  /** `matchUpId` → every participantId that matchUp can be found by. */
  byMatchUp: Map<string, Set<string>>;
  /** `participantId` → the name tokens that participant answers to. */
  tokensById: Map<string, string[]>;
}

/**
 * One name, lower-cased with diacritics folded to their base letters.
 *
 * Folding is why an operator who types `gomez` finds Gómez. It is applied here and
 * NOT in `searchNormalize` (the shared normalizer on the text path) deliberately:
 * this path is additive, so a fold can only add correct matches, while changing the
 * shared normalizer would alter what the text path has always matched.
 */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase();
}

/**
 * The tokens a name answers to.
 *
 * Split on whitespace, `/` and `,` — one splitter per way a name reaches us:
 * whitespace for `'Aiden Phoebus'`, `/` for the pair name `'Phoebus/Smith'`, and
 * `,` for the `'Phoebus, Aiden'` ordering a display config or an imported record may
 * produce. Hyphens are NOT split: a hyphenated family name is one token, and
 * `'Smith-Jones'` should not be findable as `'jones'` when the person does not go by
 * it. Prefix matching already handles the half an operator types first.
 */
export function nameTokens(name: string | undefined): string[] {
  if (!name) return [];
  return fold(name)
    .split(/[\s/,]+/)
    .filter(Boolean);
}

/** The query, as tokens. Same splitting as a name so the two sides cannot disagree. */
export function queryTokens(query: string): string[] {
  return nameTokens(query);
}

/**
 * Every participantId a matchUp should be findable by — the pair AND its members.
 *
 * Deliberately a superset of `matchUpReadiness.individualIds()`, which drops a
 * side's own id once its members are known so a pair is not counted twice when
 * comparing identities across sides. Search has the opposite need: the pair name
 * `Phoebus/Smith` is what a cell actually displays, so a query matching the PAIR has
 * to resolve too, and double-counting is meaningless when the answer is a Set.
 */
function searchableIds(side: ReadinessSide): string[] {
  const ids: string[] = [];
  const sideId = side.participantId ?? side.participant?.participantId;
  if (sideId) ids.push(sideId);
  for (const id of side.participant?.individualParticipantIds ?? []) ids.push(id);
  for (const member of side.participant?.individualParticipants ?? []) {
    if (member.participantId) ids.push(member.participantId);
  }
  return ids;
}

/** Record `name` against `participantId`, merging with anything already known. */
function addTokens(tokensById: Map<string, string[]>, participantId: string, name: string | undefined): void {
  const tokens = nameTokens(name);
  if (!tokens.length) return;
  const existing = tokensById.get(participantId);
  if (!existing) {
    tokensById.set(participantId, tokens);
    return;
  }
  // A participant is reached once per matchUp they appear in, and the same name
  // each time — so dedupe rather than letting the token list grow with the day.
  for (const token of tokens) if (!existing.includes(token)) existing.push(token);
}

/**
 * Build the index from hydrated matchUps.
 *
 * `matchUps` must be `inContext` — that is what attaches `participant` to each side
 * and `individualParticipants` to each pair. Un-hydrated matchUps produce an index
 * that resolves side ids and nothing else, which degrades to today's behaviour
 * rather than throwing.
 */
export function buildGridSearchIndex(matchUps: ReadinessMatchUp[] | undefined): GridSearchIndex {
  const byMatchUp = new Map<string, Set<string>>();
  const tokensById = new Map<string, string[]>();

  for (const matchUp of matchUps ?? []) {
    if (!matchUp?.matchUpId) continue;
    const ids = byMatchUp.get(matchUp.matchUpId) ?? new Set<string>();
    for (const side of matchUp.sides ?? []) {
      for (const id of searchableIds(side)) ids.add(id);

      const sideId = side.participantId ?? side.participant?.participantId;
      // The side's displayed name — a person in singles, `Phoebus/Smith` in doubles.
      if (sideId) addTokens(tokensById, sideId, side.participant?.participantName ?? side.participantName);
      // The members' own names, which is the whole point: these are the given+family
      // names that never reach the cell.
      for (const member of side.participant?.individualParticipants ?? []) {
        if (member.participantId) addTokens(tokensById, member.participantId, member.participantName);
      }
    }
    if (ids.size) byMatchUp.set(matchUp.matchUpId, ids);
  }

  return { byMatchUp, tokensById };
}

/**
 * Whether every query token prefixes some name token.
 *
 * Prefix-per-token, not substring. Substring would make `oebu` find Phoebus and, far
 * worse, let short queries expand across the whole draw; prefix-per-token is how an
 * operator actually types a name — `pho`, `aiden pho`, `pho aiden`, `a phoebus` all
 * resolve, in either order, because each token is tested against every name token.
 */
export function nameMatchesQuery(tokens: string[], queryParts: string[]): boolean {
  if (!queryParts.length) return false;
  return queryParts.every((part) => tokens.some((token) => token.startsWith(part)));
}

/** Participants whose name answers to `query`. */
export function participantIdsForQuery(index: GridSearchIndex, query: string): string[] {
  const queryParts = queryTokens(query);
  if (!queryParts.length) return [];
  if (queryParts.join('').length < MIN_QUERY_LENGTH) return [];

  const matched: string[] = [];
  for (const [participantId, tokens] of index.tokensById) {
    if (nameMatchesQuery(tokens, queryParts)) matched.push(participantId);
  }
  return matched;
}

/**
 * MatchUps a query resolves to by identity.
 *
 * Empty is the common answer — most queries are not names — and the caller's text
 * match covers those. It is never an error.
 */
export function matchUpIdsForQuery(index: GridSearchIndex, query: string): string[] {
  const participantIds = new Set(participantIdsForQuery(index, query));
  if (!participantIds.size) return [];

  const matchUpIds: string[] = [];
  for (const [matchUpId, ids] of index.byMatchUp) {
    for (const id of ids) {
      if (participantIds.has(id)) {
        matchUpIds.push(matchUpId);
        break;
      }
    }
  }
  return matchUpIds;
}
