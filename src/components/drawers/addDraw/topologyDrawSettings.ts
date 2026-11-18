/**
 * What the topology builder's Configure draw drawer adds to the topology's draw options (CA, 2026-11-17): the Add
 * Draw drawer's settings that the topology does not already define — score format, seeding policy, seeds, creation
 * and (TEAM) scorecard. Read here as the Add Draw drawer reads them (`submitDrawParams`); the drawer itself is
 * `topologyDrawSettingsDrawer`.
 */
import { getSeedingAllowance, getSeedingPolicyDefinition, INHERIT } from './seedingPolicies';
import { isSeedableDrawType, resolveSeedsCount } from './seedCount';

// constants
import { AUTOMATED, CUSTOM, DRAFT } from 'constants/tmxConstants';

/** What the drawer adds to the topology's draw options. */
export type TopologyDrawSettings = {
  enforcePolicyLimits?: boolean;
  policyDefinitions?: any;
  matchUpFormat?: string;
  tieFormatName?: string;
  automated: boolean | { seedsOnly: true };
  /** The event's seeding values: the scale the factory seeds from, as the Add Draw drawer names it. */
  seedingScaleName?: string;
  seedsCount?: number;
  tieFormat?: any;
  isDraft: boolean;
};

export type TopologyMain = {
  /** The Main structure's own score format, from its card: the topology's, so the drawer does not ask for one. */
  matchUpFormat?: string;
  drawType: string;
  drawSize: number;
  /** Accepted MAIN entries as the draw will be made: with the acceptance line's pending changes. */
  entriesCount: number;
};

/** The settings from the drawer's values. Pure apart from the seeding policy the factory resolves. */
export function topologyDrawSettings({
  values,
  eventId,
  main,
}: {
  values: {
    matchUpFormat?: string;
    seedingPolicy?: string;
    seedsCount?: string;
    creation?: string;
    tieFormatName?: string;
  };
  eventId: string;
  main: TopologyMain;
}): TopologyDrawSettings {
  const isDraft = values.creation === DRAFT;
  const settings: TopologyDrawSettings = {
    automated: isDraft ? { seedsOnly: true } : values.creation === AUTOMATED,
    isDraft,
  };
  if (values.matchUpFormat && values.matchUpFormat !== CUSTOM) settings.matchUpFormat = values.matchUpFormat;
  if (values.tieFormatName && values.tieFormatName !== CUSTOM) settings.tieFormatName = values.tieFormatName;

  const seedingPolicy = values.seedingPolicy || INHERIT;
  const policyDefinitions = getSeedingPolicyDefinition(seedingPolicy);
  if (policyDefinitions) settings.policyDefinitions = policyDefinitions;

  if (isSeedableDrawType(main.drawType)) {
    const { thresholdSeedsCount, additionalSeedsAllowed } = getSeedingAllowance({
      selectedSeedingPolicy: seedingPolicy,
      participantsCount: main.entriesCount,
      drawSize: main.drawSize,
      eventId,
    });
    const { seedsCount, isOverride } = resolveSeedsCount({
      requestedValue: values.seedsCount,
      participantsCount: main.entriesCount,
      automaticSeedsCount: thresholdSeedsCount,
      additionalSeedsAllowed,
      thresholdSeedsCount,
      drawSize: main.drawSize,
      drawType: main.drawType,
    });
    settings.seedsCount = seedsCount;
    // as in submitDrawParams: the event's seeding values are what seeds are placed from. Without it a topology's draw
    // had seed slots and no seeded players in them (CA, 2026-11-17)
    settings.seedingScaleName = eventId;
    // as in submitDrawParams: only a count above the policy's ceiling lifts its limits
    if (isOverride) settings.enforcePolicyLimits = false;
  }
  return settings;
}

/** The drawer's settings over the topology's draw options: the topology's own Main format is kept. */
export function applyTopologyDrawSettings(drawOptions: any, settings: TopologyDrawSettings): any {
  const { policyDefinitions, matchUpFormat, ...rest } = settings;
  return {
    ...drawOptions,
    ...rest,
    ...(matchUpFormat && !drawOptions.matchUpFormat && { matchUpFormat }),
    ...(policyDefinitions && { policyDefinitions: { ...drawOptions.policyDefinitions, ...policyDefinitions } }),
  };
}
