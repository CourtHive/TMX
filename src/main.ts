import { updateReady } from 'services/notifications/statusMessages';
import { rootBlock } from 'components/framework/rootBlock';
import * as serviceWorker from './serviceWorker';
import { setupTMX } from './initialState';

// @ts-expect-error window
if (window.attachEvent) {
  // @ts-expect-error window
  window.attachEvent('onload', setupTMX);
} else if (window.onload) {
  const curronload = window.onload;
  const newonload = (evt) => {
    // @ts-expect-error window
    curronload(evt);
    setupTMX();
  };
  window.onload = newonload;
} else {
  window.onload = setupTMX;
}

function onUpdate() {
  updateReady();
}

rootBlock();

// NOTE: serviceWorker.unregister() is used for development; serviceWorker.register() is used for production
// pehaps an environment variable could be used to determine which to use
// @ts-expect-error window
serviceWorker.unregister({ onUpdate });
