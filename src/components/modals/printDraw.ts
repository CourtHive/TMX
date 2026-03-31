/**
 * Print Draw Modal — uses pdf-factory for generation
 *
 * The "Configure header/footer" sub-view swaps the modal content in-place
 * (via cModal.update) rather than opening a second modal, because cModal
 * is a singleton — opening a new one would destroy the parent.
 */
import { renderForm } from 'courthive-components';
import { generateDrawPDF } from 'services/pdf/generators/drawGenerator';
import { tournamentEngine } from 'tods-competition-factory';
import { openModal } from './baseModal/baseModal';
import { t } from 'i18n';

const CATALOG_PRESETS = [
  { value: 'club-basic', label: 'Club Basic' },
  { value: 'national-federation', label: 'National Federation' },
  { value: 'itf-junior', label: 'ITF Junior' },
  { value: 'itf-pro-circuit', label: 'ITF Pro Circuit' },
  { value: 'collegiate-ncaa', label: 'NCAA Collegiate' },
  { value: 'atp-250', label: 'ATP 250' },
  { value: 'atp-finals', label: 'ATP Finals' },
  { value: 'wta-500', label: 'WTA 500' },
  { value: 'wta-1000', label: 'WTA 1000' },
  { value: 'grand-slam', label: 'Grand Slam' },
  { value: 'wimbledon', label: 'Wimbledon' },
  { value: 'australian-open', label: 'Australian Open' },
];

const HEADER_LAYOUTS = [
  { label: 'Grand Slam', value: 'grand-slam' },
  { label: 'ITF / Professional', value: 'itf' },
  { label: 'WTA / ATP Tour', value: 'wta-tour' },
  { label: 'National Federation', value: 'national-federation' },
  { label: 'Minimal', value: 'minimal' },
  { label: 'None', value: 'none' },
];

const FOOTER_LAYOUTS = [
  { label: 'Standard', value: 'standard' },
  { label: 'Seedings Table', value: 'seedings-table' },
  { label: 'Prize Money', value: 'prize-money' },
  { label: 'Officials Sign-off', value: 'officials-signoff' },
  { label: 'Combined Tour', value: 'combined-tour' },
  { label: 'None', value: 'none' },
];

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
    catalogPreset: 'club-basic',
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
          label: 'Preset',
          options: CATALOG_PRESETS.map((p) => ({
            ...p,
            selected: p.value === (printOptions.catalogPreset || 'club-basic'),
          })),
        },
        { divider: true },
        {
          field: 'headerLayout',
          label: 'Header Layout',
          options: HEADER_LAYOUTS.map((h) => ({
            ...h,
            selected: h.value === (printOptions.headerLayout || 'itf'),
          })),
        },
        {
          field: 'footerLayout',
          label: 'Footer Layout',
          options: FOOTER_LAYOUTS.map((f) => ({
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
        label: 'Back',
        intent: 'none',
        close: false,
        onClick: () => showPrintOptions(),
      },
      {
        label: 'Apply',
        intent: 'is-info',
        close: false,
        onClick: () => showPrintOptions(),
      },
    ];

    modalHandle.update({
      title: 'PDF Composition',
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
        text: 'Composition',
        class: 'itemTitle',
      },
      {
        label: 'Preset',
        field: 'catalogPreset',
        id: 'pd-preset',
        options: CATALOG_PRESETS.map((p) => ({ ...p, selected: p.value === printOptions.catalogPreset })),
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
              label: 'Multi-page (split into sections)',
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
