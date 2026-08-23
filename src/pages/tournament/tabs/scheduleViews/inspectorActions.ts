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
import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { buildInspectorActionModel } from './inspectorActionsModel';
import { getCachedAllMatchUps } from './schedule2DataCache';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { t } from 'i18n';

// constants and types
import type { InspectorActionModel, InspectorActionParticipant } from './inspectorActionsModel';
import type { ReadinessMatchUp } from './matchUpReadiness';

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
function buildContent(model: InspectorActionModel, requestClose: () => void): HTMLElement {
  const content = document.createElement('div');
  content.className = 'tmx-inspector-actions-menu';

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

function openMenu(anchor: HTMLElement, model: InspectorActionModel): void {
  // Forward-declared so a row can dismiss the popover before navigating; a
  // popover left open across a route change lingers over the next page.
  let tip: TippyInstance | null = null;
  const content = buildContent(model, () => tip?.hide());

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
export function renderInspectorActions(matchUpId: string): HTMLElement | null {
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

  trigger.addEventListener('click', () => openMenu(trigger, model));
  block.appendChild(trigger);

  const label = document.createElement('span');
  label.className = 'tmx-inspector-actions-label';
  label.textContent = model.label;
  block.appendChild(label);

  return block;
}
