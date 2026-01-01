/**
 * Settings modal for active rating scale and local storage preferences.
 * Allows selection between WTN/UTR and toggling local tournament saves.
 */
import { renderForm } from 'components/renderers/renderForm';
import { setActiveScale } from 'settings/setActiveScale';
import { openModal } from './baseModal/baseModal';
import { env } from 'settings/env';

import { UTR, WTN } from 'constants/tmxConstants';

export function settingsModal(): void {
  let inputs: any;
  const saveSettings = () => {
    const activeScale = inputs.wtn.checked ? WTN : UTR;
    env.saveLocal = inputs.saveLocal.checked;
    
    // Save scoring approach preference
    const scoringApproach = inputs.dynamicSets.checked ? 'dynamicSets' : 'freeText';
    env.scoringApproach = scoringApproach;
    
    setActiveScale(activeScale);
  };
  const content = (elem: HTMLElement) =>
    (inputs = renderForm(elem, [
      {
        options: [
          { text: 'WTN', field: 'wtn', checked: env.activeScale === WTN },
          { text: 'UTR', field: 'utr', checked: env.activeScale === UTR },
        ],
        onClick: (x: any) => console.log({ x }),
        label: 'Active rating',
        field: 'activeRating',
        id: 'activeRating',
        radio: true,
      },
      {
        options: [
          { text: 'Dynamic Sets', field: 'dynamicSets', checked: env.scoringApproach === 'dynamicSets' },
          { text: 'Free Text', field: 'freeText', checked: env.scoringApproach === 'freeText' },
        ],
        onClick: (x: any) => console.log({ x }),
        label: 'Scoring approach',
        field: 'scoringApproach',
        id: 'scoringApproach',
        radio: true,
      },
      {
        label: 'Save local copies',
        checked: env.saveLocal,
        field: 'saveLocal',
        id: 'saveLocal',
        checkbox: true,
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

export function initSettingsIcon(id: string): void {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', settingsModal);
}
