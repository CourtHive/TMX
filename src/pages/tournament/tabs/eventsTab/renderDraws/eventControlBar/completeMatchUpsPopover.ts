/**
 * The local-mode "complete matchUps" control (no provider): all remaining, or through a chosen round (CA 2026-11-08).
 *
 * The rounds read as a stepper: done rounds carry a check; hovering or focusing an open round lights every round
 * from the first still to play through it, and the caption says what that choice completes before it is made.
 * The arithmetic is `services/completionRounds`, which the factory's `roundsToComplete` agrees with.
 */
import { completionRounds, roundsToCompleteThrough, throughRoundSpan } from 'services/completionRounds';
import type { CompletionRound, CompletionRounds } from 'services/completionRounds';
import { completeMatchUps } from 'services/devCompleteMatchUps';
import { tournamentEngine } from 'services/factory/engine';
import tippy, { Instance } from 'tippy.js';
import { t } from 'i18n';

import './completeMatchUpsPopover.css';

let tip: Instance | undefined;
let onEscape: ((e: KeyboardEvent) => void) | undefined;

function destroyTip(): void {
  if (onEscape) document.removeEventListener('keydown', onEscape);
  onEscape = undefined;
  tip?.destroy();
  tip = undefined;
}

type OpenParams = { anchor: HTMLElement; drawId: string; structureId: string; structureName?: string };

export function openCompleteMatchUpsPopover({ anchor, drawId, structureId, structureName }: OpenParams): void {
  // the icon toggles: a second click closes what the first opened
  if (tip?.reference === anchor) return destroyTip();
  destroyTip();

  // The bar button carries its tooltip as a tippy on the same element. Destroying this popover deletes the
  // element's `_tippy`, so the tooltip is set aside while the popover is open and handed back when it closes.
  const tooltip = (anchor as any)._tippy as Instance | undefined;
  tooltip?.hide();
  tooltip?.disable();
  const restoreTooltip = () => {
    if (!tooltip || tooltip.state.isDestroyed) return;
    (anchor as any)._tippy = tooltip;
    tooltip.enable();
  };

  const matchUps = (tournamentEngine.allDrawMatchUps({ drawId, inContext: true }).matchUps ?? []).filter(
    (m: any) => m.structureId === structureId || m.containerStructureId === structureId,
  );
  const completion = completionRounds(matchUps);

  const apply = (roundsToComplete?: number) => {
    destroyTip();
    completeMatchUps({ drawId, structureId, roundsToComplete });
  };

  const container = document.createElement('div');
  container.className = 'tmx-complete-matchups';

  const heading = document.createElement('div');
  heading.className = 'tmx-cm-heading';
  heading.textContent = structureName
    ? `${t('pages.events.completeMatchUps.title')} · ${structureName}`
    : t('pages.events.completeMatchUps.title');
  container.appendChild(heading);

  if (!completion.openCount) {
    const done = document.createElement('div');
    done.className = 'tmx-cm-caption';
    done.textContent = t('pages.events.completeMatchUps.nothingLeft');
    container.appendChild(done);
  } else {
    container.appendChild(allButton(completion, () => apply()));
    const openRounds = completion.rounds.filter((round) => round.openCount);
    // with one round left to play, "through it" is "all remaining": the stepper would offer the same thing twice
    if (openRounds.length > 1) container.appendChild(roundStepper(completion, apply));
  }

  tip = tippy(anchor, {
    content: container,
    theme: 'light-border',
    placement: 'bottom-end',
    interactive: true,
    trigger: 'manual',
    appendTo: () => document.body,
    onClickOutside: () => destroyTip(),
    onDestroy: restoreTooltip,
    onShown: () => (container.querySelector('.tmx-cm-round[data-open="true"]') as HTMLElement | null)?.focus(),
  });
  tip.show();

  // on the document: with nothing left to complete the popover holds no control to take focus
  onEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    destroyTip();
    anchor.focus();
  };
  document.addEventListener('keydown', onEscape);
}

function allButton(completion: CompletionRounds, onClick: () => void): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tmx-cm-all';
  button.innerHTML = '<i class="fa-solid fa-check-double"></i>';
  const label = document.createElement('span');
  label.textContent = t('pages.events.completeMatchUps.all');
  const count = document.createElement('span');
  count.className = 'tmx-cm-count';
  count.textContent = String(completion.openCount);
  button.append(label, count);
  button.addEventListener('click', onClick);
  return button;
}

function roundStepper(completion: CompletionRounds, apply: (roundsToComplete?: number) => void): HTMLElement {
  const section = document.createElement('div');
  section.className = 'tmx-cm-through';

  const label = document.createElement('div');
  label.className = 'tmx-cm-label';
  label.textContent = t('pages.events.completeMatchUps.throughRound');

  const track = document.createElement('div');
  track.className = 'tmx-cm-track';
  track.setAttribute('role', 'group');
  track.setAttribute('aria-label', t('pages.events.completeMatchUps.throughRound'));

  const caption = document.createElement('div');
  caption.className = 'tmx-cm-caption';

  const pills = completion.rounds.map((round) => roundPill(round));
  const openPills = pills.filter((pill) => pill.dataset.open === 'true');
  // the line between two rounds: green between completed rounds, lit across the rounds a choice would complete
  const links = pills.slice(1).map((_, index) => {
    const link = document.createElement('span');
    link.className = 'tmx-cm-link';
    link.dataset.index = String(index);
    return link;
  });

  const preview = (targetRound?: number) => {
    const span = targetRound === undefined ? [] : throughRoundSpan(completion, targetRound);
    const lit = new Set(span.map((round) => round.roundNumber));
    for (const pill of pills) pill.dataset.lit = String(lit.has(Number(pill.dataset.roundNumber)));
    for (const link of links) {
      const [left, right] = [pills[Number(link.dataset.index)], pills[Number(link.dataset.index) + 1]];
      link.dataset.state = linkState(left, right);
    }
    caption.textContent = span.length ? captionFor(span) : '';
  };

  for (const pill of pills) {
    const roundNumber = Number(pill.dataset.roundNumber);
    if (pill.dataset.open !== 'true') continue;
    pill.addEventListener('mouseenter', () => preview(roundNumber));
    pill.addEventListener('focus', () => preview(roundNumber));
    pill.addEventListener('click', () => apply(roundsToCompleteThrough(completion, roundNumber)));
    pill.addEventListener('keydown', (e) => {
      const index = openPills.indexOf(pill);
      if (e.key === 'ArrowRight') openPills[index + 1]?.focus();
      if (e.key === 'ArrowLeft') openPills[index - 1]?.focus();
    });
  }
  track.addEventListener('mouseleave', () => {
    const focused = pills.find((pill) => pill === document.activeElement);
    preview(focused ? Number(focused.dataset.roundNumber) : undefined);
  });

  track.append(...pills.flatMap((pill, index) => (index ? [links[index - 1], pill] : [pill])));
  section.append(label, track, caption);
  preview(completion.firstOpenRound);
  return section;
}

function linkState(left: HTMLElement, right: HTMLElement): string {
  if (right.dataset.open === 'false') return 'done';
  if (right.dataset.lit === 'true' && (left.dataset.lit === 'true' || left.dataset.open === 'false')) return 'lit';
  return 'open';
}

function roundPill(round: CompletionRound): HTMLButtonElement {
  const open = round.openCount > 0;
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'tmx-cm-round';
  pill.dataset.roundNumber = String(round.roundNumber);
  pill.dataset.open = String(open);
  pill.disabled = !open;
  pill.title = open
    ? t('pages.events.completeMatchUps.matchUps', { count: round.openCount })
    : t('pages.events.completeMatchUps.roundDone', { round: round.label });

  const name = document.createElement('span');
  name.className = 'tmx-cm-round-name';
  name.textContent = round.label;
  const mark = document.createElement('span');
  mark.className = 'tmx-cm-round-mark';
  if (open) mark.textContent = String(round.openCount);
  else mark.innerHTML = '<i class="fa-solid fa-check"></i>';
  pill.append(mark, name);
  return pill;
}

function captionFor(span: CompletionRound[]): string {
  const count = span.reduce((sum, round) => sum + round.openCount, 0);
  const first = span[0].label;
  const last = span.at(-1)?.label ?? first;
  const rounds =
    span.length === 1
      ? t('pages.events.completeMatchUps.completesRound', { round: first })
      : t('pages.events.completeMatchUps.completesRounds', { from: first, to: last });
  return `${rounds} · ${t('pages.events.completeMatchUps.matchUps', { count })}`;
}
