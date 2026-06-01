import { genderConstants, eventConstants } from 'tods-competition-factory';
import { t } from 'i18n';

const { MALE, FEMALE, MIXED } = genderConstants;
const { SINGLES, DOUBLES, TEAM } = eventConstants;

const TYPE_LABEL_KEYS: Record<string, string> = {
  [SINGLES]: 'pages.matchUps.singles',
  [DOUBLES]: 'pages.matchUps.doubles',
  [TEAM]: 'pages.matchUps.team',
};

function colorsForGender(gender?: string): { bg: string; fg: string } {
  const g = gender?.toUpperCase();
  if (g === MALE) return { bg: 'var(--tmx-accent-blue)', fg: '#fff' };
  if (g === FEMALE) return { bg: 'var(--tmx-accent-pink)', fg: '#fff' };
  if (g === MIXED) return { bg: 'var(--tmx-accent-purple)', fg: '#fff' };
  return { bg: 'var(--tmx-bg-tertiary)', fg: 'var(--tmx-text-primary)' };
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
