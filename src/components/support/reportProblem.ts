import { reportScope, recentSupportDiagnostics, recordSupportDiagnostic } from 'services/support/reportContext';
import { submitSupportReport, fetchSupportReceipt } from 'services/support/reportApi';
import { reportRoute, safeValidation } from 'services/support/diagnostics';
import { accountContactSettings } from './accountContactSettings';
import { tournamentEngine } from 'services/factory/engine';
import { supportText } from 'services/support/text';
import { randomId } from 'functions/randomId';
import { version } from 'config/version';

import { SUPPORT_DIALOG, SUPPORT_TITLE } from 'constants/tmxConstants';
import './reportProblem.css';

export function openProblemReport(code?: string): void {
  if (document.getElementById(SUPPORT_DIALOG)) return;
  if (code) recordSupportDiagnostic(code);
  const scope = reportScope();
  let record: any;
  try {
    record = structuredClone(tournamentEngine.getTournament()?.tournamentRecord);
  } catch {
    record = undefined;
  }
  const tournamentId = record?.tournamentId;
  const tournamentName = record?.tournamentName;
  const evidence = {
    route: reportRoute(location.hash),
    online: navigator.onLine,
    version,
    diagnostics: recentSupportDiagnostics(),
    validation: safeValidation(),
  };
  // The transient frozen copy stays in the browser and is released as soon as validation completes.
  const validation = record
    ? import('services/validation/validateTournamentRecord')
        .then(({ validateTournamentRecord }) => validateTournamentRecord({ tournamentRecord: record }))
        .then((summary) => {
          evidence.validation = safeValidation(summary);
        })
        .catch(() => {
          evidence.validation = safeValidation();
        })
        .finally(() => {
          record = undefined;
        })
    : Promise.resolve();
  const dialog = document.createElement('dialog');
  dialog.id = SUPPORT_DIALOG;
  dialog.className = 'tmx-support-form';
  dialog.setAttribute('aria-labelledby', SUPPORT_TITLE);
  const title = document.createElement('h2');
  title.id = SUPPORT_TITLE;
  title.textContent = supportText('title');
  const explanation = document.createElement('p');
  explanation.textContent = supportText('explanation');
  const promise = document.createElement('p');
  promise.textContent = supportText('promise');
  const screen = document.createElement('p');
  screen.textContent = [tournamentName, evidence.route].filter(Boolean).join(' · ');
  dialog.append(title, explanation, promise, screen);
  const form = document.createElement('form');
  const field = (key: 'description' | 'expected' | 'steps') => {
    const label = document.createElement('label');
    const input = document.createElement('textarea');
    label.textContent = supportText(key);
    label.append(input);
    input.name = key;
    input.maxLength = 8192;
    input.required = key === 'description';
    form.append(label);
    return input;
  };
  const description = field('description');
  const expected = field('expected');
  const steps = field('steps');
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div');
  actions.className = 'tmx-support-actions';
  const send = document.createElement('button');
  send.type = 'submit';
  send.textContent = supportText('send');
  const settings = document.createElement('button');
  settings.type = 'button';
  settings.textContent = supportText('settings');
  const account = accountContactSettings(scope);
  settings.onclick = () => account.open();
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = supportText('close');
  close.onclick = () => dialog.close();
  actions.append(send, settings, close);
  form.append(status, actions);
  dialog.append(form, account.section);
  document.body.append(dialog);
  const opener = document.activeElement as HTMLElement | null;
  dialog.addEventListener(
    'close',
    () => {
      record = undefined;
      dialog.remove();
      opener?.focus();
    },
    { once: true },
  );
  dialog.showModal();
  description.focus();
  const submissionKey = randomId();
  let frozenPayload: any;
  let receipt: any;
  let active = false;
  const paintReceipt = (value: any) => {
    const expiry = new Date(value.expiresAt).toLocaleDateString();
    status.textContent = `${supportText('accepted', { reference: value.reference, expiry })} ${supportText(value.contact === 'verified' ? 'verified' : 'pending')} ${supportText('status', { state: supportText(value.resolutionEmail === 'accepted' ? 'emailAccepted' : value.resolutionEmail === 'awaiting_contact' ? 'emailAwaiting' : value.resolutionEmail === 'failed' ? 'emailFailed' : value.resolutionEmail === 'none' ? 'emailNone' : 'emailPending'), delivery: supportText(value.delivery === 'unknown' ? 'deliveryUnknown' : 'deliveryNotSent') })}`;
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (active) return;
    if (!scope) {
      status.textContent = supportText('login');
      return;
    }
    if (scope !== reportScope()) {
      status.textContent = supportText('changed');
      return;
    }
    active = true;
    send.disabled = true;
    try {
      if (receipt) {
        const current = await fetchSupportReceipt(receipt.reference);
        if (scope === reportScope() && dialog.isConnected) paintReceipt(current);
        return;
      }
      if (!frozenPayload) {
        const text = [
          description.value.trim(),
          expected.value.trim() && `Expected: ${expected.value.trim()}`,
          steps.value.trim() && `Steps: ${steps.value.trim()}`,
        ]
          .filter(Boolean)
          .join('\n\n');
        if (new TextEncoder().encode(text).length > 8192) {
          status.textContent = supportText('tooLong');
          return;
        }
        // Validation has a UI budget; unavailable is explicit, never a reason to block a bug report.
        await Promise.race([validation, new Promise((resolve) => setTimeout(resolve, 1000))]);
        if (scope !== reportScope() || !dialog.isConnected) {
          status.textContent = supportText('changed');
          return;
        }
        frozenPayload = structuredClone({
          submissionKey,
          description: text,
          evidence,
          ...(tournamentId && { tournamentId }),
        });
        description.disabled = expected.disabled = steps.disabled = true;
      }
      const result = await submitSupportReport(frozenPayload);
      if (scope !== reportScope() || !dialog.isConnected) return;
      receipt = result;
      paintReceipt(result);
      send.textContent = supportText('receipt');
    } catch {
      if (dialog.isConnected) status.textContent = supportText('failed');
    } finally {
      active = false;
      send.disabled = false;
    }
  };
}
