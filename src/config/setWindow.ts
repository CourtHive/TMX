import { updateReady, popupsBlocked } from 'services/notifications/statusMessages';
import { isDev } from 'functions/isDev';

export function setWindow() {
  // to disable context menu on the page
  document.oncontextmenu = () => false;
  window.addEventListener(
    'contextmenu',
    (e) => {
      e.preventDefault();
    },
    false
  );
  // @ts-expect-error window
  window.packageEntry = { updateReady };
  /**
  window.onerror = (msg, url, lineNo, columnNo, error) => {
    console.log({ msg, error });
    if (!msg.includes('ResizeObserver')) {
      const errorMessage = isObject(msg) ? JSON.stringify(msg) : msg;
      const payload = { error, stack: { lineNo, columnNo, error: errorMessage } };
      context.ee.emit('emitTmx', { data: { action: CLIENT_ERROR, payload } });

      const message = {
        notice: `Error Detected: Development has been notified!`,
        title: 'warn'
      };
      context.ee.emit('addMessage', message);
    }
  };
  */
  window.onunhandledrejection = (windowEvent) => {
    if (isDev()) return;
    windowEvent.preventDefault();
    const reason = windowEvent.reason;
    const message = reason && (reason.stack || reason);
    if (message && message.indexOf('blocked') > 0) {
      popupsBlocked();
      console.warn('popup blocked');
    } else {
      console.warn('Unhandled rejection:', reason && (reason.stack || reason));
    }
  };
}
