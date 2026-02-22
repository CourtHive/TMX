import { saveSettings, loadSettings } from 'services/settings/settingsStorage';
import { renderForm, validators } from 'courthive-components';
import { setActiveScale } from 'settings/setActiveScale';
import { env } from 'settings/env';
import { i18next, t } from 'i18n';

import { UTR, WTN } from 'constants/tmxConstants';

function persistAll(
  languageInputs: any,
  ratingInputs: any,
  scoringInputs: any,
  schedulingInputs: any,
  storageInputs: any,
  displayInputs: any,
): void {
  const activeScale = ratingInputs.wtn.checked ? WTN : UTR;
  env.saveLocal = storageInputs.saveLocal.checked;
  env.pdfPrinting = displayInputs.pdfPrinting?.checked || false;
  env.persistInputFields = storageInputs.persistInputFields?.checked ?? true;

  let scoringApproach: 'dynamicSets' | 'freeScore' | 'dialPad';
  if (scoringInputs.dynamicSets.checked) {
    scoringApproach = 'dynamicSets';
  } else if (scoringInputs.dialPad.checked) {
    scoringApproach = 'dialPad';
  } else if (scoringInputs.freeScore.checked) {
    scoringApproach = 'freeScore';
  } else {
    scoringApproach = 'dynamicSets';
  }
  env.scoringApproach = scoringApproach;

  const minCourtGridRowsValue = schedulingInputs.minCourtGridRows.value;
  if (validators.numericRange(1, 100)(minCourtGridRowsValue)) {
    env.schedule.minCourtGridRows = Number.parseInt(minCourtGridRowsValue, 10);
  }

  const language = languageInputs.language.value;
  const languageChanged = language !== i18next.language;

  setActiveScale(activeScale);

  saveSettings({
    activeScale,
    scoringApproach,
    saveLocal: env.saveLocal,
    smartComplements: scoringInputs.smartComplements?.checked || false,
    pdfPrinting: env.pdfPrinting,
    minCourtGridRows: env.schedule.minCourtGridRows,
    persistInputFields: env.persistInputFields,
    language,
  });

  if (languageChanged) {
    globalThis.location.reload();
  }
}

export function renderSettingsGrid(container: HTMLElement): void {
  const currentSettings = loadSettings();

  // These are populated after renderForm calls; persist closure captures the refs.
  let languageInputs: any;
  let ratingInputs: any;
  let scoringInputs: any;
  let schedulingInputs: any;
  let storageInputs: any;
  let displayInputs: any;

  const persist = () =>
    persistAll(languageInputs, ratingInputs, scoringInputs, schedulingInputs, storageInputs, displayInputs);

  const grid = document.createElement('div');
  grid.className = 'settings-grid';

  // --- Language panel (blue, 1 col) ---
  const languagePanel = document.createElement('div');
  languagePanel.className = 'settings-panel panel-blue';
  languagePanel.innerHTML = `<h3><i class="fa-solid fa-globe"></i> ${t('modals.settings.language')}</h3>`;

  const languageForm = document.createElement('div');
  languageInputs = renderForm(languageForm, [
    {
      options: [
        { value: 'en', label: 'English', selected: i18next.language === 'en' },
        { value: 'fr', label: 'Fran\u00e7ais', selected: i18next.language === 'fr' },
        { value: 'es', label: 'Espa\u00f1ol', selected: i18next.language === 'es' },
        { value: 'pt-BR', label: 'Portugu\u00eas (Brasil)', selected: i18next.language === 'pt-BR' },
        { value: 'de', label: 'Deutsch', selected: i18next.language === 'de' },
        { value: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', selected: i18next.language === 'ar' },
      ],
      onChange: persist,
      field: 'language',
      id: 'language',
    },
  ]);
  languagePanel.appendChild(languageForm);
  grid.appendChild(languagePanel);

  // --- Active Rating panel (blue, 1 col) ---
  const ratingPanel = document.createElement('div');
  ratingPanel.className = 'settings-panel panel-blue';
  ratingPanel.innerHTML = `<h3><i class="fa-solid fa-star"></i> ${t('modals.settings.activeRating')}</h3>`;

  const ratingForm = document.createElement('div');
  ratingInputs = renderForm(ratingForm, [
    {
      options: [
        { text: 'WTN', field: 'wtn', checked: env.activeScale === WTN },
        { text: 'UTR', field: 'utr', checked: env.activeScale === UTR },
      ],
      onChange: persist,
      field: 'activeRating',
      id: 'activeRating',
      radio: true,
    },
  ]);
  // workaround: courthive-components <=0.9.27 doesn't wire onChange for radios
  ratingInputs.wtn.addEventListener('change', persist);
  ratingInputs.utr.addEventListener('change', persist);
  ratingPanel.appendChild(ratingForm);
  grid.appendChild(ratingPanel);

  // --- Scoring panel (green, cols 3-4) ---
  const scoringPanel = document.createElement('div');
  scoringPanel.className = 'settings-panel panel-green';
  scoringPanel.style.gridColumn = '3 / 5';
  scoringPanel.innerHTML = `<h3><i class="fa-solid fa-table-tennis-paddle-ball"></i> ${t('modals.settings.scoringApproach')}</h3>`;

  const scoringForm = document.createElement('div');
  scoringInputs = renderForm(scoringForm, [
    {
      options: [
        { text: t('modals.settings.dynamicSets'), field: 'dynamicSets', checked: env.scoringApproach === 'dynamicSets' },
        { text: t('modals.settings.dialPad'), field: 'dialPad', checked: env.scoringApproach === 'dialPad' },
        { text: t('modals.settings.freeScore'), field: 'freeScore', checked: env.scoringApproach === 'freeScore' },
      ],
      onChange: persist,
      field: 'scoringApproach',
      id: 'scoringApproach',
      radio: true,
    },
    {
      label: t('modals.settings.smartComplements'),
      checked: currentSettings?.smartComplements || false,
      field: 'smartComplements',
      id: 'smartComplements',
      onChange: persist,
      checkbox: true,
    },
  ]);
  // workaround: courthive-components <=0.9.27 doesn't wire onChange for radios
  scoringInputs.dynamicSets.addEventListener('change', persist);
  scoringInputs.dialPad.addEventListener('change', persist);
  scoringInputs.freeScore.addEventListener('change', persist);
  scoringPanel.appendChild(scoringForm);
  grid.appendChild(scoringPanel);

  // --- Scheduling panel (orange, cols 1-2) ---
  const schedulingPanel = document.createElement('div');
  schedulingPanel.className = 'settings-panel panel-orange';
  schedulingPanel.style.gridColumn = '1 / 3';
  schedulingPanel.innerHTML = `<h3><i class="fa-solid fa-calendar-days"></i> ${t('modals.settings.scheduling')}</h3>`;

  const schedulingForm = document.createElement('div');
  schedulingInputs = renderForm(schedulingForm, [
    {
      label: t('modals.settings.minScheduleGridRows'),
      value: currentSettings?.minCourtGridRows ?? env.schedule.minCourtGridRows,
      field: 'minCourtGridRows',
      id: 'minCourtGridRows',
      validator: validators.numericRange(1, 100),
      error: t('modals.settings.minScheduleGridRowsError'),
      selectOnFocus: true,
      onInput: () => {
        const value = schedulingInputs.minCourtGridRows.value;
        if (validators.numericRange(1, 100)(value)) persist();
      },
    },
  ]);
  schedulingPanel.appendChild(schedulingForm);
  grid.appendChild(schedulingPanel);

  // --- Storage panel (purple, cols 3-4) ---
  const storagePanel = document.createElement('div');
  storagePanel.className = 'settings-panel panel-purple';
  storagePanel.style.gridColumn = '3 / 5';
  storagePanel.innerHTML = `<h3><i class="fa-solid fa-floppy-disk"></i> ${t('modals.settings.storage')}</h3>`;

  const storageForm = document.createElement('div');
  storageInputs = renderForm(storageForm, [
    {
      label: t('modals.settings.saveLocalCopies'),
      checked: env.saveLocal,
      field: 'saveLocal',
      id: 'saveLocal',
      onChange: persist,
      checkbox: true,
    },
    {
      label: t('modals.settings.persistInputFields'),
      checked: currentSettings?.persistInputFields ?? true,
      field: 'persistInputFields',
      id: 'persistInputFields',
      onChange: persist,
      checkbox: true,
    },
  ]);
  storagePanel.appendChild(storageForm);
  grid.appendChild(storagePanel);

  // --- Beta Features panel (teal, 1 col) ---
  const displayPanel = document.createElement('div');
  displayPanel.className = 'settings-panel panel-teal';
  displayPanel.innerHTML = `<h3><i class="fa-solid fa-display"></i> ${t('modals.settings.betaFeatures')}</h3>`;

  const displayForm = document.createElement('div');
  displayInputs = renderForm(displayForm, [
    {
      label: t('modals.settings.pdfPrinting'),
      checked: env.pdfPrinting || false,
      field: 'pdfPrinting',
      id: 'pdfPrinting',
      onChange: persist,
      checkbox: true,
    },
  ]);
  displayPanel.appendChild(displayForm);
  grid.appendChild(displayPanel);

  container.appendChild(grid);
}
