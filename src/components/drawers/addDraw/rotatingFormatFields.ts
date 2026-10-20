import 'styles/components/rotatingDrawForm.css';
import type { RotatingCreation, RotatingFormat } from 'services/rotatingPartners/creation';
import { tournamentEngine } from 'services/factory/engine';
import { drawsGovernor } from 'tods-competition-factory';
import { t } from 'i18n';
import {
  AUTOMATED,
  DRAW_SIZE,
  DRAW_TYPE,
  MATCHUP_FORMAT,
  QUALIFIERS_COUNT,
  QUALIFYING_FIRST,
  QUALIFYING_POSITIONS,
  SEEDING_POLICY,
  ROTATING_FORMAT,
  ROTATING_POINT_TOTAL,
  ROTATING_TIE_RESOLUTION,
  ROTATING_ROUNDS,
  ROTATING_ROSTER,
  SEEDS_COUNT,
} from 'constants/tmxConstants';

function field(container: HTMLElement, key: string, input: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';
  const label = document.createElement('label');
  if (input.id) label.htmlFor = input.id;
  label.className = 'label';
  label.textContent = t(`rotatingPartners.creation.${key}`);
  const control = document.createElement('div');
  control.className = 'control font-medium';
  if (input instanceof HTMLSelectElement) {
    const select = document.createElement('div');
    select.className = 'select';
    select.style.width = '100%';
    input.style.width = '100%';
    select.appendChild(input);
    control.appendChild(select);
  } else {
    control.appendChild(input);
  }
  wrapper.append(label, control);
  container.appendChild(wrapper);
  return wrapper;
}

function option(select: HTMLSelectElement, value: string, label: string) {
  const item = document.createElement('option');
  item.value = value;
  item.textContent = label;
  select.appendChild(item);
}

export function mountRotatingFormatFields({
  target,
  inputs,
  event,
  selectedParticipantIds,
}: {
  target: HTMLElement;
  inputs: any;
  event: any;
  selectedParticipantIds?: string[];
}) {
  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const container = document.createElement('div');
  const drawTypeField = inputs[DRAW_TYPE]?.closest('.field');
  if (drawTypeField) drawTypeField.after(container);
  else target.appendChild(container);
  const format = document.createElement('select');
  format.id = ROTATING_FORMAT;
  option(format, 'STANDARD', t('rotatingPartners.creation.standard'));
  option(format, 'AMERICANO', 'Americano');
  option(format, 'MEXICANO', 'Mexicano');
  field(container, 'format', format);
  const details = document.createElement('div');
  container.appendChild(details);
  const total = document.createElement('input');
  total.id = ROTATING_POINT_TOTAL;
  total.type = 'number';
  total.min = '1';
  total.step = '1';
  total.value = '32';
  total.className = 'input font-medium';
  field(details, 'pointTotal', total);
  const variant = document.createElement('select');
  variant.id = ROTATING_TIE_RESOLUTION;
  field(details, 'tieResolution', variant);
  const rounds = document.createElement('input');
  rounds.id = ROTATING_ROUNDS;
  rounds.type = 'number';
  rounds.min = '1';
  rounds.step = '1';
  rounds.value = '7';
  rounds.className = 'input font-medium';
  const roundField = field(details, 'rounds', rounds);
  const notice = document.createElement('p');
  notice.className = 'help';
  details.appendChild(notice);
  const roster = document.createElement('div');
  roster.id = ROTATING_ROSTER;
  roster.className = 'rotating-roster';
  field(details, 'players', roster);
  const selected = new Set(selectedParticipantIds ?? []);
  const choices = (tournamentRecord?.participants ?? [])
    .filter(
      (p: any) => p.participantType === 'INDIVIDUAL' && (!p.participantRole || p.participantRole === 'COMPETITOR'),
    )
    .map((participant: any) => {
      const row = document.createElement('label');
      row.className = 'rotating-roster-option';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = selected.has(participant.participantId);
      row.append(check, document.createTextNode(` ${participant.participantName || participant.participantId}`));
      roster.appendChild(row);
      return { check, participantId: participant.participantId };
    });
  let variants: any[] = [];
  let policyError: string | undefined;
  const hiddenFields = [
    QUALIFYING_FIRST,
    QUALIFYING_POSITIONS,
    AUTOMATED,
    DRAW_SIZE,
    MATCHUP_FORMAT,
    QUALIFIERS_COUNT,
    SEEDING_POLICY,
    ROTATING_FORMAT,
    ROTATING_POINT_TOTAL,
    ROTATING_TIE_RESOLUTION,
    ROTATING_ROUNDS,
    ROTATING_ROSTER,
    SEEDS_COUNT,
  ];
  const previousDisplays = new Map<HTMLElement, string>();
  const active = () => inputs[DRAW_TYPE]?.value === 'AD_HOC' && format.value !== 'STANDARD';
  const sync = () => {
    container.hidden = inputs[DRAW_TYPE]?.value !== 'AD_HOC';
    details.hidden = !active();
    roundField.hidden = format.value !== 'MEXICANO';
    notice.textContent = t(
      format.value === 'MEXICANO'
        ? 'rotatingPartners.creation.mexicanoHelp'
        : 'rotatingPartners.creation.americanoHelp',
    );
    if (active() && inputs[QUALIFYING_FIRST]) inputs[QUALIFYING_FIRST].checked = false;
    if (inputs[DRAW_TYPE]?.value !== 'AD_HOC') {
      previousDisplays.clear();
      return;
    }
    for (const key of hiddenFields) {
      const wrapper = inputs[key]?.closest('.field') as HTMLElement | undefined;
      if (!wrapper) continue;
      if (active()) {
        if (!previousDisplays.has(wrapper)) previousDisplays.set(wrapper, wrapper.style.display);
        wrapper.style.display = 'none';
      } else if (previousDisplays.has(wrapper)) {
        wrapper.style.display = previousDisplays.get(wrapper)!;
        previousDisplays.delete(wrapper);
      }
    }
  };
  const loadPolicy = () => {
    if (format.value === 'STANDARD') return;
    const { policyDefinitions } = tournamentEngine.getPolicyDefinitions({ event, policyTypes: ['scoring'] });
    const permitted = policyDefinitions?.scoring?.rotatingPartners?.[format.value]?.permittedPointTotals;
    total.value = String(permitted?.[0] ?? 32);
    const profile = {
      version: 1,
      format: format.value,
      entrantScope: 'INDIVIDUAL',
      matchUpType: 'DOUBLES',
      scoring: { combinedPointTotal: Number(total.value) },
      standings: { metric: 'SIDE_POINTS', attribution: 'EACH_INDIVIDUAL' },
      pairing: { seed: 1, algorithmVersion: 1 },
      completion: { kind: 'PARTNERSHIP_COVERAGE' },
    };
    const result = drawsGovernor.getRotatingPartnerScoringPolicy({
      tournamentRecord,
      event,
      drawDefinition: { drawId: 'preview', drawType: 'AD_HOC', competitionProfile: profile } as any,
    });
    policyError = result.error ? String(result.info ?? result.error.message) : undefined;
    variants = result.scoringPolicy?.permittedVariants ?? [];
    variant.replaceChildren();
    variants.forEach((value, index) =>
      option(
        variant,
        String(index),
        t(`rotatingPartners.creation.${value.tieResolution}`, { margin: value.winningMargin }),
      ),
    );
    const defaultIndex = variants.findIndex(
      (value) => JSON.stringify(value) === JSON.stringify(result.scoringPolicy?.defaultVariant),
    );
    variant.value = String(Math.max(0, defaultIndex));
    variant.disabled = !!result.selectionLocked;
    total.disabled = permitted?.length === 1;
  };
  format.addEventListener('change', () => {
    loadPolicy();
    sync();
  });
  inputs[DRAW_TYPE]?.addEventListener('change', sync);
  sync();
  return {
    active,
    read(): { config?: RotatingCreation; error?: string } {
      if (policyError) return { error: policyError };
      const participantIds = choices.filter(({ check }) => check.checked).map(({ participantId }) => participantId);
      if (participantIds.length < 4 || participantIds.length > 128 || participantIds.length % 4)
        return { error: t('rotatingPartners.creation.rosterError') };
      const combinedPointTotal = Number(total.value);
      const roundCount = Number(rounds.value);
      if (
        !Number.isSafeInteger(combinedPointTotal) ||
        combinedPointTotal < 1 ||
        !Number.isSafeInteger(roundCount) ||
        roundCount < 1 ||
        !variants[Number(variant.value)]
      )
        return { error: t('rotatingPartners.creation.configError') };
      return {
        config: {
          format: format.value as RotatingFormat,
          participantIds,
          combinedPointTotal,
          rounds: roundCount,
          selectedVariant: variants[Number(variant.value)],
        },
      };
    },
  };
}
