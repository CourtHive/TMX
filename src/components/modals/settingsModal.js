import { renderForm } from 'components/renderers/renderForm';
import { setActiveScale } from 'settings/setActiveScale';
import { openModal } from './baseModal/baseModal';
import { env } from 'settings/env';

// constants
import { UTR, WTN } from 'constants/tmxConstants';

export function settingsModal() {
  let inputs;
  const saveSettings = () => {
    const activeScale = inputs.wtn.checked ? WTN : UTR;
    setActiveScale(activeScale);
  };
  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        options: [
          { text: 'WTN', field: 'wtn', checked: env.activeScale === WTN },
          { text: 'UTR', field: 'utr', checked: env.activeScale === UTR },
        ],
        onClick: (x) => console.log({ x }),
        label: 'Active rating',
        field: 'activeRating',
        id: 'activeRating',
        radio: true,
      },
    ]));

  openModal({
    title: 'Settings',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Save', intent: 'is-primary', onClick: saveSettings, close: true },
    ],
  });
}

export function initSettingsIcon(id) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', settingsModal);
}
