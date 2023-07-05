import { matchUpTypes, policyConstants } from 'tods-competition-factory';

const { POLICY_TYPE_SCHEDULING } = policyConstants;
const { DOUBLES, SINGLES } = matchUpTypes;

export const POLICY_SCHEDULING = {
  [POLICY_TYPE_SCHEDULING]: {
    defaultTimes: {
      recoveryTimes: [{ minutes: { [DOUBLES]: 30, default: 60 } }],
      averageTimes: [{ minutes: { default: 90 } }]
    },
    defaultDailyLimits: {
      [SINGLES]: 2,
      [DOUBLES]: 2,
      total: 3
    },
    matchUpAverageTimes: [
      {
        matchUpFormatCodes: ['SET3-S:6/TB7'],
        averageTimes: [{ minutes: { default: 90 } }]
      },
      {
        matchUpFormatCodes: ['SET3-S:6/TB7-F:TB10'],
        averageTimes: [{ categoryNames: [], minutes: { default: 85 } }]
      },
      {
        matchUpFormatCodes: ['SET3-S:6/TB7-F:TB7'],
        averageTimes: [{ categoryNames: [], minutes: { default: 70 } }]
      },
      {
        matchUpFormatCodes: ['SET3-S:4NOAD-F:TB7'],
        averageTimes: [{ categoryNames: [], minutes: { default: 55 } }]
      },
      {
        matchUpFormatCodes: ['SET3-S:4/TB7'],
        averageTimes: [{ categoryNames: [], minutes: { default: 60 } }]
      },
      {
        matchUpFormatCodes: ['SET3-S:4/TB7-F:TB7'],
        averageTimes: [{ categoryNames: [], minutes: { default: 50 } }]
      },
      {
        matchUpFormatCodes: ['SET3-S:4/TB7-F:TB10'],
        averageTimes: [{ categoryNames: [], minutes: { default: 55 } }]
      },
      {
        matchUpFormatCodes: ['SET3-S:4/TB5@3'],
        averageTimes: [{ categoryNames: [], minutes: { default: 45 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:8/TB7', 'SET1-S:8/TB7@7'],
        averageTimes: [{ categoryNames: [], minutes: { default: 40 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:5/TB9@4'],
        averageTimes: [{ categoryNames: [], minutes: { default: 30 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:6/TB7'],
        averageTimes: [{ categoryNames: [], minutes: { default: 30 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:6NOAD'],
        averageTimes: [{ categoryNames: [], minutes: { default: 30 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:4/TB7', 'SET1-S:4/TB5@3', 'SET3-S:TB10', 'SET1-S:T20'],
        averageTimes: [{ categoryNames: [], minutes: { default: 20 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:4NOAD'],
        averageTimes: [{ categoryNames: [], minutes: { default: 20 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:TB10'],
        averageTimes: [{ categoryNames: [], minutes: { default: 10 } }]
      }
    ],
    matchUpRecoveryTimes: [
      {
        matchUpFormatCodes: ['SET3-S:6/TB7-F:TB10', 'SET3-S:6/TB7-F:TB7', 'SET3-S:6/TB7'],
        recoveryTimes: [{ minutes: { default: 60, [DOUBLES]: 60 } }]
      },
      {
        matchUpFormatCodes: [
          'SET3-S:4/TB7-F:TB7',
          'SET3-S:4/TB7-F:TB10',
          'SET3-S:4NOAD-F:TB7',
          'SET3-S:4/TB5@3',
          'SET3-S:4/TB7'
        ],
        recoveryTimes: [{ minutes: { default: 60 } }]
      },
      {
        matchUpFormatCodes: [
          'SET1-S:8/TB7@7',
          'SET1-S:5/TB9@4',
          'SET1-S:8/TB7',
          'SET1-S:6/TB7',
          'SET1-S:6NOAD',
          'SET1-S:4/TB7',
          'SET1-S:4NOAD',
          'SET3-S:TB10',
          'SET1-S:T20'
        ],
        recoveryTimes: [{ minutes: { default: 30 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:4/TB5@3'],
        recoveryTimes: [{ minutes: { default: 30 } }]
      },
      {
        matchUpFormatCodes: ['SET1-S:TB10'],
        recoveryTimes: [{ minutes: { default: 15 } }]
      }
    ],
    matchUpDailyLimits: []
  }
};

export default POLICY_SCHEDULING;
