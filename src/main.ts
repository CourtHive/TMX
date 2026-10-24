import 'i18n/i18n';
import { requestPersistentStorage } from 'services/storage/persistentStorage';
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
requestPersistentStorage();

// Registers when `VITE_SERVICE_WORKER` is set and REMOVES any installed worker
// when it is not — see the header of `serviceWorker.ts` for why "off" has to do
// the second thing. `onUpdate` surfaces the existing update notice rather than
// swapping the app out under a tournament desk mid-match.
serviceWorker.configure({ onUpdate });
