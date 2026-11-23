import { reportScope, recentSupportDiagnostics, recordSupportDiagnostic } from 'services/support/reportContext';
import {
  submitSupportReport,
  fetchSupportReceipt,
  fetchSupportCapability,
  type SupportCapability,
} from 'services/support/reportApi';
import { supportReportingAvailable } from 'services/support/reportAvailability';
import { reportRoute, safeValidation } from 'services/support/diagnostics';
import { onNetworkIsolation } from 'services/network/networkPolicy';
import { accountContactSettings } from './accountContactSettings';
import { tournamentEngine } from 'services/factory/engine';
import { refusalCodeText, refusalText } from 'services/support/refusal';
import { supportText } from 'services/support/text';
import { randomId } from 'functions/randomId';
import { version } from 'config/version';

import { SUPPORT_DIALOG, SUPPORT_TITLE } from 'constants/tmxConstants';
import './reportProblem.css';

export function openProblemReport(code?: string): void {
  if (!supportReportingAvailable() || document.getElementById(SUPPORT_DIALOG)) return;
  if (code) recordSupportDiagnostic(code);
  const scope = reportScope();
  let isolatedSinceOpen = false;
  const [expectedReporter, selectedProvider, impersonatedProvider] = scope ? JSON.parse(scope) : [];
  // Asked of CFS, which decides where feedback goes: the selected provider, the impersonated one for a super-admin,
  // or the platform when none is selected (CA, 2026-11-22). Only a super-admin's impersonation changes CFS's answer.
  const requestedProvider = selectedProvider || impersonatedProvider || undefined;
  let capability: SupportCapability | undefined;
  let kind: 'bug' | 'suggestion' = 'bug';
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
  // A problem report or a suggestion. The title, texts and fields follow the choice; a suggestion drops the
  // reproduction fields and the error diagnostics, and is acknowledged rather than answered by email.
  const kinds = document.createElement('fieldset');
  kinds.className = 'tmx-support-kind';
  const legend = document.createElement('legend');
  legend.textContent = supportText('kind');
  kinds.append(legend);
  const kindChoice = (value: 'bug' | 'suggestion', key: 'kindBug' | 'kindSuggestion') => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'kind';
    radio.value = value;
    radio.checked = value === kind;
    radio.onchange = () => {
      if (radio.checked) applyKind(value);
    };
    label.append(radio, document.createTextNode(supportText(key)));
    kinds.append(label);
    return radio;
  };
  const kindRadios = [kindChoice('bug', 'kindBug'), kindChoice('suggestion', 'kindSuggestion')];
  form.append(kinds);
  const field = (key: 'description' | 'expected' | 'steps') => {
    const label = document.createElement('label');
    const input = document.createElement('textarea');
    // The caption is its own node so a kind change can re-label the field without removing the textarea.
    const caption = document.createElement('span');
    caption.textContent = supportText(key);
    label.append(caption, input);
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
  const account = accountContactSettings(scope, () => !isolatedSinceOpen && supportReportingAvailable());
  const settings = account.toggle;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'tmx-support-close';
  close.textContent = supportText('close');
  close.onclick = () => dialog.close();
  actions.append(send, settings, close);
  form.append(status, actions);
  dialog.append(form, account.section, account.confirmation);
  const applyKind = (value: 'bug' | 'suggestion') => {
    kind = value;
    const suggestion = value === 'suggestion';
    title.textContent = supportText(suggestion ? 'suggestionTitle' : 'title');
    explanation.textContent = supportText(suggestion ? 'suggestionExplanation' : 'explanation');
    promise.textContent = supportText(suggestion ? 'suggestionPromise' : 'promise');
    (description.previousElementSibling as HTMLElement).textContent = supportText(
      suggestion ? 'suggestionDescription' : 'description',
    );
    expected.parentElement!.hidden = steps.parentElement!.hidden = suggestion;
    if (suggestion) account.close();
    settings.hidden = suggestion; // the contact address matters only for a resolution email
    send.textContent = supportText(suggestion ? 'sendSuggestion' : 'send');
  };
  document.body.append(dialog);
  const opener = document.activeElement as HTMLElement | null;
  const stopWatching = onNetworkIsolation(() => {
    isolatedSinceOpen = true;
    send.disabled = settings.disabled = true;
    account.section.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button').forEach((element) => {
      element.disabled = true;
    });
    status.textContent = supportText('isolated');
    record = undefined;
  });
  dialog.addEventListener(
    'close',
    () => {
      stopWatching();
      record = undefined;
      dialog.remove();
      opener?.focus();
    },
    { once: true },
  );
  dialog.showModal();
  description.focus();
  // Ask CFS before anything can be sent, so an unavailable session reads why at once instead of after typing.
  // A CFS older than #1309 has no capability route (404): it takes the selected provider, as before.
  const checkCapability = async (): Promise<SupportCapability | undefined> => {
    if (capability?.available) return capability;
    try {
      capability = await fetchSupportCapability(requestedProvider);
    } catch (error: any) {
      if (error?.response?.status !== 404) return undefined;
      // That CFS knows no feedback kinds either: it accepts problem reports only.
      capability = { available: true, scope: 'provider', providerId: requestedProvider };
      kindRadios[1].disabled = true;
      if (kind === 'suggestion') {
        kindRadios[0].checked = true;
        applyKind('bug');
      }
    }
    return capability;
  };
  if (scope) {
    send.disabled = true;
    status.textContent = supportText('checking');
    void checkCapability().then((answer) => {
      if (!dialog.isConnected || isolatedSinceOpen || active) return;
      send.disabled = !answer?.available;
      status.textContent = !answer
        ? supportText('unavailable')
        : answer.available
          ? ''
          : (refusalCodeText(answer.reason) ?? supportText('unavailable'));
      if (!answer) send.disabled = false; // a failed check can be retried by sending
    });
  }
  const submissionKey = randomId();
  let frozenPayload: any;
  let receipt: any;
  let active = false;
  const paintReceipt = (value: any) => {
    const expiry = new Date(value.expiresAt).toLocaleDateString();
    if (value.kind === 'suggestion') {
      status.textContent = supportText('acknowledged', { reference: value.reference, expiry });
      return;
    }
    status.textContent = `${supportText('accepted', { reference: value.reference, expiry })} ${supportText(value.contact === 'verified' ? 'verified' : 'pending')} ${supportText('status', { state: supportText(value.resolutionEmail === 'accepted' ? 'emailAccepted' : value.resolutionEmail === 'awaiting_contact' ? 'emailAwaiting' : value.resolutionEmail === 'failed' ? 'emailFailed' : value.resolutionEmail === 'none' ? 'emailNone' : 'emailPending'), delivery: supportText(value.delivery === 'unknown' ? 'deliveryUnknown' : 'deliveryNotSent') })}`;
  };
  /** Decide the target and freeze the payload once, so a retry resends the identical report. Returns why not. */
  const freeze = async (): Promise<string | undefined> => {
    const target = await checkCapability();
    if (!target?.available)
      return target ? (refusalCodeText(target.reason) ?? supportText('failed')) : supportText('unavailable');
    const suggestion = kind === 'suggestion';
    const text = [
      description.value.trim(),
      !suggestion && expected.value.trim() && `Expected: ${expected.value.trim()}`,
      !suggestion && steps.value.trim() && `Steps: ${steps.value.trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n');
    if (new TextEncoder().encode(text).length > 8192) return supportText('tooLong');
    // Validation has a UI budget; unavailable is explicit, never a reason to block a bug report.
    if (!suggestion) await Promise.race([validation, new Promise((resolve) => setTimeout(resolve, 1000))]);
    if (isolatedSinceOpen || !supportReportingAvailable() || scope !== reportScope() || !dialog.isConnected)
      return supportText(isolatedSinceOpen || !supportReportingAvailable() ? 'isolated' : 'changed');
    const providerScoped = target.scope === 'provider' && !!target.providerId;
    frozenPayload = structuredClone({
      submissionKey,
      expectedReporter,
      // CFS defaults to a problem report, and a CFS older than #1309 refuses any unknown field.
      ...(suggestion && { kind }),
      // Platform feedback names neither a provider nor a tournament: a tournament belongs to a provider.
      ...(providerScoped && { expectedProvider: target.providerId }),
      description: text,
      evidence: suggestion ? { route: evidence.route, online: evidence.online, version: evidence.version } : evidence,
      ...(providerScoped && tournamentId && { tournamentId }),
    });
    description.disabled = expected.disabled = steps.disabled = true;
    kindRadios.forEach((radio) => (radio.disabled = true));
    return undefined;
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (active) return;
    if (isolatedSinceOpen || !supportReportingAvailable()) {
      status.textContent = supportText('isolated');
      return;
    }
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
        if (!isolatedSinceOpen && supportReportingAvailable() && scope === reportScope() && dialog.isConnected)
          paintReceipt(current);
        return;
      }
      if (!frozenPayload) {
        const refused = await freeze();
        if (refused) {
          status.textContent = refused;
          return;
        }
      }
      const result = await submitSupportReport(frozenPayload);
      if (isolatedSinceOpen || !supportReportingAvailable() || scope !== reportScope() || !dialog.isConnected) return;
      receipt = result;
      paintReceipt(result);
      send.textContent = supportText('receipt');
    } catch (error) {
      if (!isolatedSinceOpen && dialog.isConnected) status.textContent = refusalText(error);
    } finally {
      active = false;
      send.disabled = isolatedSinceOpen || !supportReportingAvailable();
    }
  };
}
