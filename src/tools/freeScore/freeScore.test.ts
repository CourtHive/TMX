import { describe, it, expect } from 'vitest';
import { runAnalysis, analyzeAllTestCases, analyzeTestCase } from './analyzeFormatCompatibility';
import { governors, matchUpFormatCode } from 'tods-competition-factory';

const { parseScoreString } = governors.scoreGovernor;

describe('FreeScore Parser - Format Analysis', () => {
  it('should debug single test case', () => {
    const testCase = { input: '6-2;2-6;10-2', expectedScore: '6-2 2-6 [10-2]' };
    const format1 = 'SET3-S:6/TB7';
    const format2 = 'SET3-S:4/TB5';
    
    const { validateMatchUpScore } = governors.scoreGovernor;
    
    console.log('\nDEBUG:');
    console.log('Input:', testCase.input);
    console.log('Expected:', testCase.expectedScore);
    
    // Test with SET3-S:6/TB7 format (should match - sets go to 6)
    const parsedFormat1 = matchUpFormatCode.parse(format1);
    const parsedScore1 = parseScoreString({
      scoreString: testCase.expectedScore,
      matchUpFormat: parsedFormat1,
    });
    console.log('\nFormat:', format1);
    console.log('Parsed format:', JSON.stringify(parsedFormat1, null, 2));
    console.log('Parsed score:', JSON.stringify(parsedScore1, null, 2));
    const validation1 = validateMatchUpScore({
      score: { sets: parsedScore1 },
      matchUpFormat: parsedFormat1,
    });
    console.log('Validation result:', validation1);
    
    // Test with SET3-S:4/TB5 format (should NOT match - sets go to 6, not 4)
    const parsedFormat2 = matchUpFormatCode.parse(format2);
    const parsedScore2 = parseScoreString({
      scoreString: testCase.expectedScore,
      matchUpFormat: parsedFormat2,
    });
    console.log('\nFormat:', format2);
    console.log('Parsed format:', JSON.stringify(parsedFormat2, null, 2));
    console.log('Parsed score:', JSON.stringify(parsedScore2, null, 2));
    const validation2 = validateMatchUpScore({
      score: { sets: parsedScore2 },
      matchUpFormat: parsedFormat2,
    });
    console.log('Validation result:', validation2);
  });

  it('should analyze tidyScore test cases for format compatibility', () => {
    const { results, patternGroups } = analyzeAllTestCases();
    
    expect(results.length).toBeGreaterThan(0);
    expect(Object.keys(patternGroups).length).toBeGreaterThan(0);
    
    console.log(`\nAnalyzed ${results.length} test cases`);
    console.log('Format compatibility distribution:');
    Object.keys(patternGroups).forEach((key) => {
      console.log(`  ${key}: ${patternGroups[key].length} cases`);
    });
  });

  it('should run full analysis and output results', () => {
    const results = runAnalysis();
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
  });
});
