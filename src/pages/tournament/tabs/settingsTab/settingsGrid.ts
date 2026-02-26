import { applyFont, applyTheme, FONT_OPTIONS, getFontPreference, getThemePreference } from 'services/theme/themeService';
import { saveSettings, loadSettings } from 'services/settings/settingsStorage';
import { tournamentEngine, fixtures, factoryConstants } from 'tods-competition-factory';
import { removeProviderTournament } from 'services/storage/removeProviderTournament';
import { getLoginState } from 'services/authentication/loginState';
import { removeTournament } from 'services/apis/servicesApi';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderForm, validators } from 'courthive-components';
import { setActiveScale } from 'settings/setActiveScale';
import { tmx2db } from 'services/storage/tmx2db';
import { context } from 'services/context';
import { env } from 'settings/env';
import { i18next, t } from 'i18n';

import { SUPER_ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

const { ratingsParameters } = fixtures;
const { SINGLES } = factoryConstants.eventConstants;

function persistAll(
  languageInputs: any,
  ratingInputs: any,
  scoringInputs: any,
  schedulingInputs: any,
  storageInputs: any,
  displayInputs: any,
): void {
  const activeScale = ratingInputs.activeRating.value;
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

  // Discover which ratings are present in current tournament participants
  const { participants: allParticipants = [] } = tournamentEngine.getParticipants({ withScaleValues: true }) ?? {};
  const presentRatings = new Set<string>();
  for (const p of allParticipants) {
    for (const item of p.ratings?.[SINGLES] || []) {
      presentRatings.add(item.scaleName);
    }
  }

  // Build rating options: tournament ratings first, then all others (excluding deprecated)
  const allRatingKeys = Object.keys(ratingsParameters).filter(
    (key) => !(ratingsParameters as any)[key].deprecated,
  );
  const inTournament = allRatingKeys.filter((key) => presentRatings.has(key));
  const notInTournament = allRatingKeys.filter((key) => !presentRatings.has(key));

  const ratingOptions = [
    ...inTournament.map((key) => ({
      label: `${key} (in tournament)`,
      value: key.toLowerCase(),
      selected: env.activeScale === key.toLowerCase(),
    })),
    ...notInTournament.map((key) => ({
      label: key,
      value: key.toLowerCase(),
      selected: env.activeScale === key.toLowerCase(),
    })),
  ];

  const ratingForm = document.createElement('div');
  ratingInputs = renderForm(ratingForm, [
    {
      options: ratingOptions,
      onChange: persist,
      field: 'activeRating',
      id: 'activeRating',
    },
  ]);
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

  // --- Theme panel (red, 1 col) ---
  const themePanel = document.createElement('div');
  themePanel.className = 'settings-panel panel-red';
  themePanel.innerHTML = `<h3><i class="fa-solid fa-circle-half-stroke"></i> ${t('modals.settings.theme')}</h3>`;

  const currentTheme = getThemePreference();
  const themeForm = document.createElement('div');
  const themeInputs = renderForm(themeForm, [
    {
      options: [
        { text: 'Light', field: 'light', checked: currentTheme === 'light' },
        { text: 'Dark', field: 'dark', checked: currentTheme === 'dark' },
        { text: 'System', field: 'system', checked: currentTheme === 'system' },
      ],
      onChange: () => {
        const pref = themeInputs.dark.checked ? 'dark' : themeInputs.system.checked ? 'system' : 'light';
        applyTheme(pref);
      },
      field: 'theme',
      id: 'theme',
      radio: true,
    },
  ]);
  // workaround: courthive-components <=0.9.27 doesn't wire onChange for radios
  const themeChange = () => {
    const pref = themeInputs.dark.checked ? 'dark' : themeInputs.system.checked ? 'system' : 'light';
    applyTheme(pref);
  };
  themeInputs.light.addEventListener('change', themeChange);
  themeInputs.dark.addEventListener('change', themeChange);
  themeInputs.system.addEventListener('change', themeChange);
  themePanel.appendChild(themeForm);
  grid.appendChild(themePanel);

  // --- Font panel (indigo, 1 col) ---
  const fontPanel = document.createElement('div');
  fontPanel.className = 'settings-panel panel-blue';
  fontPanel.innerHTML = `<h3><i class="fa-solid fa-font"></i> Font</h3>`;

  const currentFont = getFontPreference();
  const fontForm = document.createElement('div');
  renderForm(fontForm, [
    {
      options: Object.entries(FONT_OPTIONS).map(([key, { label }]) => ({
        value: key,
        label,
        selected: key === currentFont,
      })),
      onChange: (e: Event) => {
        const select = e.target as HTMLSelectElement;
        applyFont(select.value);
      },
      field: 'fontFamily',
      id: 'fontFamily',
    },
  ]);
  fontPanel.appendChild(fontForm);
  grid.appendChild(fontPanel);

  // --- Delete Tournament panel (red, full width) ---
  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const provider = tournamentRecord?.parentOrganisation;
  const providerId = provider?.organisationId;
  const state = getLoginState();
  const superAdmin = state?.roles?.includes(SUPER_ADMIN);
  const canDelete = superAdmin || state?.permissions?.includes('deleteTournament');
  const activeProvider = context.provider || state?.provider;

  // Show for local tournaments (no provider) or when user has delete permission
  if (tournamentRecord && (!providerId || canDelete)) {
    const deletePanel = document.createElement('div');
    deletePanel.className = 'settings-panel panel-red';
    deletePanel.style.gridColumn = '1 / -1';
    deletePanel.innerHTML = `<h3><i class="fa-solid fa-trash"></i> ${t('modals.settings.dangerZone')}</h3>`;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'button is-danger is-outlined';
    deleteBtn.style.marginTop = '8px';
    deleteBtn.innerHTML = `<i class="fa-solid fa-trash" style="margin-right:6px"></i>${t('modals.tournamentActions.deleteTournament')}`;
    deleteBtn.addEventListener('click', () => {
      const tournamentId = tournamentRecord.tournamentId;
      const provId = state?.providerId || providerId;
      const navigateAway = () => {
        if (provId) removeProviderTournament({ tournamentId, providerId: provId });
        context.router?.navigate(`/${TMX_TOURNAMENTS}`);
      };
      const localDelete = () => tmx2db.deleteTournament(tournamentId).then(navigateAway);

      tmxToast({
        action: {
          onClick: () => {
            if (activeProvider && provId) {
              removeTournament({ providerId: provId, tournamentId }).then(localDelete, (err) => console.log(err));
            } else {
              localDelete();
            }
          },
          text: t('common.confirm'),
        },
        message: t('modals.tournamentActions.deleteTournament'),
        intent: 'is-danger',
      });
    });

    deletePanel.appendChild(deleteBtn);
    grid.appendChild(deletePanel);
  }

  container.appendChild(grid);
}
