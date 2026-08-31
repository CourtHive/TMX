/**
 * Print Draw Modal — uses pdf-factory for generation
 *
 * The "Configure header/footer" sub-view swaps the modal content in-place
 * (via cModal.update) rather than opening a second modal, because cModal
 * is a singleton — opening a new one would destroy the parent.
 */
import { generateDrawPDF } from 'services/pdf/generators/drawGenerator';
import { tournamentEngine } from 'services/factory/engine';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

// Functions, not module-level consts: `t()` evaluated at module scope resolves
// once at import — before `initialState` has switched to the user's locale —
// and never updates on a language change, so these dropdowns would stay English
// inside an otherwise translated modal.
//
// The preset names are deliberately IN the locale file even though several are
// proper nouns. They label PDF layouts styled after those events, and a reader
// in a non-Latin script expects the transliteration they know (Chinese renders
// Wimbledon as 温布尔登); where a name genuinely does not change — "ATP 250" —
// the locale simply repeats it, which the translation gate records explicitly
// as a cognate rather than mistaking it for an untranslated string.
const catalogPresets = () => [
  { value: 'club-basic', label: t('modals.printDraw.presets.clubBasic') },
  { value: 'national-federation', label: t('modals.printDraw.presets.nationalFederation') },
  { value: 'itf-junior', label: t('modals.printDraw.presets.itfJunior') },
  { value: 'itf-pro-circuit', label: t('modals.printDraw.presets.itfProCircuit') },
  { value: 'collegiate-ncaa', label: t('modals.printDraw.presets.ncaaCollegiate') },
  { value: 'atp-250', label: t('modals.printDraw.presets.atp250') },
  { value: 'atp-finals', label: t('modals.printDraw.presets.atpFinals') },
  { value: 'wta-500', label: t('modals.printDraw.presets.wta500') },
  { value: 'wta-1000', label: t('modals.printDraw.presets.wta1000') },
  { value: 'grand-slam', label: t('modals.printDraw.presets.grandSlam') },
  { value: 'wimbledon', label: t('modals.printDraw.presets.wimbledon') },
  { value: 'australian-open', label: t('modals.printDraw.presets.australianOpen') },
];

const headerLayouts = () => [
  { label: t('modals.printDraw.headerLayouts.grandSlam'), value: 'grand-slam' },
  { label: t('modals.printDraw.headerLayouts.itfProfessional'), value: 'itf' },
  { label: t('modals.printDraw.headerLayouts.wtaAtpTour'), value: 'wta-tour' },
  { label: t('modals.printDraw.headerLayouts.nationalFederation'), value: 'national-federation' },
  { label: t('modals.printDraw.headerLayouts.minimal'), value: 'minimal' },
  { label: t('modals.printDraw.headerLayouts.none'), value: 'none' },
];

const footerLayouts = () => [
  { label: t('modals.printDraw.footerLayouts.standard'), value: 'standard' },
  { label: t('modals.printDraw.footerLayouts.seedingsTable'), value: 'seedings-table' },
  { label: t('modals.printDraw.footerLayouts.prizeMoney'), value: 'prize-money' },
  { label: t('modals.printDraw.footerLayouts.officialsSignoff'), value: 'officials-signoff' },
  { label: t('modals.printDraw.footerLayouts.combinedTour'), value: 'combined-tour' },
  { label: t('modals.printDraw.footerLayouts.none'), value: 'none' },
];

const DEFAULT_PRESET = 'club-basic';

interface PrintDrawParams {
  drawId: string;
  eventId: string;
  structureId?: string;
}

export function printDraw({ drawId, eventId, structureId }: PrintDrawParams): void {
  const tournamentInfoResult = tournamentEngine.getTournamentInfo();
  const tournament = tournamentInfoResult?.tournamentInfo;

  const eventResult = tournamentEngine.getEvent({ eventId });
  const event = eventResult?.event;

  let drawDefinition;
  if (event?.drawDefinitions) {
    drawDefinition = event.drawDefinitions.find((dd: any) => dd.drawId === drawId);
  }

  if (!drawDefinition) return;

  let drawTitle = drawDefinition.drawName || event?.eventName || '';
  if (structureId) {
    const structure = drawDefinition.structures?.find((s: any) => s.structureId === structureId);
    if (structure?.structureName) drawTitle = structure.structureName;
  }

  let printOptions: any = {
    drawTitle,
    includeSeeding: true,
    includeTimestamp: true,
    splitPages: false,
    catalogPreset: DEFAULT_PRESET,
    headerLayout: undefined,
    footerLayout: undefined,
  };

  let modalHandle: any;

  // ── Composition editor view (swapped in-place) ──

  const showCompositionEditor = () => {
    const editorContent = (container: HTMLElement) => {
      renderForm(container, [
        {
          field: 'catalogPreset',
          label: t('modals.printDraw.preset'),
          options: catalogPresets().map((p) => ({
            ...p,
            selected: p.value === (printOptions.catalogPreset || DEFAULT_PRESET),
          })),
        },
        { divider: true },
        {
          field: 'headerLayout',
          label: t('modals.printDraw.headerLayout'),
          options: headerLayouts().map((h) => ({
            ...h,
            selected: h.value === (printOptions.headerLayout || 'itf'),
          })),
        },
        {
          field: 'footerLayout',
          label: t('modals.printDraw.footerLayout'),
          options: footerLayouts().map((f) => ({
            ...f,
            selected: f.value === (printOptions.footerLayout || 'standard'),
          })),
        },
      ]);

      container.style.padding = '1em';
      container.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const field = target.getAttribute('field');
        if (field) printOptions[field] = target.value;
      });
    };

    const editorButtons = [
      {
        label: t('common.back'),
        intent: 'none',
        close: false,
        onClick: () => showPrintOptions(),
      },
      {
        label: t('modals.courtAvailability.apply'),
        intent: 'is-info',
        close: false,
        onClick: () => showPrintOptions(),
      },
    ];

    modalHandle.update({
      title: t('modals.printDraw.pdfComposition'),
      content: editorContent,
      buttons: editorButtons,
    });
  };

  // ── Main print options view ──

  const showPrintOptions = () => {
    const formItems = [
      {
        label: t('modals.printDraw.drawTitle'),
        field: 'drawTitle',
        value: printOptions.drawTitle,
        placeholder: t('modals.printDraw.drawTitlePlaceholder'),
      },
      {
        text: t('modals.printDraw.composition'),
        class: 'itemTitle',
      },
      {
        label: t('modals.printDraw.preset'),
        field: 'catalogPreset',
        id: 'pd-preset',
        options: catalogPresets().map((p) => ({ ...p, selected: p.value === printOptions.catalogPreset })),
      },
      {
        text: t('modals.printDraw.options'),
        class: 'itemTitle',
      },
      {
        label: t('modals.printDraw.includeSeeding'),
        field: 'includeSeeding',
        id: 'pd-seeding',
        checkbox: true,
        checked: printOptions.includeSeeding,
      },
      {
        label: t('modals.printDraw.includeTimestamp'),
        field: 'includeTimestamp',
        id: 'pd-timestamp',
        checkbox: true,
        checked: printOptions.includeTimestamp,
      },
      ...(drawDefinition.drawSize >= 64
        ? [
            {
              label: t('modals.printDraw.multiPage'),
              field: 'splitPages',
              id: 'pd-split',
              checkbox: true,
              checked: printOptions.splitPages,
            },
          ]
        : []),
    ];

    const printContent = (container: HTMLElement) => {
      container.style.padding = '1em';
      renderForm(container, formItems);

      const configBtn = document.createElement('button');
      configBtn.type = 'button';
      configBtn.className = 'button font-medium';
      configBtn.innerHTML = '<i class="fa-solid fa-sliders" style="margin-right: 6px;"></i>Configure header/footer';
      configBtn.style.cssText = 'margin-top: 12px; font-size: 13px;';
      configBtn.addEventListener('click', showCompositionEditor);
      container.appendChild(configBtn);

      container.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const field = target.getAttribute('field');
        if (field) {
          if (target.type === 'checkbox') {
            printOptions[field] = target.checked;
          } else {
            printOptions[field] = target.value;
          }
        }
      });
    };

    const buildOptions = () => ({
      drawTitle: printOptions.drawTitle,
      includeTimestamp: printOptions.includeTimestamp,
      includeSeeding: printOptions.includeSeeding,
      splitPages: printOptions.splitPages,
      catalogPreset: printOptions.catalogPreset,
      headerLayout: printOptions.headerLayout,
      footerLayout: printOptions.footerLayout,
    });

    const buttons = [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        label: t('view'),
        intent: 'is-info',
        onClick: () => {
          generateDrawPDF({ tournament, event, drawId, structureId, options: buildOptions(), action: 'open' });
        },
        close: true,
      },
      {
        label: t('dl'),
        intent: 'is-primary',
        onClick: () => {
          generateDrawPDF({ tournament, event, drawId, structureId, options: buildOptions(), action: 'download' });
        },
        close: true,
      },
    ];

    if (modalHandle) {
      modalHandle.update({ title: t('modals.printDraw.title'), content: printContent, buttons });
    } else {
      modalHandle = openModal({ title: t('modals.printDraw.title'), content: printContent, buttons });
    }
  };

  showPrintOptions();
}
