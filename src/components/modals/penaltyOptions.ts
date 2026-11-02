import { penaltyConstants } from 'tods-competition-factory';
import { t } from 'i18n';

export type PenaltyOption = { label: string; value: string };

/**
 * The penalty codes, each labelled by its `penalties.<CODE>` key. The constants keep deprecated misspellings as
 * aliases of the corrected code, so a code is listed once however many names it has.
 */
export function penaltyTypeOptions(): PenaltyOption[] {
  const codes = [...new Set(Object.values(penaltyConstants) as string[])];
  return codes
    .map((code) => ({ label: t(`penalties.${code}`), value: code }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Who in a matchUp can be penalized: the individuals, since a penalty is assessed against a person. A doubles side
 * contributes both members of its pair. With `sideNumber`, only that side's.
 */
export function penaltyParticipantOptions(matchUp: any, sideNumber?: number): PenaltyOption[] {
  const sides = (matchUp?.sides ?? []).filter((side: any) => !sideNumber || side?.sideNumber === sideNumber);
  const options: PenaltyOption[] = [];
  for (const side of sides) {
    const participant = side?.participant;
    if (!participant) continue;
    const individuals = participant.individualParticipants?.length ? participant.individualParticipants : [participant];
    for (const individual of individuals) {
      if (!individual?.participantId || options.some(({ value }) => value === individual.participantId)) continue;
      options.push({ label: individual.participantName ?? individual.participantId, value: individual.participantId });
    }
  }
  return options;
}
