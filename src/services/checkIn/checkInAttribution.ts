/**
 * Who attested a check-in — the desk's answer to "who presented this player?".
 *
 * **The subject and the attester are different people, and that is the whole point.** The
 * attestation's `participantId` is who is present; `attributedTo` is who vouched for it. A ten-year-old
 * is presented by a parent who is not in the tournament record at all, which is why the factory's
 * `DECLARED` variant takes a name rather than an id (see `presenceTypes.ts`).
 *
 * Pure and DOM-free: TMX's unit suite runs in the vitest `node` environment with no jsdom, so the
 * decisions live here and the rendering stays a thin shell — the same split `checkInState.ts` uses.
 *
 * ⚠️ `SELF` here means *the player presented themselves*, NOT *the operator typed it*. The operator's
 * own identity is a separate fact: TMX holds a CFS auth user (`email` / `userId`), which is neither a
 * `participantId` nor a CODES `personId`, so it needs an attribution variant of its own and a
 * server-side stamp to be worth trusting. Until that lands, an un-attributed check-in stores no
 * attester, which is honest — nobody stated one.
 */

export const DECLARED_ATTRIBUTION = 'DECLARED';
export const PARTICIPANT_ATTRIBUTION = 'PARTICIPANT';

/** The relationships a desk can choose between. Mirrors the factory's `ContactRelationshipEnum`. */
export const SELF = 'SELF';
export const PARENT = 'PARENT';
export const GUARDIAN = 'GUARDIAN';
export const CHAPERONE = 'CHAPERONE';
export const OTHER = 'OTHER';

export type AttesterRelationship = typeof SELF | typeof PARENT | typeof GUARDIAN | typeof CHAPERONE | typeof OTHER;

/** Offered in the order a desk actually needs them — self first, then the junior cases. */
export const ATTESTER_RELATIONSHIPS: AttesterRelationship[] = [SELF, PARENT, GUARDIAN, CHAPERONE, OTHER];

export type Attester = {
  relationship: AttesterRelationship;
  telephone?: string;
  name?: string;
};

/**
 * Build the `attributedTo` payload for a check-in, or `undefined` when there is nothing to state.
 *
 * `SELF` resolves to a `PARTICIPANT` attribution naming the subject: the player IS in the record, so
 * pointing at them is better than repeating their name as free text — a name is a snapshot that goes
 * stale on a rename, an id does not.
 *
 * Every other relationship is `DECLARED`, because the attester is someone the record does not contain.
 * An empty name yields `undefined` rather than a nameless attester: "a parent, we didn't catch which"
 * is not a fact worth storing, and a policy that enumerates relationships refuses it anyway.
 */
export function buildAttester({
  participantId,
  attester,
}: {
  participantId: string;
  attester?: Attester;
}): Record<string, any> | undefined {
  if (!attester) return undefined;

  if (attester.relationship === SELF) {
    return { attributionType: PARTICIPANT_ATTRIBUTION, participantId, relationship: SELF };
  }

  const name = attester.name?.trim();
  if (!name) return undefined;

  const declared: Record<string, any> = {
    attributionType: DECLARED_ATTRIBUTION,
    relationship: attester.relationship,
    name,
  };

  const telephone = attester.telephone?.trim();
  if (telephone) declared.telephone = telephone;

  return declared;
}

/**
 * Does this relationship need a name typed in?
 *
 * `SELF` does not — the subject is already identified. Everything else names somebody the record has
 * never heard of, so without a name there is no attester to record.
 */
export function requiresName(relationship: AttesterRelationship): boolean {
  return relationship !== SELF;
}

/**
 * The stored attester as a sentence, for the row's hover title.
 *
 * Returns `undefined` when nobody attested, so a caller renders the plain toggle hint rather than an
 * empty "checked in by". Absent attribution is the common case — a one-click check-in states nobody —
 * and it must not read as a missing value.
 *
 * `translate` is injected rather than imported so this stays pure and DOM-free; the popover passes
 * `t`. Relationship labels come from i18n rather than the raw enum, because `CHAPERONE` on screen is
 * a database value leaking into an operator's field of view.
 */
export function describeAttester(
  attributedTo: Record<string, any> | undefined,
  translate: (key: string, values?: Record<string, any>) => string,
): string | undefined {
  if (!attributedTo) return undefined;

  const { attributionType, relationship, displayName, name, email, userId } = attributedTo;

  if (attributionType === PARTICIPANT_ATTRIBUTION && relationship === SELF) {
    return translate('checkIn.attester.bySelf');
  }

  if (attributionType === DECLARED_ATTRIBUTION && name) {
    const label = relationshipLabel(relationship, translate);
    return label
      ? translate('checkIn.attester.byRelationship', { name, relationship: label })
      : translate('checkIn.attester.byOperator', { name });
  }

  // USER — an operator the tournament record does not contain. `userId` is the only field guaranteed
  // present, and it is a last resort: an id on screen is worse than a name and better than silence.
  const operator = displayName || email || userId;
  if (operator) return translate('checkIn.attester.byOperator', { name: operator });

  return undefined;
}

function relationshipLabel(
  relationship: string | undefined,
  translate: (key: string, values?: Record<string, any>) => string,
): string | undefined {
  if (!relationship || relationship === SELF) return undefined;
  const key = `checkIn.attester.${relationship.toLowerCase()}`;
  const label = translate(key);
  // i18next returns the key itself on a miss; rendering a dotted path to an operator is the bug the
  // repo's own i18n-audit exists to catch, so fall back to no label rather than to the key.
  return label === key ? undefined : label;
}
