import { getUserCompositionsSync, loadUserCompositions } from 'pages/templates/compositionBridge';
import { mergeDisplaySettingsValue, scopedDisplaySettings } from './displaySettingsValue';
import { resolveCompositionByName } from 'services/compositions/resolveCompositionByName';
import { defaultDrawComposition } from 'services/compositions/defaultDrawComposition';
import { compositions, openDisplaySettingsDialog } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { extensionConstants } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';
import { displayConfig } from 'config/displayConfig';

// constants and types
import { ADD_DRAW_DEFINITION_EXTENSION, ADD_EVENT_EXTENSION } from 'constants/mutationConstants';
import type { DisplaySettingsPreset, SavedComposition } from 'courthive-components';
import { t } from 'i18n';

export async function editDisplaySettings({
  eventId,
  drawId,
  callback,
}: {
  eventId: string;
  drawId?: string;
  callback?: (composition: any) => void;
}) {
  await loadUserCompositions().catch(() => {});
  const findDisplay = () =>
    tournamentEngine.findExtension({
      name: extensionConstants.DISPLAY,
      discover: true,
      eventId,
      drawId,
    }).extension?.value;
  const saved = scopedDisplaySettings(findDisplay());
  const eventType = tournamentEngine.getEvent({ eventId, drawId })?.event?.eventType;
  const fallback = defaultDrawComposition({ eventType, drawId, eventId });
  const initialName = saved?.compositionName ?? fallback.compositionName;
  const source = saved?.compositionName
    ? (resolveCompositionByName(initialName) ?? fallback.composition)
    : fallback.composition;
  const composition = {
    ...source,
    theme: saved?.theme ?? source.theme,
    configuration: { ...source.configuration, ...saved?.configuration },
    colors: saved?.colors ?? source.colors,
  };
  const choices = new Map<string, DisplaySettingsPreset>();
  for (const name of Object.keys(compositions).filter((name) => name !== 'Night' && name !== 'InlineScoring')) {
    choices.set(name, { name, composition: resolveCompositionByName(name) });
  }
  for (const item of getUserCompositionsSync()) {
    choices.set(item.name, {
      name: item.name,
      label: `${item.name} (${t('modals.displaySettings.custom')})`,
      composition: resolveCompositionByName(item.name),
    });
  }
  return openDisplaySettingsDialog({
    compositionName: initialName,
    composition,
    presets: [...choices.values()],
    saveButtonId: 'saveDisplaySettings',
    labels: {
      title: t('modals.displaySettings.title'),
      composition: t('modals.printDraw.composition'),
      scheduleInfo: t('modals.displaySettings.showSchedule'),
      pathHighlight: t('modals.displaySettings.pathHighlight'),
      connectors: t('modals.displaySettings.showConnectors'),
      flags: t('modals.displaySettings.showFlags'),
      detail: t('modals.displaySettings.detail'),
      matchUpFooter: t('modals.displaySettings.matchUpFooter'),
      advanced: t('modals.displaySettings.advanced'),
      basic: t('modals.displaySettings.basic'),
      preview: t('modals.displaySettings.preview'),
      none: t('none'),
      address: t('locations.address'),
      team: t('formats.team'),
      cancel: t('common.cancel'),
      save: t('common.save'),
    },
    onSave: (value: SavedComposition) => {
      const extension = { name: extensionConstants.DISPLAY, value: mergeDisplaySettingsValue(findDisplay(), value) };
      const method = drawId ? ADD_DRAW_DEFINITION_EXTENSION : ADD_EVENT_EXTENSION;
      mutationRequest({
        methods: [{ method, params: { eventId, drawId, extension } }],
        callback: () => {
          const runtime = { ...value, compositionName: value.compositionName };
          displayConfig.set({ composition: runtime });
          callback?.(runtime);
        },
      });
    },
  });
}
