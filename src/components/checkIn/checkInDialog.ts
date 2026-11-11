import { openModal } from 'components/modals/baseModal/baseModal';
import { createFocusTrap } from 'focus-trap';
import { t } from 'i18n';

/** Local accessibility/lifecycle ownership; does not change defaults for unrelated cModal consumers. */
export function openCheckInDialog({
  content,
  title,
  onClose,
  onConfirm,
}: {
  content: HTMLElement;
  title: string;
  onClose?: () => void;
  onConfirm?: () => void;
}) {
  const trigger = document.activeElement as HTMLElement | null;
  let trap: ReturnType<typeof createFocusTrap> | undefined;
  let chosen = false;
  let noticesObserver: MutationObserver | undefined;
  const finish = () => {
    noticesObserver?.disconnect();
    trap?.deactivate({ returnFocus: false });
    onClose?.();
    if (trigger?.isConnected) trigger.focus();
  };
  const handle = openModal({
    title,
    content,
    config: { maxWidth: 560, padding: '.5', content: { padding: '1' }, autoFocus: false, clickAway: false },
    buttons: [
      { label: t(onConfirm ? 'common.cancel' : 'common.close'), close: true },
      ...(onConfirm
        ? [
            {
              label: t('checkIn.callAnyway'),
              intent: 'is-warning',
              close: true,
              onClick: () => {
                if (chosen) return;
                chosen = true;
                // Let the owned modal close before the continuation opens another one.
                queueMicrotask(onConfirm);
              },
            },
          ]
        : []),
    ],
    onClose: finish,
  });
  const dialog = content.closest<HTMLElement>('[role="dialog"]');
  if (dialog) {
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', title);
    dialog.tabIndex = -1;
    // Mutation authorization can ask a question in a toast (past dates, impersonation).
    // Keep those controls inside this dialog's focus trap rather than making them unreachable.
    const notices = document.createElement('div');
    notices.setAttribute('role', 'status');
    content.after(notices);
    const collectNotices = () => {
      for (const notice of document.querySelectorAll<HTMLElement>('.notification')) {
        if (!dialog.contains(notice)) notices.appendChild(notice);
      }
    };
    noticesObserver = new MutationObserver(collectNotices);
    noticesObserver.observe(document.body, { childList: true, subtree: true });
    dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handle.close();
      }
    });
    trap = createFocusTrap(dialog, {
      initialFocus: dialog,
      fallbackFocus: dialog,
      escapeDeactivates: false,
      delayInitialFocus: false,
    });
    trap.activate();
  }
  return handle;
}
