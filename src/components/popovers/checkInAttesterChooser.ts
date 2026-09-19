/**
 * "Check in as…" — the desk's answer to *who presented this player*.
 *
 * Built as a panel that REPLACES the check-in list inside the same tippy, rather than as a nested
 * popover. A nested tippy inside an interactive one is a well-known source of focus and dismissal
 * bugs, and the operator is answering one question here — there is nothing behind the panel worth
 * keeping visible while they answer it.
 *
 * The common path never reaches this file. A row's own click still checks somebody in with one click
 * and no attester, which is what keeps the desk fast; this is the exception path, reached from the
 * row's secondary affordance. D4d's finding is that friction on the common path teaches pre-emptive
 * check-in and destroys the signal.
 *
 * All decisions live in `services/checkIn/checkInAttribution`; this is the shell.
 */
import {
  ATTESTER_RELATIONSHIPS,
  requiresName,
  type AttesterRelationship,
  type Attester,
} from 'services/checkIn/checkInAttribution';
import { t } from 'i18n';

type ChooserArgs = {
  onChoose: (attester: Attester) => void;
  participantName: string;
  onCancel: () => void;
};

export function buildAttesterChooser({ participantName, onChoose, onCancel }: ChooserArgs): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'tmx-checkin-attester';

  const heading = document.createElement('div');
  heading.className = 'tmx-checkin-heading';
  heading.textContent = t('checkIn.attester.namePrompt', { name: participantName });
  panel.appendChild(heading);

  const list = document.createElement('ul');
  list.style.cssText = 'list-style:none; margin:0; padding:0;';

  for (const relationship of ATTESTER_RELATIONSHIPS) {
    const li = document.createElement('li');
    li.className = 'tmx-checkin-row';
    li.dataset.relationship = relationship;
    li.textContent = t(`checkIn.attester.${relationship.toLowerCase()}`);
    li.onclick = (e) => {
      e.stopPropagation();
      // SELF identifies the subject already, so it commits immediately; everyone else names somebody
      // the record has never heard of and there is nothing to record without that name.
      if (!requiresName(relationship)) return onChoose({ relationship });
      panel.replaceChildren(buildNameStep({ relationship, participantName, onChoose, onCancel }));
    };
    list.appendChild(li);
  }

  panel.appendChild(list);
  panel.appendChild(buildCancel(onCancel));
  return panel;
}

function buildNameStep({
  participantName,
  relationship,
  onChoose,
  onCancel,
}: ChooserArgs & { relationship: AttesterRelationship }): HTMLElement {
  const step = document.createElement('div');

  const heading = document.createElement('div');
  heading.className = 'tmx-checkin-heading';
  heading.textContent = t('checkIn.attester.namePrompt', { name: participantName });
  step.appendChild(heading);

  const name = inputField(t('checkIn.attester.namePlaceholder'));
  const telephone = inputField(t('checkIn.attester.telephonePlaceholder'));
  step.appendChild(name);
  step.appendChild(telephone);

  const confirm = document.createElement('button');
  confirm.className = 'tmx-checkin-attester-confirm';
  confirm.textContent = t('checkIn.attester.confirm');
  // Disabled until a name exists: `buildAttester` returns undefined for a nameless attester, so
  // without this the button would appear to work and store nothing.
  confirm.disabled = true;

  const commit = () => {
    const value = name.value.trim();
    if (!value) return;
    onChoose({ relationship, name: value, telephone: telephone.value.trim() || undefined });
  };

  name.oninput = () => {
    confirm.disabled = !name.value.trim();
  };
  name.onkeydown = (e) => {
    if (e.key === 'Enter') commit();
  };
  confirm.onclick = (e) => {
    e.stopPropagation();
    commit();
  };

  step.appendChild(confirm);
  step.appendChild(buildCancel(onCancel));

  // Focus after the panel is in the document, so the operator can type straight away.
  queueMicrotask(() => name.focus());
  return step;
}

function inputField(placeholder: string): HTMLInputElement {
  const input = document.createElement('input');
  // Styled from `theme.css` tokens rather than `input is-small`. Bulma is not a dependency and TMX
  // defines neither `.input` nor `.button`, so those class names — still present at several older
  // call sites — render completely unstyled.
  input.className = 'tmx-checkin-attester-input';
  input.type = 'text';
  input.placeholder = placeholder;
  return input;
}

function buildCancel(onCancel: () => void): HTMLElement {
  const cancel = document.createElement('div');
  cancel.className = 'tmx-checkin-attester-cancel';
  cancel.textContent = t('checkIn.attester.cancel');
  cancel.onclick = (e) => {
    e.stopPropagation();
    onCancel();
  };
  return cancel;
}
