/**
 * Correcting or withdrawing a penalty once it has been issued. TMX adds penalties from a matchUp (the PENALTY matchUp
 * action, `addPenaltyModal`); these build the methods that change or remove one afterwards, and the rows the
 * participant's penalties list shows.
 *
 * Lives in its own module so it can be tested without importing the modal, which pulls courthive-components.
 */
import { MODIFY_PENALTY, REMOVE_PENALTY } from 'constants/mutationConstants';

export type PenaltyRow = {
  penaltyId: string;
  penaltyType: string;
  notes?: string;
  matchUpId?: string;
  issuedAt?: string;
  createdAt?: string;
};

/** A participant's penalties, newest first. */
export function penaltyRows(participant: any): PenaltyRow[] {
  const when = (penalty: PenaltyRow) => penalty.issuedAt ?? penalty.createdAt ?? '';
  return [...(participant?.penalties ?? [])]
    .filter((penalty: any) => penalty?.penaltyId)
    .sort((a, b) => when(b).localeCompare(when(a)));
}

/** An emptied note removes it, rather than storing an empty string. */
export function modifyPenaltyMethod({
  penaltyType,
  penaltyId,
  notes,
}: {
  penaltyType: string;
  penaltyId: string;
  notes?: string;
}) {
  const trimmed = notes?.trim();
  return {
    method: MODIFY_PENALTY,
    params: { penaltyId, modifications: { penaltyType, notes: trimmed || undefined } },
  };
}

export function removePenaltyMethod(penaltyId: string) {
  return { method: REMOVE_PENALTY, params: { penaltyId } };
}
