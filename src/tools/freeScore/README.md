# freeScore Parser

**Intelligent, format-aware tennis score parser for free-form user input**

## Overview

The freeScore parser accepts free-form score input and intelligently interprets it using `matchUpFormat` context. It uses a character-by-character state machine to handle ambiguous digit sequences, incomplete scores, and various notations without requiring strict formatting.

## Key Features

### 1. **Format-Aware Parsing**
Uses `matchUpFormat` (from `tods-competition-factory`) to:
- Determine valid score ranges (setTo, tiebreakAt, tiebreakTo)
- Apply correct tiebreak rules (TB7, TB10, TB12)
- Handle final set formats (F:TB10, F:TB7, etc.)
- Support specialized formats (Fast4, pro sets, short sets)

### 2. **Flexible Input Notation**
Accepts scores with or without separators:
- `"6-4 6-3"` (standard with dashes)
- `"6463"` (no separators - auto-detects boundaries)
- `"6 4 6 3"` (spaces only)
- `"6,4;6 3"` (mixed separators)
- `"67(5)64"` (embedded tiebreaks)

### 3. **Intelligent Lookahead**
- Auto-detects set boundaries based on format constraints
- Prevents invalid two-digit combinations (e.g., "10" when max is 7)
- Handles tiebreak-only sets (match tiebreaks)
- Infers tiebreak scores when only losing score provided

### 4. **Irregular Ending Detection**
Recognizes 9 matchUpStatus types using `matchUpStatusConstants` from factory:
- **RETIRED** - Player couldn't continue (score preserved)
- **WALKOVER** - Match didn't start (score removed)
- **DEFAULTED** - Player disqualified (score preserved)
- **SUSPENDED** - Match paused (score preserved)
- **CANCELLED** - Match called off (score removed)
- **INCOMPLETE** - Not finished (score preserved)
- **DEAD_RUBBER** - Not played (score removed)
- **IN_PROGRESS** - Currently playing (score preserved)
- **AWAITING_RESULT** - Completed, awaiting confirmation (score preserved)

See [IRREGULAR_ENDINGS.md](./IRREGULAR_ENDINGS.md) for full details.

### 5. **Real-Time Parsing**
- Handles incomplete scores (user typing)
- Provides confidence scores
- Identifies ambiguities
- Offers suggestions for unclear input

## Architecture

### State Machine
Character-by-character processing with states:
- `START` - Initial state
- `PARSING_SIDE1` - Reading first player's score
- `PARSING_SIDE2` - Reading second player's score  
- `PARSING_TIEBREAK_SIDE1` - Reading tiebreak score 1
- `PARSING_TIEBREAK_SIDE2` - Reading tiebreak score 2
- `SET_COMPLETE` - Set finalized
- `MATCH_COMPLETE` - Match finalized
- `ERROR` - Parse error

### Key Components

#### 1. **Format Detection**
```typescript
function getSetFormat(parsedFormat: ParsedFormat, setIndex: number)
```
- Determines format for specific set
- Handles `finalSetFormat` for deciding sets
- Returns set-specific rules (setTo, tiebreakAt, tiebreakTo)

#### 2. **Lookahead Logic**
```typescript
// In PARSING_SIDE1
if (currentBuffer + nextDigit > maxGameScore) {
  // Current buffer complete, transition to PARSING_SIDE2
}
```
- Checks if next digit would exceed format limits
- Auto-transitions between states
- Enables parsing without explicit separators

#### 3. **Set Finalization**
```typescript
function finalizeSet(state: ParserState)
```
- Creates `ParsedSet` with scores
- Determines winning side
- Infers tiebreak scores if needed
- Checks if next set is tiebreak-only
- Resets buffers for next set

#### 4. **Irregular Ending Detection**
```typescript
function detectIrregularEnding(input: string, startPos: number)
```
- Pattern matching for status keywords
- Returns `matchUpStatusConstants` values
- Case-insensitive, supports partial words

## Usage

### Basic Parsing

```typescript
import { parseScore } from './freeScore';

const result = parseScore('6-4 6-3', 'SET3-S:6/TB7');

console.log(result);
// {
//   valid: true,
//   formattedScore: '6-4 6-3',
//   sets: [
//     { side1Score: 6, side2Score: 4, setNumber: 1, winningSide: 1 },
//     { side1Score: 6, side2Score: 3, setNumber: 2, winningSide: 1 }
//   ],
//   confidence: 1.0,
//   errors: [],
//   warnings: [],
//   incomplete: false,
//   matchComplete: true,
//   matchUpStatus: undefined
// }
```

### Without Separators

```typescript
const result = parseScore('6463', 'SET3-S:6/TB7');
// Interprets as "6-4 6-3" based on format constraints
```

### With Tiebreaks

```typescript
const result = parseScore('67(5)64', 'SET3-S:6/TB7');
// Parses as "6-7(5) 6-4"
// Infers side2 tiebreak score as 7 (winning score)
```

### Match Tiebreak (Tiebreak-Only Final Set)

```typescript
const result = parseScore('64 46 106', 'SET3-S:6/TB7-F:TB10');
// Parses as "6-4 4-6 [10-6]"
// Detects final set is tiebreak-only from format
```

### With Irregular Ending

```typescript
const result = parseScore('6-4 3-2 ret', 'SET3-S:6/TB7');
// {
//   matchUpStatus: 'RETIRED',  // Uses matchUpStatusConstants.RETIRED
//   sets: [{ side1Score: 6, side2Score: 4 }, { side1Score: 3, side2Score: 2 }],
//   matchComplete: false,
//   incomplete: true
// }
```

## API

### parseScore(input, matchUpFormat)

**Parameters:**
- `input: string` - Free-form score string
- `matchUpFormat: string | ParsedFormat` - Format code or parsed format object

**Returns:** `ParseResult`
```typescript
interface ParseResult {
  valid: boolean;              // Parse succeeded
  formattedScore: string;      // Normalized score string
  sets: ParsedSet[];           // Array of set objects
  confidence: number;          // 0.0 to 1.0
  errors: ParseError[];        // Parse errors with position
  warnings: string[];          // Warnings (e.g., exceeds max)
  ambiguities: string[];       // Ambiguous interpretations
  suggestions: string[];       // Alternative interpretations
  incomplete: boolean;         // Score incomplete
  matchComplete: boolean;      // Match finished normally
  matchUpStatus?: string;      // Irregular ending (uses matchUpStatusConstants)
}
```

### ParsedSet

```typescript
interface ParsedSet {
  side1Score?: number;
  side2Score?: number;
  side1TiebreakScore?: number;
  side2TiebreakScore?: number;
  winningSide?: number;        // 1 or 2
  setNumber: number;
}
```

## Validation

The parser provides warnings for:
- Scores exceeding format limits (e.g., "10-2" when setTo:6)
- Incomplete tiebreaks
- Invalid set combinations
- Ambiguous digit sequences

Warnings don't invalidate the parse - they inform about potential issues.

## Examples

### Pro Set
```typescript
parseScore('8-6', 'SET1-S:8/TB7')
// Single set to 8 games
```

### Fast4 Format
```typescript
parseScore('4-3(5) 4-2', 'SET3-S:4/TB5@3')
// Sets to 4, tiebreak at 3-3, TB5
```

### Best of 5
```typescript
parseScore('6-4 4-6 6-3 4-6 6-2', 'SET5-S:6/TB7')
// Standard best of 5
```

### Short Sets
```typescript
parseScore('4-2 2-4 4-3', 'SET3-S:4/TB7')
// Sets to 4 games
```

## Integration with Factory

The freeScore parser uses several factory exports:
- `matchUpFormatCode` - For parsing format codes
- `matchUpStatusConstants` - For irregular endings (RETIRED, WALKOVER, etc.)
- `ParsedFormat` type - For format structure

This ensures consistency with the rest of the TMX/Factory ecosystem.

## Testing

Comprehensive test coverage across 3 test files:

### freeScore.parser.test.ts (24 tests)
- Basic score parsing with/without separators
- Tiebreak parsing (regular and match tiebreaks)
- Format-aware disambiguation
- Error handling
- Confidence scoring

### freeScore.irregular.test.ts (41 tests)
- All 9 irregular ending types
- Uppercase/lowercase/partial words
- Score preservation vs removal logic
- British/American spelling variants
- Multi-word phrases

### freeScore.test.ts (3 tests)
- Format compatibility analysis
- Integration with tidyScore test cases

**Total: 68/68 tests passing ✅**

## Documentation

- [README.md](./README.md) - This file (overview and API)
- [IRREGULAR_ENDINGS.md](./IRREGULAR_ENDINGS.md) - Detailed irregular ending documentation
- [MATCHUP_FORMAT_LOGIC.md](./MATCHUP_FORMAT_LOGIC.md) - Format scoring rules reference

## Performance

- Character-by-character parsing: O(n) where n = input length
- No backtracking or regex-heavy operations
- Efficient lookahead (single character peek)
- Minimal memory allocation (reuses state object)

## Future Enhancements

Potential additions:
1. **Confidence scoring** - Currently always 1.0, could analyze ambiguities
2. **Suggestions** - Provide alternative interpretations for ambiguous input
3. **Error recovery** - Continue parsing after errors to provide partial results
4. **Undo/redo** - For interactive score entry
5. **Real-time validation** - As user types, provide immediate feedback

## Related Files

- `freeScore.ts` - Main parser implementation
- `freeScore.parser.test.ts` - Parser tests
- `freeScore.irregular.test.ts` - Irregular ending tests
- `freeScore.test.ts` - Format analysis tests
- `analyzeFormatCompatibility.ts` - Format compatibility tools
- `extractTidyScoreData.ts` - Test data extraction

## Contributing

When extending the parser:
1. Add tests first (TDD approach)
2. Maintain backward compatibility
3. Update documentation
4. Use factory constants (don't define new ones locally)
5. Run all tests: `npm test -- freeScore`
6. Check linting: `npx eslint src/tools/freeScore/freeScore.ts`

---

**Status**: Production-ready ✅  
**Version**: TMX 3.0.60+  
**Last Updated**: 2026-01-04
