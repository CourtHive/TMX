import { supportReportingAvailable } from 'services/support/reportAvailability';
import { accountContactRequest } from 'services/support/reportApi';
import { reportScope } from 'services/support/reportContext';
import { supportText } from 'services/support/text';

/** Account-level adapter to the existing HiveID flow. No contact value enters report evidence. */
export function accountContactSettings(scope: string, available = supportReportingAvailable) {
  const section = document.createElement('section');
  section.hidden = true;
  const heading = document.createElement('h3');
  heading.textContent = supportText('accountTitle');
  const description = document.createElement('p');
  description.textContent = supportText('accountExplanation');
  const label = document.createElement('label');
  label.textContent = supportText('accountEmail');
  const input = document.createElement('input');
  input.type = 'email';
  input.autocomplete = 'email';
  input.maxLength = 254;
  label.append(input);
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const actions = document.createElement('div');
  actions.className = 'tmx-support-actions';
  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = supportText('accountSave');
  const resend = document.createElement('button');
  resend.type = 'button';
  resend.textContent = supportText('accountResend');
  actions.append(save, resend);
  section.append(heading, description, label, status, actions);
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.textContent = supportText('settings');
  toggle.ariaExpanded = 'false';
  const confirmation = document.createElement('p');
  confirmation.setAttribute('role', 'status');
  confirmation.hidden = true;
  const close = () => {
    section.hidden = true;
    confirmation.hidden = true;
    toggle.textContent = supportText('settings');
    toggle.ariaExpanded = 'false';
  };
  let busy = false;
  const action = async (kind: 'read' | 'set' | 'resend') => {
    if (busy) return;
    if (!available()) {
      status.textContent = supportText('isolated');
      return;
    }
    if (!scope || reportScope() !== scope) {
      status.textContent = supportText('changed');
      return;
    }
    if (kind === 'set' && (!input.value.trim() || !input.reportValidity())) return;
    busy = true;
    input.disabled = save.disabled = resend.disabled = true;
    try {
      const data = await accountContactRequest(kind, input.value.trim());
      if (!available() || !section.isConnected || section.hidden || reportScope() !== scope) return;
      if (kind === 'read') {
        input.value = data.contactEmail ?? '';
        status.textContent = supportText(data.emailVerifiedAt ? 'verified' : 'pending');
      } else if (data.status === 'no_contact_email') {
        status.textContent = supportText('accountMissing');
      } else {
        close();
        confirmation.hidden = false;
        confirmation.textContent = supportText(data.status === 'already_verified' ? 'verified' : 'accountSaved');
        toggle.focus();
      }
    } catch {
      if (available() && section.isConnected) status.textContent = supportText('accountFailed');
    } finally {
      busy = false;
      input.disabled = save.disabled = resend.disabled = !available();
    }
  };
  save.onclick = () => {
    void action('set');
  };
  resend.onclick = () => {
    void action('resend');
  };
  toggle.onclick = () => {
    if (!section.hidden) {
      close();
      return;
    }
    if (!available()) return;
    confirmation.hidden = true;
    section.hidden = false;
    toggle.ariaExpanded = 'true';
    toggle.textContent = supportText('closeSettings');
    void action('read');
    section.scrollIntoView({ block: 'nearest' });
  };
  return { toggle, section, confirmation, close };
}
