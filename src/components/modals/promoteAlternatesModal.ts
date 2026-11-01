/**
 * Promote alternates — choose how many of the event's alternates to accept, in their order.
 *
 * The count starts at the open places among the accepted entries (see promoteAlternatesPlan), within 1 and the
 * number of alternates; the list below it shows who will be promoted as the count changes.
 */
import {
  buildPromoteAlternatesMethod,
  alternatesToPromote,
  clampPromoteCount,
  getPromotionPlan,
} from 'components/tables/eventsTable/unified/promoteAlternatesPlan';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { openModal } from 'components/modals/baseModal/baseModal';
import { tournamentEngine } from 'services/factory/engine';
import { tmxToast } from 'services/notifications/tmxToast';
import { t } from 'i18n';

// constants
import { PROMOTE_ALTERNATES_CONFIRM, PROMOTE_ALTERNATES_COUNT } from 'constants/tmxConstants';

export function promoteAlternatesModal({
  eventId,
  drawId,
  callback,
}: {
  eventId: string;
  drawId?: string;
  callback?: () => void;
}): void {
  const { event } = tournamentEngine.getEvent({ eventId }) ?? {};
  if (!event) return;
  const plan = getPromotionPlan({ event });
  if (!plan.max) return;

  const { participants = [] } =
    tournamentEngine.getParticipants({ participantFilters: { participantIds: plan.alternateIds } }) ?? {};
  const nameOf = (participantId: string) =>
    participants.find((participant: any) => participant.participantId === participantId)?.participantName ??
    participantId;

  const content = document.createElement('div');

  const slots = document.createElement('p');
  slots.style.color = 'var(--tmx-text-secondary)';
  slots.textContent =
    plan.openSlots === undefined
      ? t('entries.promoteAlternates.noLimit')
      : t(
          plan.limitSource === 'targetDrawSize'
            ? 'entries.promoteAlternates.openSlotsTargetDrawSize'
            : 'entries.promoteAlternates.openSlotsEntriesLimit',
          {
            limit: plan.limit,
            accepted: plan.acceptedCount,
            open: plan.openSlots,
          },
        );
  content.appendChild(slots);

  const label = document.createElement('label');
  label.htmlFor = PROMOTE_ALTERNATES_COUNT;
  label.textContent = t('entries.promoteAlternates.count', { max: plan.max });
  const input = document.createElement('input');
  input.id = PROMOTE_ALTERNATES_COUNT;
  input.type = 'number';
  input.step = '1';
  input.min = String(plan.min);
  input.max = String(plan.max);
  input.value = String(plan.defaultCount);
  input.style.cssText =
    'width:6em;padding:0.25em 0.5em;border:1px solid var(--tmx-border-primary);border-radius:4px;' +
    'background:var(--tmx-bg-primary);color:var(--tmx-text-primary)';
  const field = document.createElement('div');
  field.style.cssText = 'display:flex;align-items:center;gap:0.75rem;margin-block:0.75rem';
  field.append(label, input);
  content.appendChild(field);

  const listHeading = document.createElement('p');
  listHeading.textContent = t('entries.promoteAlternates.willPromote');
  const list = document.createElement('ol');
  list.setAttribute('aria-live', 'polite');
  list.style.cssText = 'margin:0.25rem 0 0 1.5rem;color:var(--tmx-text-primary)';
  content.append(listHeading, list);

  // the count as typed, when it is a whole number within the bounds
  const typedCount = () => {
    const value = Number(input.value);
    return Number.isInteger(value) && value >= plan.min && value <= plan.max ? value : undefined;
  };

  let modalHandle: any;
  const render = () => {
    const count = typedCount();
    list.replaceChildren(
      ...alternatesToPromote(plan, count ?? plan.min).map((participantId) => {
        const item = document.createElement('li');
        item.textContent = nameOf(participantId);
        return item;
      }),
    );
    list.style.opacity = count === undefined ? '0.5' : '1';
    modalHandle?.setButtonState?.(PROMOTE_ALTERNATES_CONFIRM, { disabled: count === undefined });
  };
  input.addEventListener('input', render);
  input.addEventListener('change', () => {
    input.value = String(clampPromoteCount(input.value, plan));
    render();
  });

  const onClick = () => {
    const count = typedCount();
    if (count === undefined) return;
    const participantIds = alternatesToPromote(plan, count);
    mutationRequest({
      methods: [buildPromoteAlternatesMethod({ eventId, drawId, participantIds })],
      callback: (result: any) => {
        if (result?.success) {
          tmxToast({
            message: t('entries.promoteAlternates.promoted', { count: participantIds.length }),
            intent: 'is-success',
          });
          callback?.();
        } else {
          tmxToast({ message: result?.error?.message ?? t('entries.promoteAlternates.failed'), intent: 'is-danger' });
        }
      },
    });
  };

  modalHandle = openModal({
    title: t('entries.promoteAlternates.title'),
    content,
    buttons: [
      { label: t('common.cancel'), close: true },
      {
        id: PROMOTE_ALTERNATES_CONFIRM,
        label: t('entries.promoteAlternates.confirm'),
        intent: 'is-primary',
        close: true,
        onClick,
      },
    ],
  });
  render();
}
