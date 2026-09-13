/**
 * Schedule2 — the Inspector's actions popover.
 *
 * The impure half of `inspectorActionsModel.ts`: builds the trigger, opens a
 * tippy popover, and dispatches into TMX's existing navigation and participant
 * surfaces. It decides nothing about *what* is offerable.
 *
 * ── Why this is anchored on the Inspector and not on the Rest section ──
 *
 * `inspectorRest.ts` drives a 30-second ticker that calls `replaceChildren()` on
 * its own section so the rest figures keep counting up. Anything anchored inside
 * that section is destroyed twice a minute — mid-interaction, with the popover
 * open. This block is a sibling of the Rest section rather than a child of it,
 * so it survives every tick and is rebuilt only when the Inspector's selection
 * actually changes, which is exactly when a stale popover *should* close.
 *
 * The two destinations reuse what already exists rather than reimplementing
 * navigation: `navigateToEvent` resolves the draw and structure from the matchUp
 * and highlights it on arrival, and `participantProfileModal` is the same card
 * the participants table opens.
 */

import { participantProfileModal } from 'components/modals/participantProfileModal';
import { clearScheduledTime, pickScheduledTime } from './matchUpTimeAction';
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { scheduleMutationAvailable } from './scheduleMutationControl';
import { buildInspectorActionModel } from './inspectorActionsModel';
import { getCachedAllMatchUps } from './schedule2DataCache';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { t } from 'i18n';

// constants and types
import type { InspectorActionModel, InspectorActionParticipant } from './inspectorActionsModel';
import type { ReadinessMatchUp } from './matchUpReadiness';

/** Opening hour, used only when nothing better is known — the same figure the grid falls back to. */
const DEFAULT_PICKER_TIME = '8:00 AM';

/** What the caller knows that the matchUp itself does not. */
export interface InspectorActionContext {
  /** The day being viewed, written when the matchUp carries no date of its own. */
  viewedDate?: string | null;
  /** Earliest time readiness says this matchUp could start, `HH:MM`. Seeds the picker. */
  notBefore?: string;
}

/** One clickable row in the popover. Shared shape so the draw row and the people read alike. */
function actionRow(label: string, onClick: () => void, icon?: string): HTMLElement {
  const row = document.createElement('button');
  row.type = 'button';
  row.className = 'tmx-inspector-action-row';
  if (icon) {
    const glyph = document.createElement('i');
    glyph.className = icon;
    glyph.setAttribute('aria-hidden', 'true');
    row.appendChild(glyph);
  }
  const text = document.createElement('span');
  text.textContent = label;
  row.appendChild(text);
  row.addEventListener('click', onClick);
  return row;
}

function heading(text: string): HTMLElement {
  const element = document.createElement('div');
  element.className = 'tmx-inspector-action-heading';
  element.textContent = text;
  return element;
}

/** The popover body: the draw destination, then every individual on the matchUp. */
/**
 * The schedule rows: set a time, and clear one once it exists.
 *
 * Offered here rather than only on the court grid because this is the surface
 * that says *why* a time is wrong — "not before 15:30" is two lines above these
 * rows. Making the operator find the cell to act on what the Inspector just told
 * them is the interaction this closes.
 */
function scheduleRows(
  model: InspectorActionModel,
  context: InspectorActionContext,
  requestClose: () => void,
): HTMLElement[] {
  if (!model.schedulable || !scheduleMutationAvailable()) return [];

  const rows = [
    actionRow(
      t('schedule.inspector.actions.setTime'),
      () => {
        requestClose();
        pickScheduledTime({
          matchUpId: model.matchUpId,
          // The readiness answer is the better default when there is one: the
          // Inspector has just said the matchUp cannot start before 15:30, so
          // opening the picker anywhere else asks the operator to retype what
          // the panel already worked out.
          defaultTime: context.notBefore ?? model.scheduledTime ?? DEFAULT_PICKER_TIME,
          scheduledDate: model.scheduledDate,
          viewedDate: context.viewedDate,
        });
      },
      'fa-solid fa-clock',
    ),
  ];

  if (model.scheduledTime) {
    rows.push(
      actionRow(
        t('schedule.inspector.actions.clearTime'),
        () => {
          requestClose();
          clearScheduledTime(model.matchUpId);
        },
        'fa-solid fa-xmark',
      ),
    );
  }
  return rows;
}

function buildContent(
  model: InspectorActionModel,
  context: InspectorActionContext,
  requestClose: () => void,
): HTMLElement {
  const content = document.createElement('div');
  content.className = 'tmx-inspector-actions-menu';

  const schedule = scheduleRows(model, context, requestClose);
  if (schedule.length) {
    content.appendChild(heading(t('schedule.inspector.actions.schedule')));
    for (const row of schedule) content.appendChild(row);
    content.appendChild(heading(t('schedule.inspector.actions.navigate')));
  }

  content.appendChild(
    actionRow(
      t('schedule.inspector.actions.viewDraw'),
      () => {
        requestClose();
        navigateToEvent({ eventId: model.eventId, matchUpId: model.matchUpId });
      },
      'fa-solid fa-sitemap',
    ),
  );

  if (model.participants.length) {
    content.appendChild(heading(t('schedule.inspector.actions.participants')));
    for (const participant of model.participants) content.appendChild(participantRow(participant, requestClose));
  }
  return content;
}

function participantRow(participant: InspectorActionParticipant, requestClose: () => void): HTMLElement {
  return actionRow(
    participant.participantName,
    () => {
      requestClose();
      participantProfileModal({ participantId: participant.participantId });
    },
    'fa-solid fa-id-card',
  );
}

function openMenu(anchor: HTMLElement, model: InspectorActionModel, context: InspectorActionContext): void {
  // Forward-declared so a row can dismiss the popover before navigating; a
  // popover left open across a route change lingers over the next page.
  let tip: TippyInstance | null = null;
  const content = buildContent(model, context, () => tip?.hide());

  tip = tippy(anchor, {
    content,
    trigger: 'manual',
    interactive: true,
    placement: 'bottom-start',
    theme: 'light-border',
    appendTo: () => document.body,
    onHidden: (instance) => instance.destroy(),
  });
  tip.show();
}

/**
 * The Inspector's actions block for one matchUp. Returns a fresh element per
 * call, matching the Inspector's rebuild-on-every-render contract, or null when
 * the matchUp is no longer in the tournament.
 */
export function renderInspectorActions(matchUpId: string, context: InspectorActionContext = {}): HTMLElement | null {
  if (!matchUpId) return null;

  const { matchUps } = getCachedAllMatchUps();
  const model = buildInspectorActionModel(matchUpId, (matchUps ?? []) as ReadinessMatchUp[]);
  if (!model) return null;

  const block = document.createElement('div');
  block.className = 'tmx-inspector-actions';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'tmx-inspector-actions-trigger';
  trigger.title = t('schedule.inspector.actions.trigger');
  trigger.dataset.matchUpId = matchUpId;

  const glyph = document.createElement('i');
  glyph.className = 'fa-solid fa-sitemap';
  glyph.setAttribute('aria-hidden', 'true');
  trigger.appendChild(glyph);

  trigger.addEventListener('click', () => openMenu(trigger, model, context));
  block.appendChild(trigger);

  const label = document.createElement('span');
  label.className = 'tmx-inspector-actions-label';
  label.textContent = model.label;
  block.appendChild(label);

  return block;
}
