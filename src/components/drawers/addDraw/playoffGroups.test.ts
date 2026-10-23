import { drawDefinitionConstants } from 'tods-competition-factory';
import { describe, expect, it, vi } from 'vitest';

import { getDrawTypeOptions } from './getDrawTypeOptions';
import {
  buildAddedPlayoffGroups,
  DEFAULT_PLAYOFF_DRAW_TYPE,
  getPlayoffDrawProps,
  getPlayoffGroups,
  PLAYOFF_DRAW_TYPES,
  resolvePlayoffDrawType,
} from './playoffGroups';

import { PLAYOFF_DRAW_TYPE, PLAYOFF_GROUP_SIZE, POSITIONS, TOP_FINISHERS, WINNERS } from 'constants/tmxConstants';

// getDrawTypeOptions reads saved topology templates and provider restrictions, and courthive-components
// needs a DOM to load; none of it bears on which built-in draw types a playoff can be.
vi.mock('pages/templates/topologyBridge', () => ({
  getBuiltinTopologies: () => [],
  getUserTopologiesSync: () => [],
}));
vi.mock('./topologyTemplates', () => ({ getTopologyTemplates: () => [] }));
vi.mock('config/providerConfig', () => ({ providerConfig: { getAllowedList: () => [] } }));
vi.mock('i18n', () => ({ t: (key: string) => key }));
vi.mock('courthive-components', () => ({ validateTopology: () => [] }));

const { ROUND_ROBIN, SINGLE_ELIMINATION, COMPASS } = drawDefinitionConstants;

const DIVIDER = '──────────';

/**
 * What a rendered `<select>` reports as its value, following courthive-components' `renderOptions`
 * (an option is marked selected when `item.value === option.value`) and the HTML rules: the last
 * `selected` option wins, an option with no value attribute reports its label text, and with nothing
 * marked the first enabled option is shown.
 */
function renderedSelectValue(item: { value?: unknown; options: any[] }): string {
  const shown = item.options.filter((option) => !option.hide);
  const marked = shown.filter((option) => option.selected || item.value === option.value);
  const chosen = marked.at(-1) ?? shown.find((option) => !option.disabled);
  if (!chosen) return '';
  return chosen.value === undefined || chosen.value === null ? String(chosen.label) : String(chosen.value);
}

function playoffDrawTypeItem(value?: string) {
  return { options: getDrawTypeOptions({ isPlayoff: true }), value };
}

describe('the Playoff Draw Type select', () => {
  it('opens on a buildable draw type when given the drawer default', () => {
    expect(renderedSelectValue(playoffDrawTypeItem(DEFAULT_PLAYOFF_DRAW_TYPE))).toBe(SINGLE_ELIMINATION);
  });

  it('never opens on the divider, even with no default', () => {
    // Before the fix the divider carried no value, so it matched an item without one and the select
    // reported the divider's label — journey 175's defect.
    const value = renderedSelectValue(playoffDrawTypeItem(undefined));
    expect(value).not.toBe(DIVIDER);
    expect(resolvePlayoffDrawType(value) ?? DEFAULT_PLAYOFF_DRAW_TYPE).toBe(SINGLE_ELIMINATION);
  });

  it('offers only draw types the submit path will pass through', () => {
    const offered = getDrawTypeOptions({ isPlayoff: true })
      .filter((option) => !option.hide && !option.disabled)
      .map((option) => option.value);
    expect(offered.length).toBeGreaterThan(0);
    for (const value of offered) expect(PLAYOFF_DRAW_TYPES.has(value)).toBe(true);
  });

  it('gives every divider an explicit empty value and disables it', () => {
    const dividers = getDrawTypeOptions({ isPlayoff: true }).filter((option) => option.label === DIVIDER);
    expect(dividers.length).toBeGreaterThan(0);
    for (const divider of dividers) expect(divider).toMatchObject({ value: '', disabled: true });
  });
});

describe('resolvePlayoffDrawType', () => {
  it('passes a known playoff draw type through', () => {
    expect(resolvePlayoffDrawType(SINGLE_ELIMINATION)).toBe(SINGLE_ELIMINATION);
    expect(resolvePlayoffDrawType(COMPASS)).toBe(COMPASS);
  });

  it.each([DIVIDER, '', undefined, null, 'Playoff Draw Type', 'NOT_A_DRAW_TYPE'])('refuses %j', (value) => {
    expect(resolvePlayoffDrawType(value)).toBeUndefined();
  });
});

describe('getPlayoffGroups', () => {
  const inputsWith = (playoffDrawType: unknown, extra: Record<string, unknown> = {}) => ({
    [PLAYOFF_DRAW_TYPE]: { value: playoffDrawType },
    ...extra,
  });

  it('builds Playoff 1-4 for POSITIONS with the drawer default, each a SINGLE_ELIMINATION', () => {
    const groups = getPlayoffGroups(POSITIONS, 0, false, 4, inputsWith(DEFAULT_PLAYOFF_DRAW_TYPE));
    expect(groups.map((group) => group.structureName)).toEqual(['Playoff 1', 'Playoff 2', 'Playoff 3', 'Playoff 4']);
    for (const group of groups) expect(group.drawType).toBe(SINGLE_ELIMINATION);
  });

  it('never sends the divider as a drawType; the factory default applies instead', () => {
    const groups = getPlayoffGroups(POSITIONS, 0, false, 4, inputsWith(DIVIDER));
    expect(groups).toHaveLength(4);
    for (const group of groups) expect(group).not.toHaveProperty('drawType');
  });

  it('never sends the divider for TOP_FINISHERS either', () => {
    const groups = getPlayoffGroups(TOP_FINISHERS, 2, true, 4, inputsWith(DIVIDER, { totalAdvance: { value: '' } }));
    expect(groups).toHaveLength(2);
    for (const group of groups) expect(group).not.toHaveProperty('drawType');
  });

  it('carries a round robin playoff group size only for a ROUND_ROBIN playoff', () => {
    const inputs = inputsWith(ROUND_ROBIN, { [PLAYOFF_GROUP_SIZE]: { value: '3' } });
    expect(getPlayoffDrawProps(inputs)).toEqual({ drawType: ROUND_ROBIN, structureOptions: { groupSize: 3 } });
    const notRR = inputsWith(SINGLE_ELIMINATION, { [PLAYOFF_GROUP_SIZE]: { value: '3' } });
    expect(getPlayoffDrawProps(notRR)).toEqual({ drawType: SINGLE_ELIMINATION });
  });

  it('builds no groups for WINNERS (the caller decides that shape)', () => {
    expect(getPlayoffGroups(WINNERS, 0, false, 4, inputsWith(DEFAULT_PLAYOFF_DRAW_TYPE))).toEqual([]);
  });
});

describe('the playoff draw types TMX sends', () => {
  // The playoff-group drawTypes the factory builds (#5730(competition-factory) refuses any other with
  // ERR_UNRECOGNIZED_DRAW_TYPE; before it, the factory returned success with no playoff structures).
  const FACTORY_BUILDS = new Set([
    'SINGLE_ELIMINATION',
    'COMPASS',
    'OLYMPIC',
    'PLAYOFF',
    'FIRST_MATCH_LOSER_CONSOLATION',
    'FEED_IN_CHAMPIONSHIP',
    'FEED_IN_CHAMPIONSHIP_TO_R16',
    'FEED_IN_CHAMPIONSHIP_TO_QF',
    'FEED_IN_CHAMPIONSHIP_TO_SF',
    'MODIFIED_FEED_IN_CHAMPIONSHIP',
    'ROUND_ROBIN',
    'FIRST_ROUND_LOSER_CONSOLATION',
    'CURTIS_CONSOLATION',
    'PAGE_PLAYOFF',
    'AD_HOC',
  ]);

  it('are all ones the factory builds as a playoff', () => {
    expect(PLAYOFF_DRAW_TYPES.size).toBeGreaterThan(0);
    for (const drawType of PLAYOFF_DRAW_TYPES) expect(FACTORY_BUILDS.has(drawType)).toBe(true);
    expect(FACTORY_BUILDS.has(DEFAULT_PLAYOFF_DRAW_TYPE)).toBe(true);
  });

  it('never include the PLAY_OFF stage, which the "Playoff" option used to send', () => {
    expect(PLAYOFF_DRAW_TYPES.has('PLAY_OFF')).toBe(false);
    expect(PLAYOFF_DRAW_TYPES.has('PLAYOFF')).toBe(true);
  });
});

describe('buildAddedPlayoffGroups (adding playoffs to an existing round robin)', () => {
  const checkedRanges = [
    { finishingPosition: 1, finishingPositionRange: '1-4' },
    { finishingPosition: 2, finishingPositionRange: '5-8' },
  ];

  it('carries the selected playoff draw type on every group', () => {
    const groups = buildAddedPlayoffGroups({ checkedRanges, structureName: 'Playoff', drawTypeValue: COMPASS });
    expect(groups).toEqual([
      { finishingPositions: [1], structureName: 'Playoff 1-4', drawType: COMPASS },
      { finishingPositions: [2], structureName: 'Playoff 5-8', drawType: COMPASS },
    ]);
  });

  it.each([DIVIDER, '', undefined, 'PLAY_OFF'])('omits drawType for %j rather than sending it', (drawTypeValue) => {
    const groups = buildAddedPlayoffGroups({ checkedRanges, structureName: 'Playoff', drawTypeValue });
    expect(groups).toHaveLength(2);
    for (const group of groups) expect(group).not.toHaveProperty('drawType');
  });

  it('adds a group size only for a ROUND_ROBIN playoff', () => {
    const [rr] = buildAddedPlayoffGroups({
      checkedRanges,
      structureName: 'Playoff',
      drawTypeValue: ROUND_ROBIN,
      groupSizeValue: '3',
    });
    expect(rr).toMatchObject({ drawType: ROUND_ROBIN, structureOptions: { groupSize: 3 } });
    const [se] = buildAddedPlayoffGroups({
      checkedRanges,
      structureName: 'Playoff',
      drawTypeValue: SINGLE_ELIMINATION,
      groupSizeValue: '3',
    });
    expect(se).not.toHaveProperty('structureOptions');
  });
});
