import {
  buildGridSearchIndex,
  matchUpIdsForQuery,
  nameMatchesQuery,
  nameTokens,
  participantIdsForQuery,
} from './gridSearchIndex';
import { describe, expect, it } from 'vitest';

/**
 * The scenario is the one CA reported from a prod tournament on 2026-09-27: Aiden
 * Phoebus plays singles under his full name and doubles under a pair whose
 * `participantName` is `Phoebus/Smith` — family names only, which is what the
 * factory composes and therefore all the cell can ever display.
 */
/** Hoisted because the suite leans on them repeatedly and sonarjs flags a literal used 3+ times. */
const AIDEN_NAME = 'Aiden Phoebus';
const PAIR_NAME = 'Phoebus/Smith';

const AIDEN = 'p-aiden';
const SMITH = 'p-smith';
const RIVAL = 'p-rival';
const JORDAN = 'p-jordan-phoebus';
const PAIR_AS = 'pair-aiden-smith';
const PAIR_RIVALS = 'pair-rivals';

const singles = (matchUpId: string, oneId: string, oneName: string, twoId: string, twoName: string): any => ({
  matchUpId,
  sides: [
    { participantId: oneId, participant: { participantId: oneId, participantName: oneName } },
    { participantId: twoId, participant: { participantId: twoId, participantName: twoName } },
  ],
});

const doubles = (matchUpId: string): any => ({
  matchUpId,
  sides: [
    {
      participantId: PAIR_AS,
      participant: {
        participantId: PAIR_AS,
        participantName: PAIR_NAME,
        individualParticipantIds: [AIDEN, SMITH],
        individualParticipants: [
          { participantId: AIDEN, participantName: AIDEN_NAME },
          { participantId: SMITH, participantName: 'Ravi Smith' },
        ],
      },
    },
    {
      participantId: PAIR_RIVALS,
      participant: {
        participantId: PAIR_RIVALS,
        participantName: 'Carrasco/Talla',
        individualParticipantIds: [RIVAL, 'p-talla'],
        individualParticipants: [
          { participantId: RIVAL, participantName: 'Luis Carrasco' },
          { participantId: 'p-talla', participantName: 'Omar Talla' },
        ],
      },
    },
  ],
});

const AIDEN_SINGLES = 'mu-singles-aiden';
const AIDEN_DOUBLES = 'mu-doubles-aiden';
const OTHER_SINGLES = 'mu-singles-other';

const matchUps = [
  singles(AIDEN_SINGLES, AIDEN, AIDEN_NAME, RIVAL, 'Luis Carrasco'),
  doubles(AIDEN_DOUBLES),
  singles(OTHER_SINGLES, JORDAN, 'Jordan Phoebus', 'p-other', 'Tin Chen'),
];

const index = buildGridSearchIndex(matchUps);

describe('nameTokens', () => {
  it('splits a pair name on the slash the factory composes it with', () => {
    expect(nameTokens(PAIR_NAME)).toEqual(['phoebus', 'smith']);
  });

  it('splits whitespace and the comma of a "Last, First" ordering', () => {
    expect(nameTokens(AIDEN_NAME)).toEqual(['aiden', 'phoebus']);
    expect(nameTokens('Phoebus, Aiden')).toEqual(['phoebus', 'aiden']);
  });

  it('folds diacritics so an operator typing ASCII finds the person', () => {
    expect(nameTokens('Sofía Gómez')).toEqual(['sofia', 'gomez']);
  });

  it('keeps a hyphenated family name as ONE token', () => {
    // Prefix matching covers the half that gets typed first; splitting would make
    // someone findable by a name they do not go by.
    expect(nameTokens('Anna Smith-Jones')).toEqual(['anna', 'smith-jones']);
  });

  it('reports an absent or empty name as no tokens', () => {
    expect(nameTokens(undefined)).toEqual([]);
    expect(nameTokens('   ')).toEqual([]);
  });
});

describe('nameMatchesQuery', () => {
  const tokens = ['aiden', 'phoebus'];

  it('matches a full name, either token order', () => {
    expect(nameMatchesQuery(tokens, ['aiden', 'phoebus'])).toBe(true);
    expect(nameMatchesQuery(tokens, ['phoebus', 'aiden'])).toBe(true);
  });

  it('matches a prefix of any token', () => {
    expect(nameMatchesQuery(tokens, ['pho'])).toBe(true);
    expect(nameMatchesQuery(tokens, ['a', 'phoebus'])).toBe(true);
  });

  it('does NOT match mid-token, which is what keeps short queries from expanding', () => {
    expect(nameMatchesQuery(tokens, ['oebu'])).toBe(false);
  });

  it('requires EVERY query token to land', () => {
    expect(nameMatchesQuery(tokens, ['aiden', 'smith'])).toBe(false);
  });

  it('declines an empty query rather than matching everything', () => {
    expect(nameMatchesQuery(tokens, [])).toBe(false);
  });
});

describe('buildGridSearchIndex', () => {
  it('indexes a doubles matchUp under its pair AND both members', () => {
    const ids = index.byMatchUp.get(AIDEN_DOUBLES);
    expect(ids?.has(PAIR_AS)).toBe(true);
    expect(ids?.has(AIDEN)).toBe(true);
    expect(ids?.has(SMITH)).toBe(true);
  });

  it('records a member’s full name, which the pair name never carries', () => {
    expect(index.tokensById.get(AIDEN)).toEqual(['aiden', 'phoebus']);
    expect(index.tokensById.get(PAIR_AS)).toEqual(['phoebus', 'smith']);
  });

  it('tolerates un-hydrated matchUps by falling back to side ids', () => {
    const bare = buildGridSearchIndex([{ matchUpId: 'mu-bare', sides: [{ participantId: 'p-bare' }] } as any]);
    expect(bare.byMatchUp.get('mu-bare')?.has('p-bare')).toBe(true);
    expect(bare.tokensById.size).toBe(0);
  });

  it('skips a matchUp with no id and one with no identifiable sides', () => {
    const built = buildGridSearchIndex([{ sides: [] } as any, { matchUpId: 'mu-empty', sides: [{}] } as any]);
    expect(built.byMatchUp.size).toBe(0);
  });

  it('does not duplicate tokens for a participant met in more than one matchUp', () => {
    // Luis Carrasco appears in the singles and, as a pair member, in the doubles.
    expect(index.tokensById.get(RIVAL)).toEqual(['luis', 'carrasco']);
  });

  it('survives an absent matchUps array', () => {
    expect(buildGridSearchIndex(undefined).byMatchUp.size).toBe(0);
  });
});

describe('participantIdsForQuery', () => {
  it('resolves a full name to the one person', () => {
    expect(participantIdsForQuery(index, AIDEN_NAME)).toEqual([AIDEN]);
  });

  it('resolves a shared family name to EVERY person who carries it, plus the pair', () => {
    // Two Phoebuses in this draw. Surfacing both is the honest answer — it is also
    // exactly why the rejected "search the surname instead" fix was not good enough.
    const resolved = participantIdsForQuery(index, 'Phoebus');
    expect(new Set(resolved)).toEqual(new Set([AIDEN, JORDAN, PAIR_AS]));
  });

  it('declines a single character rather than expanding across the draw', () => {
    expect(participantIdsForQuery(index, 'a')).toEqual([]);
  });

  it('declines an empty or whitespace query', () => {
    expect(participantIdsForQuery(index, '')).toEqual([]);
    expect(participantIdsForQuery(index, '   ')).toEqual([]);
  });

  it('returns nothing for a query that is not a name', () => {
    expect(participantIdsForQuery(index, 'R32')).toEqual([]);
  });
});

describe('matchUpIdsForQuery', () => {
  it('finds the DOUBLES matchUp from a full name the doubles cell cannot display', () => {
    // The defect, stated as a test: the cell reads `Phoebus/Smith`, the query is
    // `Aiden Phoebus`, and the text path can never connect them.
    expect(matchUpIdsForQuery(index, AIDEN_NAME)).toEqual([AIDEN_SINGLES, AIDEN_DOUBLES]);
  });

  it('finds a partner by their own name too', () => {
    expect(matchUpIdsForQuery(index, 'Ravi Smith')).toEqual([AIDEN_DOUBLES]);
  });

  it('still resolves the pair name the cell actually shows', () => {
    expect(matchUpIdsForQuery(index, PAIR_NAME)).toEqual([AIDEN_DOUBLES]);
  });

  it('includes both namesakes’ matchUps for a family-name query', () => {
    expect(new Set(matchUpIdsForQuery(index, 'Phoebus'))).toEqual(
      new Set([AIDEN_SINGLES, AIDEN_DOUBLES, OTHER_SINGLES]),
    );
  });

  it('returns nothing for a non-name query, leaving it to the text match', () => {
    expect(matchUpIdsForQuery(index, 'umpire')).toEqual([]);
  });
});
