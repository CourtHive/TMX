/**
 * Settings modal for active rating scale and local storage preferences.
 * Allows selection between WTN/UTR and toggling local tournament saves.
 */
import { saveSettings, loadSettings } from 'services/settings/settingsStorage';
import { renderForm, validators } from 'courthive-components';
import { setActiveScale } from 'settings/setActiveScale';
import { openModal } from './baseModal/baseModal';
import { env } from 'settings/env';
import { i18next, t } from 'i18n';

import { UTR, WTN } from 'constants/tmxConstants';

export function settingsModal(): void {
  let inputs: any;
  const currentSettings = loadSettings();

  const saveSettingsHandler = () => {
    const activeScale = inputs.wtn.checked ? WTN : UTR;
    env.saveLocal = inputs.saveLocal.checked;
    env.pdfPrinting = inputs.pdfPrinting?.checked || false;

    // Save scoring approach preference
    let scoringApproach: 'dynamicSets' | 'freeScore' | 'dialPad';
    if (inputs.dynamicSets.checked) {
      scoringApproach = 'dynamicSets';
    } else if (inputs.dialPad.checked) {
      scoringApproach = 'dialPad';
    } else if (inputs.freeScore.checked) {
      scoringApproach = 'freeScore';
    } else {
      // Default fallback
      scoringApproach = 'dynamicSets';
    }
    env.scoringApproach = scoringApproach;

    // Save minimum schedule grid rows
    const minCourtGridRowsValue = inputs.minCourtGridRows.value;
    if (validators.numericRange(1, 100)(minCourtGridRowsValue)) {
      env.schedule.minCourtGridRows = Number.parseInt(minCourtGridRowsValue, 10);
    }

    // Save participant assignment settings
    env.persistInputFields = inputs.persistInputFields?.checked ?? true;

    // Detect language change
    const language = inputs.language.value;
    const languageChanged = language !== i18next.language;

    setActiveScale(activeScale);

    // Persist to localStorage
    saveSettings({
      activeScale,
      scoringApproach,
      saveLocal: env.saveLocal,
      smartComplements: inputs.smartComplements?.checked || false,
      pdfPrinting: env.pdfPrinting,
      minCourtGridRows: env.schedule.minCourtGridRows,
      persistInputFields: env.persistInputFields,
      language,
    });

    // Reload page after saving if language changed so all UI text updates
    if (languageChanged) {
      window.location.reload();
    }
  };
  const content = (elem: HTMLElement) =>
    (inputs = renderForm(elem, [
      {
        text: t('modals.settings.language'),
        class: 'section-title',
      },
      {
        options: [
          { value: 'en', label: 'English', selected: i18next.language === 'en' },
          { value: 'fr', label: 'Français', selected: i18next.language === 'fr' },
        ],
        field: 'language',
        id: 'language',
      },
      {
        text: t('modals.settings.activeRating'),
        class: 'section-title',
      },
      {
        options: [
          { text: 'WTN', field: 'wtn', checked: env.activeScale === WTN },
          { text: 'UTR', field: 'utr', checked: env.activeScale === UTR },
        ],
        onClick: (x: any) => console.log({ x }),
        field: 'activeRating',
        id: 'activeRating',
        radio: true,
      },
      {
        text: t('modals.settings.scoringApproach'),
        class: 'section-title',
      },
      {
        options: [
          { text: t('modals.settings.dynamicSets'), field: 'dynamicSets', checked: env.scoringApproach === 'dynamicSets' },
          { text: t('modals.settings.dialPad'), field: 'dialPad', checked: env.scoringApproach === 'dialPad' },
          { text: t('modals.settings.freeScore'), field: 'freeScore', checked: env.scoringApproach === 'freeScore' },
        ],
        onClick: (x: any) => console.log({ x }),
        field: 'scoringApproach',
        id: 'scoringApproach',
        radio: true,
      },
      {
        label: t('modals.settings.smartComplements'),
        checked: currentSettings?.smartComplements || false,
        field: 'smartComplements',
        id: 'smartComplements',
        checkbox: true,
      },
      {
        text: t('modals.settings.storage'),
        class: 'section-title',
      },
      {
        label: t('modals.settings.saveLocalCopies'),
        checked: env.saveLocal,
        field: 'saveLocal',
        id: 'saveLocal',
        checkbox: true,
      },
      {
        text: t('modals.settings.scheduling'),
        class: 'section-title',
      },
      {
        label: t('modals.settings.minScheduleGridRows'),
        value: currentSettings?.minCourtGridRows ?? env.schedule.minCourtGridRows,
        field: 'minCourtGridRows',
        id: 'minCourtGridRows',
        validator: validators.numericRange(1, 100),
        error: t('modals.settings.minScheduleGridRowsError'),
        selectOnFocus: true,
        onInput: () => {
          const saveButton = document.getElementById('saveSettingsButton') as HTMLButtonElement;
          const value = inputs.minCourtGridRows.value;
          const valid = validators.numericRange(1, 100)(value);
          if (saveButton) saveButton.disabled = !valid;
        },
      },
      {
        text: t('modals.settings.participantAssignment'),
        class: 'section-title',
      },
      {
        label: t('modals.settings.persistInputFields'),
        checked: currentSettings?.persistInputFields ?? true, // Default true
        field: 'persistInputFields',
        id: 'persistInputFields',
        checkbox: true,
      },
      {
        text: t('modals.settings.betaFeatures'),
        class: 'section-title',
      },
      {
        label: t('modals.settings.pdfPrinting'),
        checked: env.pdfPrinting || false,
        field: 'pdfPrinting',
        id: 'pdfPrinting',
        checkbox: true,
      },
    ]));

  openModal({
    title: t('modals.settings.title'),
    content,
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        id: 'saveSettingsButton',
        label: t('common.save'),
        intent: 'is-primary',
        onClick: saveSettingsHandler,
        close: true,
      },
    ],
  });

  // Initialize button state based on initial validation
  setTimeout(() => {
    const saveButton = document.getElementById('saveSettingsButton') as HTMLButtonElement;
    const value = inputs?.minCourtGridRows?.value ?? env.schedule.minCourtGridRows;
    const valid = validators.numericRange(1, 100)(value);
    if (saveButton) saveButton.disabled = !valid;
  }, 0);
}

export function initSettingsIcon(id: string): void {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', settingsModal);
}
