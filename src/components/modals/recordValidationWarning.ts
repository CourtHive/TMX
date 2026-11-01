/**
 * Non-blocking warning for an imported tournament record that has schema errors or
 * integrity findings. A clean record shows nothing. The toast offers a review modal with
 * the first few findings, a "show all" toggle and a copy of the full list.
 */
import { formatFinding, type RecordValidationSummary } from 'services/validation/recordValidationSummary';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

function findingItem(finding: RecordValidationSummary['findings'][number]): HTMLLIElement {
  const item = document.createElement('li');
  item.style.cssText = 'margin-bottom: .4em; overflow-wrap: anywhere;';

  const path = document.createElement('code');
  path.style.cssText = 'color: var(--tmx-text-secondary); background: var(--tmx-bg-secondary); padding: 0 .25em;';
  path.textContent = finding.issueType ? `${finding.issueType} ${finding.path}` : finding.path;

  const message = document.createElement('span');
  message.style.cssText = 'color: var(--tmx-text-primary); margin-left: .5em;';
  message.textContent = finding.message;

  item.append(path, message);
  return item;
}

function renderList(list: HTMLOListElement, findings: RecordValidationSummary['findings']): void {
  list.replaceChildren(...findings.map(findingItem));
}

function copyFindings(summary: RecordValidationSummary): void {
  const text = summary.text || summary.findings.map(formatFinding).join('\n');
  // `clipboard` is absent over plain HTTP, so the failure is reported rather than swallowed.
  const clipboard = globalThis.navigator?.clipboard;
  if (!clipboard) {
    tmxToast({ message: t('modals.recordValidation.copyFailed'), intent: 'is-danger' });
    return;
  }
  clipboard
    .writeText(text)
    .then(() => tmxToast({ message: t('modals.recordValidation.copied', { count: summary.count }) }))
    .catch(() => tmxToast({ message: t('modals.recordValidation.copyFailed'), intent: 'is-danger' }));
}

export function openRecordValidationModal(summary: RecordValidationSummary): void {
  const content = document.createElement('div');
  content.style.cssText = 'color: var(--tmx-text-primary);';

  const counts = document.createElement('p');
  counts.style.cssText = 'margin-bottom: .75em;';
  counts.textContent = t('modals.recordValidation.counts', {
    schema: summary.schemaErrorCount,
    integrity: summary.inconsistencyCount,
  });
  content.appendChild(counts);

  if (summary.schemaUnavailable) {
    const unavailable = document.createElement('p');
    unavailable.style.cssText = 'margin-bottom: .75em; color: var(--tmx-text-muted);';
    unavailable.textContent = t('modals.recordValidation.schemaUnavailable');
    content.appendChild(unavailable);
  }

  const list = document.createElement('ol');
  list.style.cssText = 'padding-left: 1.5em; max-height: 50vh; overflow-y: auto; font-size: .9em;';
  renderList(list, summary.preview);
  content.appendChild(list);

  if (summary.count > summary.preview.length) {
    let expanded = false;
    const toggle = document.createElement('button');
    toggle.className = 'button';
    toggle.style.cssText = 'margin-top: .5em;';
    toggle.textContent = t('modals.recordValidation.showAll', { count: summary.count });
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      renderList(list, expanded ? summary.findings : summary.preview);
      toggle.textContent = expanded
        ? t('modals.recordValidation.showFewer')
        : t('modals.recordValidation.showAll', { count: summary.count });
    });
    content.appendChild(toggle);
  }

  openModal({
    title: t('modals.recordValidation.title'),
    content,
    buttons: [
      {
        label: t('modals.recordValidation.copyAll'),
        intent: 'is-info',
        onClick: () => copyFindings(summary),
        close: false,
      },
      { label: t('common.close'), close: true },
    ],
  });
}

export function warnOnRecordValidation(summary: RecordValidationSummary | undefined): void {
  if (!summary?.count) return;
  tmxToast({
    message: t('modals.recordValidation.toast', { count: summary.count }),
    intent: 'is-warning',
    pauseOnHover: true,
    duration: 10000,
    action: {
      text: t('modals.recordValidation.review'),
      onClick: () => openRecordValidationModal(summary),
    },
  });
}
