/**
 * The multi-contact harvest.
 *
 * `modifyParticipant` REPLACES `person.contacts`, so this function's failure mode is data loss rather
 * than a wrong render. The single-contact version of this logic lived inline in the drawer and was
 * covered through `editIndividualParticipant.test.ts`; those tests still pass unchanged and remain the
 * integration-level guard. These cover the N-row generalisation directly, including the cases a
 * one-row form could not reach.
 */
import { collectContacts } from './collectContacts';
import { describe, expect, it } from 'vitest';

const MOBILE = '+1 555 0100';
const OTHER_MOBILE = '+1 555 9999';
const LANDLINE = '+1 555 1111';

/** A fully-offered row — every field the editor renders was present in the DOM. */
const row = (overrides: any = {}) => ({
  relationshipOffered: true,
  nameOffered: true,
  ...overrides,
});

describe('rule 1 — undefined leaves the stored list alone, [] clears it', () => {
  it('returns undefined when nothing was entered and nothing is stored', () => {
    // `[]` would instruct the factory to clear. A participant with no phone number must not carry an
    // instruction to wipe a list.
    expect(collectContacts({ rows: [row({})], existing: [] })).toBeUndefined();
  });

  it('returns [] when everything stored was cleared', () => {
    // Distinct from the case above: here the director deliberately emptied the only contact, and that
    // has to be expressible or a contact can never be removed.
    expect(collectContacts({ rows: [row({})], existing: [{ mobileTelephone: MOBILE }] })).toEqual([]);
  });
});

describe('rule 2 — emptiness is decided by the reachable fields', () => {
  it('drops a row that carries only a relationship and a name', () => {
    const result = collectContacts({
      rows: [row({ relationship: 'GUARDIAN', name: 'Ana Rivas' })],
      existing: [],
    });
    expect(result).toBeUndefined();
  });

  it('keeps a row reachable by email alone', () => {
    const result = collectContacts({ rows: [row({ emailAddress: 'ana@example.org' })], existing: [] });
    expect(result).toHaveLength(1);
    expect(result?.[0].emailAddress).toEqual('ana@example.org');
  });

  it('keeps a stored landline the form preserved rather than offered', () => {
    // The form shows mobile + email. Clearing both must not silently discard a landline that arrived
    // by import and that the row never rendered — that is rule 3 applied to reachability.
    const result = collectContacts({
      rows: [{ mobileTelephone: '', emailAddress: '' }],
      existing: [{ telephone: LANDLINE, name: 'desk' }],
    });
    expect(result).toEqual([
      { telephone: LANDLINE, name: 'desk', mobileTelephone: '', emailAddress: '', isPublic: false },
    ]);
  });

  it('drops a row whose landline the form DID offer and the director cleared', () => {
    // The inverse. Once the field is on screen, emptying it is an instruction.
    const result = collectContacts({
      rows: [row({ telephoneOffered: true, telephone: '', mobileTelephone: '', emailAddress: '' })],
      existing: [{ telephone: LANDLINE }],
    });
    expect(result).toEqual([]);
  });
});

describe('rule 3 — an absent row is preserved untouched', () => {
  it('keeps rows the form never rendered, byte for byte', () => {
    // The data-loss case, at N rows. A reduced form must not delete contacts it did not show.
    const emergency = { name: 'emergency', mobileTelephone: OTHER_MOBILE };
    const result = collectContacts({
      rows: [row({ mobileTelephone: MOBILE })],
      existing: [{ name: 'primary', mobileTelephone: '+1 555 0000' }, emergency],
    });
    expect(result).toHaveLength(2);
    expect(result?.[1]).toBe(emergency);
  });

  it('preserves fields the row does not carry', () => {
    const result = collectContacts({
      rows: [row({ mobileTelephone: MOBILE, nameOffered: false, relationshipOffered: false })],
      existing: [{ name: 'desk', telephone: LANDLINE, notes: 'ring twice', relationship: 'SELF' }],
    });
    expect(result?.[0].name).toEqual('desk');
    expect(result?.[0].notes).toEqual('ring twice');
    expect(result?.[0].telephone).toEqual(LANDLINE);
    expect(result?.[0].relationship).toEqual('SELF');
  });

  it('clears a field the row DID offer and left empty', () => {
    const result = collectContacts({
      rows: [row({ mobileTelephone: MOBILE, relationship: undefined, name: undefined })],
      existing: [{ mobileTelephone: '+1 555 0000', relationship: 'PARENT', name: 'Dad' }],
    });
    expect(result?.[0].relationship).toBeUndefined();
    expect(result?.[0].name).toBeUndefined();
  });
});

describe('adding and removing rows', () => {
  it('appends a contact entered in the spare row', () => {
    const result = collectContacts({
      rows: [row({ mobileTelephone: MOBILE }), row({ mobileTelephone: OTHER_MOBILE, name: 'emergency' })],
      existing: [{ mobileTelephone: MOBILE }],
    });
    expect(result).toHaveLength(2);
    expect(result?.[1].mobileTelephone).toEqual(OTHER_MOBILE);
    expect(result?.[1].name).toEqual('emergency');
  });

  it('removes a middle contact without disturbing the ones around it', () => {
    const result = collectContacts({
      rows: [row({ mobileTelephone: 'a1' }), row({ mobileTelephone: '' }), row({ mobileTelephone: 'c3' })],
      existing: [{ mobileTelephone: 'a1' }, { mobileTelephone: 'b2' }, { mobileTelephone: 'c3' }],
    });
    expect(result?.map((c) => c.mobileTelephone)).toEqual(['a1', 'c3']);
  });

  it('records consent per contact, not per person', () => {
    // The factory gates publication per contact (`getTournamentInfo` filters on `isPublic === true`),
    // so a single flag for the person would collapse a distinction the model already makes.
    const result = collectContacts({
      rows: [row({ mobileTelephone: MOBILE, isPublic: true }), row({ mobileTelephone: OTHER_MOBILE, isPublic: false })],
      existing: [],
    });
    expect(result?.map((c) => c.isPublic)).toEqual([true, false]);
  });
});

describe('the primary is positional', () => {
  it('promotes the selected row to index 0', () => {
    // Positional rather than an `isPrimary` marker: every existing reader — getTournamentInfo, the
    // participants table columns, the group contact-person row — reads `contacts[0]`, and a marker
    // would be a second source of truth for what the array order already says.
    const result = collectContacts({
      rows: [row({ mobileTelephone: 'a1' }), row({ mobileTelephone: 'b2' })],
      existing: [],
      primaryIndex: 1,
    });
    expect(result?.map((c) => c.mobileTelephone)).toEqual(['b2', 'a1']);
  });

  it('preserves stored order when no primary was selected', () => {
    const result = collectContacts({
      rows: [row({ mobileTelephone: 'a1' }), row({ mobileTelephone: 'b2' })],
      existing: [],
    });
    expect(result?.map((c) => c.mobileTelephone)).toEqual(['a1', 'b2']);
  });

  it('leaves the order alone when the selected row was removed in the same save', () => {
    // Marking a row primary and clearing it are contradictory instructions. The removal wins, and the
    // remaining order is untouched rather than arbitrarily rotated.
    const result = collectContacts({
      rows: [row({ mobileTelephone: 'a1' }), row({ mobileTelephone: '' }), row({ mobileTelephone: 'c3' })],
      existing: [],
      primaryIndex: 1,
    });
    expect(result?.map((c) => c.mobileTelephone)).toEqual(['a1', 'c3']);
  });

  it('promotes a row that the form did not render', () => {
    // Reorder must work on stored contacts the editor is only listing, not editing.
    const result = collectContacts({
      rows: [row({ mobileTelephone: 'a1' })],
      existing: [{ mobileTelephone: 'a1' }, { mobileTelephone: 'b2' }],
      primaryIndex: 1,
    });
    expect(result?.map((c) => c.mobileTelephone)).toEqual(['b2', 'a1']);
  });
});

describe('input guards', () => {
  it('tolerates a non-array stored value', () => {
    expect(collectContacts({ rows: [row({})], existing: undefined as any })).toBeUndefined();
  });

  it('keeps every stored contact when the form rendered no rows at all', () => {
    const existing = [{ mobileTelephone: MOBILE }, { mobileTelephone: OTHER_MOBILE }];
    expect(collectContacts({ rows: [], existing })).toEqual(existing);
  });
});
