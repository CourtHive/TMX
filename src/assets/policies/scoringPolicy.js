import { drawDefinitionConstants, policyConstants } from 'tods-competition-factory';

const { POLICY_TYPE_SCORING } = policyConstants;
const { MAIN } = drawDefinitionConstants;

export const POLICY_SCORING = {
  [POLICY_TYPE_SCORING]: {
    requireAllPositionsAssigned: false,
    stage: {
      [MAIN]: {
        stageSequence: {
          1: {
            requireAllPositionsAssigned: true,
          },
        },
      },
    },
    defaultMatchUpFormat: 'SET3-S:6/TB7',
    matchUpFormats: [
      {
        categoryNames: [],
        categoryTypes: [],
        description: 'Best of 3 sets with 7-point tiebreak at 6-6',
        matchUpFormat: 'SET3-S:6/TB7',
      },
      {
        description: 'Two tiebreak sets, 7-point match tiebreak at one set all',
        matchUpFormat: 'SET3-S:6/TB7-F:TB7',
      },
      {
        description: 'Two tiebreak sets, 10-point match tiebreak at one set all',
        matchUpFormat: 'SET3-S:6/TB7-F:TB10',
      },
      {
        description: 'One set set to 6, 7-point tiebreak at 6-6',
        matchUpFormat: 'SET1-S:6/TB7',
      },
      {
        description: 'Best of 3 sets to 4',
        matchUpFormat: 'SET3-S:4/TB7',
      },
      {
        description: 'Two out of three sets to 4 with 5-point tiebreak at 3-3',
        matchUpFormat: 'SET3-S:4/TB5@3',
      },
      {
        description: 'One set to 4, 7-point tiebreak at 4-4',
        matchUpFormat: 'SET1-S:4/TB7',
      },
      {
        description: 'One set to 4, 5-point tiebreak at 3-3',
        matchUpFormat: 'SET1-S:4/TB5@3',
      },
      {
        description: 'Two sets to 4, 10-point match tiebreak at one set all',
        matchUpFormat: 'SET3-S:4/TB7-F:TB10',
      },
      {
        description: 'Two sets to 4, 7-point match tiebreak at one set all',
        matchUpFormat: 'SET3-S:4/TB7-F:TB7',
      },
      {
        description: 'One set to 5, tiebreak to 9 at 4-4',
        matchUpFormat: 'SET1-S:5/TB9@4',
      },
      {
        description: 'One set to 6 with deciding game at 5-5',
        matchUpFormat: 'SET1-S:6NOAD',
      },
      {
        description: 'One set to 4, deciding game is played at 3-3',
        matchUpFormat: 'SET1-S:4NOAD',
      },
      {
        description: '8 game pro-set with 7 point tiebreak at 8-8',
        matchUpFormat: 'SET1-S:8/TB7',
      },
      {
        description: '8 game pro-set with 7 point tiebreak at 7-7',
        matchUpFormat: 'SET1-S:8/TB7@7',
      },
      {
        description: 'Best of 3 10-point tiebreak games',
        matchUpFormat: 'SET3-S:TB10',
      },
      {
        description: 'Timed 20 minute game - game based',
        matchUpFormat: 'SET1-S:T20G',
      },
      {
        description: 'Timed 20 minute game - point based',
        matchUpFormat: 'SET1-S:T20P',
      },
      {
        description: 'Aggregate Points - Four 10 minute quarters',
        matchUpFormat: 'SET4-S:T10P',
      },
    ],
  },
};

export default POLICY_SCORING;
