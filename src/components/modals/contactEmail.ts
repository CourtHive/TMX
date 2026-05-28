/**
 * Recovery-email management modal.
 *
 * Lets the logged-in user set or change `users.contact_email` and trigger
 * a verification email. Distinct from `users.email` which is the LOGIN
 * identifier (often a non-email string for legacy accounts).
 *
 * Live state comes from GET /auth/me on open so the user sees the
 * verified-at timestamp even if their cached JWT is stale.
 */
import { setContactEmail, resendVerification } from 'services/authentication/authApi';
import { fetchUserContext } from 'services/authentication/getUserContext';
import { validators, renderForm } from 'courthive-components';
import { tmxToast } from 'services/notifications/tmxToast';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

const INTENT_SUCCESS = 'is-success';

type ContactEmailState = {
  contactEmail?: string | null;
  emailVerifiedAt?: string | null;
};

export function contactEmailModal(onClose?: () => void): void {
  let inputs: any;
  let modalHandle: any;
  let liveState: ContactEmailState = {};

  const renderStatus = (statusEl: HTMLElement, state: ContactEmailState) => {
    statusEl.innerHTML = '';
    const text = document.createElement('div');
    text.style.cssText = 'font-size: 0.9rem; margin-bottom: 12px;';
    if (!state.contactEmail) {
      text.textContent = t('modals.contactEmail.statusNotSet');
      text.style.color = 'var(--tmx-status-warning)';
    } else if (state.emailVerifiedAt) {
      text.textContent = t('modals.contactEmail.statusVerified', { email: state.contactEmail });
      text.style.color = 'var(--tmx-status-success)';
    } else {
      text.textContent = t('modals.contactEmail.statusPending', { email: state.contactEmail });
      text.style.color = 'var(--tmx-status-warning)';
    }
    statusEl.appendChild(text);
  };

  const enableSubmit = ({ inputs }: any) => {
    const value = inputs?.contactEmail?.value ?? '';
    const isValid = validators.emailValidator(value);
    modalHandle?.setButtonState('contactEmailSave', { disabled: !isValid });
    // Resend button is enabled only when there's a pending (unverified)
    // address on the LIVE state — typing a new address doesn't enable
    // resend because that would resend the OLD pending address.
    modalHandle?.setButtonState('contactEmailResend', {
      disabled: !liveState.contactEmail || Boolean(liveState.emailVerifiedAt),
    });
  };

  const relationships = [{ onInput: enableSubmit, control: 'contactEmail' }];

  const statusContainer = document.createElement('div');
  statusContainer.id = 'contactEmailStatus';

  const content = (elem: HTMLElement) => {
    elem.appendChild(statusContainer);
    renderStatus(statusContainer, liveState);

    inputs = renderForm(
      elem,
      [
        {
          iconLeft: 'fa-regular fa-envelope',
          placeholder: 'you@example.com',
          validator: validators.emailValidator,
          autocomplete: 'email',
          label: t('modals.contactEmail.label'),
          field: 'contactEmail',
          id: 'contactEmailInput',
          value: liveState.contactEmail ?? '',
        },
      ],
      relationships,
    );

    // Refresh live state in the background from GET /auth/me. Failures are
    // non-fatal — the user can still try to save the form.
    fetchUserContext().then(
      (ctx) => {
        liveState = { contactEmail: ctx?.contactEmail, emailVerifiedAt: ctx?.emailVerifiedAt };
        renderStatus(statusContainer, liveState);
        if (inputs?.contactEmail && !inputs.contactEmail.value) {
          inputs.contactEmail.value = liveState.contactEmail ?? '';
        }
        enableSubmit({ inputs });
      },
      () => {
        /* live refresh failed — keep showing JWT-derived state */
      },
    );
  };

  const onSave = () => {
    const value = (inputs?.contactEmail?.value ?? '').trim();
    if (!value) return;
    setContactEmail(value).then(
      (res: any) => {
        if (res?.data?.error) {
          tmxToast({ message: res.data.error, intent: 'is-danger' });
          return;
        }
        tmxToast({
          message: t('modals.contactEmail.savedPending', { email: value }),
          intent: INTENT_SUCCESS,
        });
      },
      (err: any) => {
        const message = err?.response?.data?.message || err?.message || t('modals.contactEmail.failed');
        tmxToast({ message, intent: 'is-danger' });
      },
    );
  };

  const onResend = () => {
    resendVerification().then(
      (res: any) => {
        const status = res?.data?.status;
        if (status === 'already_verified') {
          tmxToast({ message: t('modals.contactEmail.alreadyVerified'), intent: INTENT_SUCCESS });
        } else if (status === 'no_contact_email') {
          tmxToast({ message: t('modals.contactEmail.statusNotSet'), intent: 'is-warning' });
        } else {
          tmxToast({ message: t('modals.contactEmail.resent'), intent: INTENT_SUCCESS });
        }
      },
      () => {
        tmxToast({ message: t('modals.contactEmail.failed'), intent: 'is-danger' });
      },
    );
  };

  modalHandle = openModal({
    title: t('modals.contactEmail.title'),
    content,
    onClose,
    buttons: [
      { label: t('modals.contactEmail.resend'), id: 'contactEmailResend', disabled: true, onClick: onResend, intent: 'none' },
      { label: t('common.cancel'), intent: 'none', close: true },
      { label: t('modals.contactEmail.save'), id: 'contactEmailSave', disabled: true, onClick: onSave, close: true, intent: 'is-primary' },
    ],
  });
}
