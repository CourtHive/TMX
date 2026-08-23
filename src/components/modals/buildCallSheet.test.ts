/**
 * The call sheet's data layer.
 *
 * The assertions that matter most here are the negative ones. A bulk "text these six" that silently
 * reaches four is worse than one that refuses, because the director has no way to see the difference
 * — so every action reports who it will not reach, and that is asserted rather than assumed.
 */
import { callSheetPdfRows, emailRecipients, smsRecipients, buildCallSheet, allNumbers } from './buildCallSheet';
import { describe, expect, it } from 'vitest';

const MOBILE = '+1 555 0100';
const OTHER_MOBILE = '+1 555 0200';
const LANDLINE = '+1 555 1111';
const EMAIL = 'ana@example.org';

const row = (overrides: any = {}) => ({
  participantType: 'INDIVIDUAL',
  participantName: 'Ana Rivas',
  participantId: 'p1',
  ...overrides,
});

describe('buildCallSheet', () => {
  it('splits the population into reachable and unreachable', () => {
    const sheet = buildCallSheet([
      row({ participantId: 'p1', contacts: [{ mobileTelephone: MOBILE }] }),
      row({ participantId: 'p2', participantName: 'Raj Patel', contacts: [] }),
    ]);
    expect(sheet.entries.map((e) => e.participantId)).toEqual(['p1']);
    expect(sheet.unreachable.map((e) => e.participantId)).toEqual(['p2']);
  });

  it('counts a name-only contact as unreachable', () => {
    // A director cannot ring a name. This is the state the participants table already distinguishes
    // from "no contact at all", and collapsing them would hide that a number was never collected.
    const sheet = buildCallSheet([row({ contacts: [{ name: 'desk' }] })]);
    expect(sheet.entries).toHaveLength(0);
    expect(sheet.unreachable).toHaveLength(1);
  });

  it('preserves the table order rather than re-sorting', () => {
    // The director sorted the table. A printed sheet that disagrees with the screen it came from is
    // a sheet nobody trusts.
    const sheet = buildCallSheet([
      row({ participantId: 'z', participantName: 'Zoe', contacts: [{ mobileTelephone: MOBILE }] }),
      row({ participantId: 'a', participantName: 'Abe', contacts: [{ mobileTelephone: OTHER_MOBILE }] }),
    ]);
    expect(sheet.entries.map((e) => e.participantName)).toEqual(['Zoe', 'Abe']);
  });

  it('skips groupings, which have no person and therefore no contacts', () => {
    // A GROUP names its contact PERSON through `contactParticipantIds`; that person is on the sheet
    // in their own right. Reporting the group as "unreachable" would be a false alarm on every sheet.
    const sheet = buildCallSheet([
      row({ participantType: 'GROUP', participantName: 'Transport Van A' }),
      row({ participantType: 'TEAM', participantName: 'Team Blue' }),
    ]);
    expect(sheet.entries).toHaveLength(0);
    expect(sheet.unreachable).toHaveLength(0);
  });

  it('tolerates a row with no participantType, since not every caller sets one', () => {
    const sheet = buildCallSheet([{ participantName: 'Ana Rivas', contacts: [{ mobileTelephone: MOBILE }] }]);
    expect(sheet.entries).toHaveLength(1);
  });

  it('tolerates a non-array input', () => {
    expect(buildCallSheet(undefined as any)).toEqual({ entries: [], unreachable: [] });
  });
});

describe('smsRecipients', () => {
  it('sends ONE message per person, to their first mobile', () => {
    // Not every contact they hold: a competitor with a guardian, a chaperone and their own mobile
    // would otherwise get three copies of the same delay notice.
    const sheet = buildCallSheet([
      row({
        contacts: [
          { mobileTelephone: MOBILE, relationship: 'SELF' },
          { mobileTelephone: OTHER_MOBILE, relationship: 'GUARDIAN' },
        ],
      }),
    ]);
    expect(smsRecipients(sheet).values).toEqual([MOBILE]);
  });

  it('falls through to a later contact when the primary has no mobile', () => {
    const sheet = buildCallSheet([row({ contacts: [{ emailAddress: EMAIL }, { mobileTelephone: OTHER_MOBILE }] })]);
    expect(smsRecipients(sheet).values).toEqual([OTHER_MOBILE]);
  });

  it('reports the people it will NOT reach, including the ones with a landline only', () => {
    // The silent-partial-send failure. A director who texts six and reaches four has no way to see
    // which two missed it unless the action says so.
    const sheet = buildCallSheet([
      row({ participantId: 'p1', contacts: [{ mobileTelephone: MOBILE }] }),
      row({ participantId: 'p2', participantName: 'Raj Patel', contacts: [{ telephone: LANDLINE }] }),
      row({ participantId: 'p3', participantName: 'Sam Cole', contacts: [] }),
    ]);
    const { values, missing } = smsRecipients(sheet);
    expect(values).toEqual([MOBILE]);
    expect(missing.map((e) => e.participantId).sort((a, b) => (a as string).localeCompare(b as string))).toEqual([
      'p2',
      'p3',
    ]);
  });

  it('treats a whitespace-only number as missing', () => {
    const sheet = buildCallSheet([row({ contacts: [{ mobileTelephone: '   ', emailAddress: EMAIL }] })]);
    expect(smsRecipients(sheet).values).toEqual([]);
    expect(smsRecipients(sheet).missing).toHaveLength(1);
  });
});

describe('emailRecipients', () => {
  it('sends one message per person and reports the rest', () => {
    const sheet = buildCallSheet([
      row({ participantId: 'p1', contacts: [{ emailAddress: EMAIL }] }),
      row({ participantId: 'p2', participantName: 'Raj Patel', contacts: [{ mobileTelephone: MOBILE }] }),
    ]);
    const { values, missing } = emailRecipients(sheet);
    expect(values).toEqual([EMAIL]);
    expect(missing.map((e) => e.participantId)).toEqual(['p2']);
  });
});

describe('allNumbers', () => {
  it('collects every number on the sheet for the clipboard fallback', () => {
    const sheet = buildCallSheet([
      row({ contacts: [{ mobileTelephone: MOBILE }, { telephone: LANDLINE }] }),
      row({ participantId: 'p2', participantName: 'Raj Patel', contacts: [{ mobileTelephone: OTHER_MOBILE }] }),
    ]);
    expect(allNumbers(sheet)).toEqual([MOBILE, LANDLINE, OTHER_MOBILE]);
  });
});

describe('callSheetPdfRows', () => {
  it('emits one row per person with contacts stacked and aligned', () => {
    // The third line of Mobile must belong to the third line of Whose, or the printed sheet
    // attributes a number to the wrong person.
    const sheet = buildCallSheet([
      row({
        participantRole: 'PHYSIO',
        contacts: [
          { name: 'Ana', mobileTelephone: MOBILE, isPublic: true },
          { relationship: 'EMERGENCY', mobileTelephone: OTHER_MOBILE },
        ],
      }),
    ]);
    const [printed] = callSheetPdfRows(sheet);
    expect(printed.participantName).toEqual('Ana Rivas');
    expect(printed.participantRole).toEqual('PHYSIO');
    expect(printed.whose).toEqual('Ana\nEMERGENCY');
    expect(printed.mobileTelephone).toEqual(`${MOBILE}\n${OTHER_MOBILE}`);
    expect(printed.isPublic).toEqual('Y\nN');
  });

  it('marks a missing value rather than leaving a cell that looks intentional', () => {
    const sheet = buildCallSheet([row({ contacts: [{ mobileTelephone: MOBILE }] })]);
    const [printed] = callSheetPdfRows(sheet);
    expect(printed.emailAddress).toEqual('—');
    expect(printed.telephone).toEqual('—');
  });

  it('prints the unreachable people too, with empty contact cells', () => {
    // A sheet that silently omits the volunteer whose number nobody collected is a sheet that
    // claims the roster is complete.
    const sheet = buildCallSheet([
      row({ participantId: 'p1', contacts: [{ mobileTelephone: MOBILE }] }),
      row({ participantId: 'p2', participantName: 'Raj Patel', contacts: [] }),
    ]);
    const printed = callSheetPdfRows(sheet);
    expect(printed).toHaveLength(2);
    expect(printed[1].participantName).toEqual('Raj Patel');
    expect(printed[1].mobileTelephone).toEqual('');
  });

  it('records consent per contact, matching what the factory will publish', () => {
    const sheet = buildCallSheet([
      row({
        contacts: [
          { mobileTelephone: MOBILE, isPublic: false },
          { mobileTelephone: OTHER_MOBILE, isPublic: true },
        ],
      }),
    ]);
    expect(callSheetPdfRows(sheet)[0].isPublic).toEqual('N\nY');
  });
});
