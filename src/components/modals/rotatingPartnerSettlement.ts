import { getSettlementContext, buildSettlementMethod, previewSettlement } from 'services/rotatingPartners/settlement';
import { openModal, closeModal } from 'components/modals/baseModal/baseModal';
import { getUserContext } from 'services/authentication/getUserContext';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { getLoginState } from 'services/authentication/loginState';
import { tmxToast } from 'services/notifications/tmxToast';
import { randomId } from 'functions/randomId';
import { t } from 'i18n';

// constants and types
import type { SettlementTreatment } from 'services/rotatingPartners/settlement';
import type { MutationMethod } from 'types/services';
import {
  ROTATING_SETTLEMENT_TREATMENT,
  ROTATING_SETTLEMENT_REASON,
  ROTATING_SETTLEMENT_ACTOR,
  ROTATING_SETTLEMENT_WINNING_POINTS,
  ROTATING_SETTLEMENT_LOSING_POINTS,
  ROTATING_SETTLEMENT_CONFIRM,
} from 'constants/tmxConstants';

export function openRotatingPartnerSettlement({
  drawId,
  matchUpId,
  callback,
}: {
  drawId: string;
  matchUpId: string;
  callback?: () => void;
}): void {
  const context = getSettlementContext(drawId, matchUpId);
  if (!context) return;
  const content = document.createElement('div');
  const summary = document.createElement('p');
  const sets = context.expectedOutcome.score?.sets ?? [];
  summary.textContent = [
    context.expectedOutcome.matchUpStatus,
    ...sets.map((set) => `${set.side1Score ?? ''}–${set.side2Score ?? ''}`),
  ].join(' · ');
  content.appendChild(summary);
  const explanation = document.createElement('p');
  explanation.textContent = t('rotatingPartners.settlement.explanation');
  content.appendChild(explanation);

  const treatment = document.createElement('select');
  const choices = [
    { kind: 'EXCLUDE', label: 'exclude', disabled: false },
    { kind: 'PLAYED_POINTS', label: 'playedPoints', disabled: !sets.length },
    { kind: 'CREDIT', label: 'credit', disabled: !context.expectedOutcome.winningSide },
  ];
  for (const choice of choices) {
    const option = document.createElement('option');
    option.value = choice.kind;
    option.textContent = t(`rotatingPartners.settlement.${choice.label}`);
    option.disabled = choice.disabled;
    treatment.appendChild(option);
  }
  field(content, ROTATING_SETTLEMENT_TREATMENT, t('rotatingPartners.settlement.treatment'), treatment);
  const credits = document.createElement('div');
  const winningPoints = pointInput();
  const losingPoints = pointInput();
  field(credits, ROTATING_SETTLEMENT_WINNING_POINTS, t('rotatingPartners.settlement.winningPoints'), winningPoints);
  field(credits, ROTATING_SETTLEMENT_LOSING_POINTS, t('rotatingPartners.settlement.losingPoints'), losingPoints);
  credits.hidden = true;
  content.appendChild(credits);
  const reason = document.createElement('textarea');
  reason.required = true;
  field(content, ROTATING_SETTLEMENT_REASON, t('rotatingPartners.settlement.reason'), reason);
  const actor = document.createElement('input');
  const login = getLoginState();
  actor.value = getUserContext()?.userId ?? login?.userId ?? login?.email ?? '';
  actor.disabled = !!actor.value;
  actor.required = true;
  field(content, ROTATING_SETTLEMENT_ACTOR, t('rotatingPartners.settlement.recordedBy'), actor);
  const preview = document.createElement('div');
  preview.setAttribute('aria-live', 'polite');
  content.appendChild(preview);
  let approved: MutationMethod | undefined;
  let submitting = false;
  const confirmation = () => document.getElementById(ROTATING_SETTLEMENT_CONFIRM) as HTMLButtonElement | null;
  const invalidate = () => {
    approved = undefined;
    const button = confirmation();
    if (button) button.disabled = true;
    preview.replaceChildren();
    credits.hidden = treatment.value !== 'CREDIT';
  };
  content.addEventListener('input', invalidate);
  treatment.addEventListener('change', invalidate);

  const showPreview = () => {
    invalidate();
    if (!reason.value.trim() || !actor.value.trim()) {
      preview.textContent = t('rotatingPartners.settlement.required');
      return;
    }
    const selected: SettlementTreatment =
      treatment.value === 'CREDIT'
        ? { kind: 'CREDIT', winningPoints: Number(winningPoints.value), losingPoints: Number(losingPoints.value) }
        : { kind: treatment.value as 'EXCLUDE' | 'PLAYED_POINTS' };
    if (selected.kind === 'CREDIT' && (!winningPoints.value || !losingPoints.value)) {
      preview.textContent = t('rotatingPartners.settlement.required');
      return;
    }
    const method = buildSettlementMethod(context, {
      requestId: randomId(),
      treatment: selected,
      reason: reason.value.trim(),
      recordedBy: actor.value.trim(),
      recordedAt: new Date().toISOString(),
    });
    const result = previewSettlement(context, method);
    if (!result.success) {
      preview.textContent = result.error ?? t('common.error');
      return;
    }
    const table = document.createElement('table');
    const heading = document.createElement('tr');
    for (const key of ['player', 'points', 'total']) {
      const cell = document.createElement('th');
      cell.textContent = t(`rotatingPartners.settlement.${key}`);
      heading.appendChild(cell);
    }
    table.appendChild(heading);
    for (const player of result.players ?? []) {
      const row = document.createElement('tr');
      for (const value of [player.participantName, player.points, player.total]) {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.appendChild(cell);
      }
      table.appendChild(row);
    }
    preview.appendChild(table);
    approved = method;
    const button = confirmation();
    if (button) button.disabled = false;
  };
  const submit = () => {
    if (!approved || submitting) return;
    submitting = true;
    const button = confirmation();
    if (button) button.disabled = true;
    mutationRequest({
      methods: [approved],
      callback: (result) => {
        submitting = false;
        if (result?.error) {
          invalidate();
          tmxToast({
            message:
              Reflect.get(result, 'info') ??
              (typeof result.error === 'string' ? result.error : result.error.message) ??
              t('common.error'),
            intent: 'is-danger',
          });
        } else {
          closeModal();
          callback?.();
        }
      },
    });
  };
  openModal({
    title: t('rotatingPartners.settlement.title'),
    content,
    buttons: [
      { label: t('common.cancel'), close: true },
      { label: t('rotatingPartners.settlement.preview'), onClick: showPreview, close: false },
      {
        id: ROTATING_SETTLEMENT_CONFIRM,
        label: t('rotatingPartners.settlement.confirm'),
        onClick: submit,
        close: false,
        disabled: true,
        intent: 'is-primary',
      },
    ],
  });
}

function pointInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.required = true;
  return input;
}

function field(parent: HTMLElement, id: string, title: string, input: HTMLElement): void {
  const wrapper = document.createElement('div');
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = title;
  input.id = id;
  wrapper.style.display = 'grid';
  wrapper.style.gap = '0.25rem';
  wrapper.style.marginBlock = '0.75rem';
  wrapper.append(label, input);
  parent.appendChild(wrapper);
}
