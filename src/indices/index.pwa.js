import { updateReady } from 'services/notifications/statusMessages';
import * as serviceWorker from './serviceWorker';
import { setupTMX } from './initialState';
import { render } from 'react-dom';
import React from 'react';

import TMX from './Pages/TMX.jsx';

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

render(<TMX />, document.getElementById('root'));

serviceWorker.register({ onUpdate });
