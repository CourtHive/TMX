import { accountContactRequest } from 'services/support/reportApi';
import { reportScope } from 'services/support/reportContext';
import { supportText } from 'services/support/text';

/** Account-level adapter to the existing HiveID flow. No contact value enters report evidence. */
export function accountContactSettings(scope: string) {
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
  let busy = false;
  const action = async (kind: 'read' | 'set' | 'resend') => {
    if (busy) return;
    if (!scope || reportScope() !== scope) {
      status.textContent = supportText('changed');
      return;
    }
    if (kind === 'set' && (!input.value.trim() || !input.reportValidity())) return;
    busy = true;
    input.disabled = save.disabled = resend.disabled = true;
    try {
      const data = await accountContactRequest(kind, input.value.trim());
      if (!section.isConnected || reportScope() !== scope) return;
      if (kind === 'read') {
        input.value = data.contactEmail ?? '';
        status.textContent = supportText(data.emailVerifiedAt ? 'verified' : 'pending');
      } else
        status.textContent = supportText(
          data.status === 'already_verified'
            ? 'verified'
            : data.status === 'no_contact_email'
              ? 'accountMissing'
              : 'accountSaved',
        );
    } catch {
      if (section.isConnected) status.textContent = supportText('accountFailed');
    } finally {
      busy = false;
      input.disabled = save.disabled = resend.disabled = false;
    }
  };
  save.onclick = () => {
    void action('set');
  };
  resend.onclick = () => {
    void action('resend');
  };
  return {
    section,
    open: () => {
      section.hidden = false;
      void action('read');
      input.focus();
      section.scrollIntoView({ block: 'nearest' });
    },
  };
}
