/**
 * MatchUp format constants
 * Generated from matchUpFormats.json for use in tests
 */

// Standard tennis formats
export const MATCH_FORMATS = {
  // Best of 3 sets
  SET3_S6_TB7: 'SET3-S:6/TB7',
  SET3_S6_TB7_F_TB10: 'SET3-S:6/TB7-F:TB10',
  SET3_S6_TB10: 'SET3-S:6/TB10',
  SET3_S6_F_TB10: 'SET3-S:6-F:TB10',
  SET3_S6_TB7_NOAD: 'SET3-S:6/TB7NOAD',
  SET3_S8_TB7: 'SET3-S:8/TB7',
  SET3_S8_TB7_AT7: 'SET3-S:8/TB7@7',
  SET3_S4_TB7: 'SET3-S:4/TB7',
  SET3_S4_TB7_F_TB10: 'SET3-S:4/TB7-F:TB10',
  SET3_S4_TB5_AT3_F_TB10: 'SET3-S:4/TB5@3-F:TB10',
  
  // Best of 5 sets
  SET5_S6_TB7: 'SET5-S:6/TB7',
  SET5_S6_TB7_F_TB10: 'SET5-S:6/TB7-F:TB10',
  
  // Single set formats
  SET1_S6_TB7: 'SET1-S:6/TB7',
  SET1_S6_TB10: 'SET1-S:6/TB10',
  SET1_S6_TB7_AT5: 'SET1-S:6/TB7@5',
  SET1_S8_TB7: 'SET1-S:8/TB7',
  SET1_S4_TB7: 'SET1-S:4/TB7',
  SET1_S5_TB9_AT4: 'SET1-S:5/TB9@4',
  
  // Tiebreak-only formats
  SET1_S_TB7: 'SET1-S:T7',
  SET1_S_TB10: 'SET1-S:TB10',
  SET1_S_TB21: 'SET1-S:T21',
  
  // Pro sets
  SET1_S8: 'SET1-S:8',
  SET1_S10: 'SET1-S:10',
  
  // Fast4 format
  FAST4: 'SET5-S:4/NOAD',
  
  // Timed sets with aggregate scoring and conditional TB
  SET3X_T10A_TB1: 'SET3X-S:T10A-F:TB1',
  SET3X_T10A_TB1_NOAD: 'SET3X-S:T10A-F:TB1NOAD',
  SET4X_T10A_TB1: 'SET4X-S:T10A-F:TB1',
} as const;

// Type helper for format values
export type MatchUpFormatCode = typeof MATCH_FORMATS[keyof typeof MATCH_FORMATS];
