import { renderTeamColorsEditor } from 'courthive-components';
import { t } from 'i18n';

/** Shared authoring surface for portable CODES palettes and preferred role assignments. */
export function renderTeamPaletteEditor(target: HTMLElement, initial: unknown) {
  const keys = [
    'palette',
    'addColor',
    'clearPalette',
    'chooseColor',
    'missingColor',
    'color',
    'colorname',
    'colorvalue',
    'colorgroup',
    'moveColorUp',
    'removeColor',
    'invalidPalette',
    'team.surface',
    'team.text',
    'team.accent',
    'score.surface',
    'score.text',
  ];
  const labels = Object.fromEntries(keys.map((key) => [key, t(`pages.participants.grouping.${key}`)]));
  return renderTeamColorsEditor(target, initial, labels);
}
