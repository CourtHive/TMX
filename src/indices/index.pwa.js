import { updateReady } from 'services/notifications/statusMessages';
import { rootBlock } from 'components/framework/rootBlock';
import * as serviceWorker from './serviceWorker';
import { setupTMX } from './initialState';

if (window.attachEvent) {
  window.attachEvent('onload', setupTMX);
} else {
  if (window.onload) {
    const curronload = window.onload;
    const newonload = (evt) => {
      curronload(evt);
      setupTMX();
    };
    window.onload = newonload;
  } else {
    window.onload = setupTMX;
  }
}

function onUpdate() {
  updateReady();
}

const root = document.getElementById('root');
root.appendChild(rootBlock());

serviceWorker.register({ onUpdate });
