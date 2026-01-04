/**
 * Script to populate matchesMatchUpFormats for each test case
 * Run this to update extractTidyScoreData.ts with format compatibility info
 */

import { analyzeAllTestCases } from './analyzeFormatCompatibility';
import { tidyScoreTestCases } from './extractTidyScoreData';
import { MATCH_FORMATS } from '../../constants/matchUpFormats';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create reverse mapping from format code to constant name
const formatToConstant: Record<string, string> = {};
for (const [key, value] of Object.entries(MATCH_FORMATS)) {
  formatToConstant[value] = `MATCH_FORMATS.${key}`;
}

export function populateFormatMatches() {
  console.log('Analyzing test cases and populating format matches...\n');
  
  const { results } = analyzeAllTestCases();
  
  // Update each test case with its compatible formats
  results.forEach((result, index) => {
    if (tidyScoreTestCases[index]) {
      tidyScoreTestCases[index].matchesMatchUpFormats = result.compatibleFormats.map(f => f.format);
    }
  });
  
  // Generate the updated file content
  const fileContent = generateFileContent();
  
  // Write to file
  const filePath = path.join(__dirname, 'extractTidyScoreData.ts');
  fs.writeFileSync(filePath, fileContent, 'utf8');
  
  console.log(`✓ Updated ${filePath}`);
  console.log(`✓ Populated format matches for ${results.length} test cases`);
  
  // Print summary
  const withFormats = results.filter(r => r.compatibleFormats.length > 0).length;
  const noFormats = results.filter(r => r.compatibleFormats.length === 0).length;
  console.log(`\nSummary:`);
  console.log(`  ${withFormats} cases with format matches`);
  console.log(`  ${noFormats} cases with no matches (likely walkovers)`);
}

function generateFileContent(): string {
  return `/**
 * Extract test data from factory tidyScore tests
 * to inform freeScore parser development
 */

import { MATCH_FORMATS } from '../../constants/matchUpFormats';

export interface TidyScoreTestCase {
  input: string;
  expectedScore?: string;
  expectedMatchUpStatus?: string;
  matchesMatchUpFormats?: string[];
}

/**
 * Aggregated array of user input strings from tidyScore test suite
 * Each entry represents a real-world score entry example
 * matchesMatchUpFormats populated by analyzeFormatCompatibility
 */
export const tidyScoreTestCases: TidyScoreTestCase[] = [
${tidyScoreTestCases.map(tc => {
  const parts: string[] = [];
  parts.push(`    input: '${tc.input.replace(/'/g, "\\'")}'`);
  if (tc.expectedScore !== undefined) {
    parts.push(`expectedScore: '${tc.expectedScore}'`);
  }
  if (tc.expectedMatchUpStatus) {
    parts.push(`expectedMatchUpStatus: '${tc.expectedMatchUpStatus}'`);
  }
  if (tc.matchesMatchUpFormats && tc.matchesMatchUpFormats.length > 0) {
    // Convert format codes to constant references
    const formatRefs = tc.matchesMatchUpFormats
      .map(format => formatToConstant[format] || `'${format}'`)
      .join(', ');
    parts.push(`matchesMatchUpFormats: [${formatRefs}]`);
  }
  return `  { ${parts.join(', ')} }`;
}).join(',\n')}
];
`;
}

// Run if executed directly
populateFormatMatches();
