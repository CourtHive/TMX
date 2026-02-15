import { updateReady } from 'services/notifications/statusMessages';
import { rootBlock } from 'components/framework/rootBlock';
import * as serviceWorker from './serviceWorker';
import { setupTMX } from './initialState';

if (globalThis.attachEvent) {
  globalThis.attachEvent('onload', setupTMX);
} else if (globalThis.onload) {
  const curronload = globalThis.onload;
  const newonload = (evt) => {
    // @ts-expect-error globalThis
    curronload(evt);
    setupTMX();
  };
  globalThis.onload = newonload;
} else {
  globalThis.onload = setupTMX;
}

function onUpdate() {
  updateReady();
}

rootBlock();

// NOTE: serviceWorker.unregister() is used for development; serviceWorker.register() is used for production
// pehaps an environment variable could be used to determine which to use
// @ts-expect-error globalThis
serviceWorker.unregister({ onUpdate });
