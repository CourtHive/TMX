import { eventConstants } from 'tods-competition-factory';
import { genderAccent } from './genderAccent';
import { t } from 'i18n';

// The accents are light in dark palettes and dark in light ones; the inverse text color is the ink that
// contrasts with them in every palette.
const INK_ON_ACCENT = 'var(--tmx-text-inverse)';

const { SINGLES, DOUBLES, TEAM } = eventConstants;

const TYPE_LABEL_KEYS: Record<string, string> = {
  [SINGLES]: 'pages.matchUps.singles',
  [DOUBLES]: 'pages.matchUps.doubles',
  [TEAM]: 'pages.matchUps.team',
};

function colorsForGender(gender?: string): { bg: string; fg: string } {
  const accent = genderAccent(gender);
  return accent ? { bg: accent, fg: INK_ON_ACCENT } : { bg: 'var(--tmx-bg-tertiary)', fg: 'var(--tmx-text-primary)' };
}

export function matchUpTypeChipFormatter(cell: any): HTMLSpanElement | string {
  const matchUpType = cell.getValue();
  if (!matchUpType) return '';

  const row = cell.getRow().getData();
  const gender = row.gender || row.matchUp?.gender;
  const { bg, fg } = colorsForGender(gender);

  const labelKey = TYPE_LABEL_KEYS[matchUpType];
  const label = labelKey ? t(labelKey) : matchUpType;

  const chip = document.createElement('span');
  chip.className = 'tag matchup-type-chip';
  chip.style.cssText = `background:${bg};color:${fg};font-size:0.75rem;padding:2px 8px;border-radius:999px;font-weight:600;letter-spacing:0.02em;`;
  chip.textContent = label;
  if (gender) chip.title = gender;
  return chip;
}
