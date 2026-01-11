/**
 * Settings modal for active rating scale and local storage preferences.
 * Allows selection between WTN/UTR and toggling local tournament saves.
 */
import { renderForm } from 'courthive-components';
import { setActiveScale } from 'settings/setActiveScale';
import { saveSettings, loadSettings } from 'services/settings/settingsStorage';
import { openModal } from './baseModal/baseModal';
import { env } from 'settings/env';

import { UTR, WTN } from 'constants/tmxConstants';

export function settingsModal(): void {
  let inputs: any;
  const currentSettings = loadSettings();

  const saveSettingsHandler = () => {
    const activeScale = inputs.wtn.checked ? WTN : UTR;
    env.saveLocal = inputs.saveLocal.checked;
    env.pdfPrinting = inputs.pdfPrinting?.checked || false;

    // Save scoring approach preference
    let scoringApproach: 'dynamicSets' | 'tidyScore' | 'freeScore' | 'dialPad';
    if (inputs.dynamicSets.checked) {
      scoringApproach = 'dynamicSets';
    } else if (inputs.dialPad.checked) {
      scoringApproach = 'dialPad';
    } else if (inputs.tidyScore.checked) {
      scoringApproach = 'tidyScore';
    } else if (inputs.freeScore.checked) {
      scoringApproach = 'freeScore';
    } else {
      // Default fallback
      scoringApproach = 'dynamicSets';
    }
    env.scoringApproach = scoringApproach;

    setActiveScale(activeScale);

    // Persist to localStorage
    saveSettings({
      activeScale,
      scoringApproach,
      saveLocal: env.saveLocal,
      smartComplements: inputs.smartComplements?.checked || false,
      pdfPrinting: env.pdfPrinting,
    });
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
        text: 'Scoring approach',
        class: 'section-title',
      },
      {
        options: [
          { text: 'Dynamic Sets', field: 'dynamicSets', checked: env.scoringApproach === 'dynamicSets' },
          { text: 'Dial Pad', field: 'dialPad', checked: env.scoringApproach === 'dialPad' },
          { text: 'Free Score', field: 'freeScore', checked: env.scoringApproach === 'freeScore' },
          // Tidy Score only visible when dev mode is enabled
          ...((window as any).dev ? [{ text: 'Tidy Score', field: 'tidyScore', checked: env.scoringApproach === 'tidyScore' }] : []),
        ],
        onClick: (x: any) => console.log({ x }),
        field: 'scoringApproach',
        id: 'scoringApproach',
        radio: true,
      },
      {
        label: 'Smart complements (Dynamic Sets only)',
        checked: currentSettings?.smartComplements || false,
        field: 'smartComplements',
        id: 'smartComplements',
        checkbox: true,
      },
      {
        text: 'Storage',
        class: 'section-title',
      },
      {
        label: 'Save local copies',
        checked: env.saveLocal,
        field: 'saveLocal',
        id: 'saveLocal',
        checkbox: true,
      },
      {
        text: 'Beta features',
        class: 'section-title',
      },
      {
        label: 'PDF printing',
        checked: env.pdfPrinting || false,
        field: 'pdfPrinting',
        id: 'pdfPrinting',
        checkbox: true,
      },
    ]));

  openModal({
    title: 'Settings',
    content,
    buttons: [
      { label: 'Cancel', intent: 'none', close: true },
      { label: 'Save', intent: 'is-primary', onClick: saveSettingsHandler, close: true },
    ],
  });
}

export function initSettingsIcon(id: string): void {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', settingsModal);
}
