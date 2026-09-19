import { describe, expect, it } from 'vitest';

import {
  ATTESTER_RELATIONSHIPS,
  describeAttester,
  buildAttester,
  requiresName,
  CHAPERONE,
  PARENT,
  SELF,
} from './checkInAttribution';

const participantId = 'p-nathaniel';
const GUARDIAN_NAME = 'A. Guardian';

describe('buildAttester', () => {
  it('states nothing when nobody was named', () => {
    // an un-attributed check-in records no attester, which is honest — nobody stated one
    expect(buildAttester({ participantId })).toBeUndefined();
  });

  it('points SELF at the subject rather than repeating their name', () => {
    const attester = buildAttester({ participantId, attester: { relationship: SELF } });

    // the player IS in the record, and an id does not go stale on a rename
    expect(attester).toEqual({ attributionType: 'PARTICIPANT', participantId, relationship: SELF });
  });

  it('declares an attester the record does not contain', () => {
    const attester = buildAttester({
      attester: { relationship: PARENT, name: GUARDIAN_NAME, telephone: '+1 555 0100' },
      participantId,
    });

    expect(attester).toEqual({
      attributionType: 'DECLARED',
      relationship: PARENT,
      telephone: '+1 555 0100',
      name: GUARDIAN_NAME,
    });
  });

  it('keeps the subject and the attester apart', () => {
    const attester: any = buildAttester({
      attester: { relationship: PARENT, name: GUARDIAN_NAME },
      participantId,
    });

    // the check-in is ABOUT the player; the parent only vouched for it
    expect(attester.participantId).toBeUndefined();
    expect(attester.name).toEqual(GUARDIAN_NAME);
  });

  it('omits a telephone that was left blank', () => {
    const attester: any = buildAttester({
      attester: { relationship: CHAPERONE, name: 'R. Okonkwo', telephone: '   ' },
      participantId,
    });

    expect(attester.telephone).toBeUndefined();
  });

  it('refuses a nameless non-self attester', () => {
    // "a parent, we didn't catch which" is not a fact worth storing, and a policy that enumerates
    // relationships refuses it anyway
    expect(buildAttester({ participantId, attester: { relationship: PARENT } })).toBeUndefined();
    expect(buildAttester({ participantId, attester: { relationship: PARENT, name: '  ' } })).toBeUndefined();
  });
});

describe('requiresName', () => {
  it('asks for a name for everyone except the player themselves', () => {
    expect(requiresName(SELF)).toEqual(false);
    for (const relationship of ATTESTER_RELATIONSHIPS.filter((r) => r !== SELF)) {
      expect(requiresName(relationship)).toEqual(true);
    }
  });
});

describe('describeAttester', () => {
  // a stand-in for `t`, so the pure helper stays DOM-free and locale-free
  const translate = (key: string, values?: Record<string, any>) => {
    const labels: Record<string, string> = {
      'checkIn.attester.bySelf': 'Checked in by themselves',
      'checkIn.attester.parent': 'Parent',
      'checkIn.attester.guardian': 'Guardian',
      'checkIn.attester.byRelationship': `Checked in by ${values?.name} (${values?.relationship})`,
      'checkIn.attester.byOperator': `Checked in by ${values?.name}`,
    };
    return labels[key] ?? key;
  };

  it('says nothing when nobody attested', () => {
    // the common case — a one-click check-in states nobody, and that must not read as a missing value
    expect(describeAttester(undefined, translate)).toBeUndefined();
  });

  it('describes the player vouching for themselves', () => {
    const attester = buildAttester({ participantId, attester: { relationship: SELF } });
    expect(describeAttester(attester, translate)).toEqual('Checked in by themselves');
  });

  it('describes a declared attester with their relationship', () => {
    const attester = buildAttester({
      attester: { relationship: PARENT, name: GUARDIAN_NAME },
      participantId,
    });
    expect(describeAttester(attester, translate)).toEqual('Checked in by A. Guardian (Parent)');
  });

  it('never renders a raw enum value to an operator', () => {
    // CHAPERONE has a label; an unknown relationship must fall back rather than leak the enum
    const known = buildAttester({ attester: { relationship: PARENT, name: 'A' }, participantId });
    expect(describeAttester(known, translate)).not.toContain('PARENT');

    const unknown = { attributionType: 'DECLARED', relationship: 'INVENTED', name: 'B' };
    expect(describeAttester(unknown, translate)).toEqual('Checked in by B');
  });

  it('never renders a dotted i18n key on a missing label', () => {
    // i18next returns the key on a miss, and a dotted path on screen is the exact bug this repo's
    // i18n-audit exists to catch
    const unknown = { attributionType: 'DECLARED', relationship: 'NOT_A_KEY', name: 'C' };
    expect(describeAttester(unknown, translate)).not.toContain('checkIn.attester');
  });

  it('names an operator who is not in the record, preferring a name over an id', () => {
    expect(describeAttester({ attributionType: 'USER', userId: 'u-42' }, translate)).toEqual('Checked in by u-42');
    expect(describeAttester({ attributionType: 'USER', userId: 'u-42', email: 'desk@example.com' }, translate)).toEqual(
      'Checked in by desk@example.com',
    );
    expect(describeAttester({ attributionType: 'USER', userId: 'u-42', displayName: 'Desk One' }, translate)).toEqual(
      'Checked in by Desk One',
    );
  });
});
