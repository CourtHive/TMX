import { renderForm } from 'components/renderers/renderForm';
import { openModal } from './baseModal/baseModal';
import { env } from 'settings/env';

// constants

export function settingsModal() {
  let inputs;
  const saveSettings = () => {
    env.activeScale = inputs.wtn.checked ? 'wtn' : 'utr';
  };
  const content = (elem) =>
    (inputs = renderForm(elem, [
      {
        options: [
          { text: 'WTN', field: 'wtn', checked: env.activeScale === 'wtn' },
          { text: 'UTR', field: 'utr', checked: env.activeScale === 'utr' },
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
