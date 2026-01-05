# Irregular Ending Support in freeScore Parser

## Overview

The freeScore parser now supports detection of irregular match endings that indicate matches were not completed normally. These endings affect how the score is interpreted and what `matchUpStatus` is returned.

## Supported Irregular Endings

### RETIRED
**Patterns detected**: `ret`, `RET`, `retired`, `retire`, `reti`, or any partial match of "retired"

**Behavior**:
- Score before "retired" is preserved (incomplete score is valid)
- `matchUpStatus` = `"RETIRED"`
- `matchComplete` = `false`
- `incomplete` = `true`

**Examples**:
```
"6-4 3-2 ret" → Sets: [6-4, 3-2], Status: RETIRED
"6-4 retired" → Sets: [6-4], Status: RETIRED
"ret" → Sets: [], Status: RETIRED
```

### WALKOVER
**Patterns detected**: `wo`, `WO`, `w/o`, `walkover`, `walk`, `walko`, or any partial match of "walkover"

**Behavior**:
- **ALL preceding score is removed** (walkover means match didn't start)
- `matchUpStatus` = `"WALKOVER"`
- `matchComplete` = `false`
- `incomplete` = `false` (no score to be incomplete)

**Examples**:
```
"6-4 wo" → Sets: [], Status: WALKOVER (score removed)
"wo" → Sets: [], Status: WALKOVER
"w/o" → Sets: [], Status: WALKOVER
```

### DEFAULTED
**Patterns detected**: `def`, `DEF`, `defaulted`, `default`, `defau`, or any partial match of "defaulted"

**Behavior**:
- Score before "defaulted" is preserved (incomplete score is valid)
- `matchUpStatus` = `"DEFAULTED"`
- `matchComplete` = `false`
- `incomplete` = `true`

**Examples**:
```
"6-4 3-2 def" → Sets: [6-4, 3-2], Status: DEFAULTED
"6-4 defaulted" → Sets: [6-4], Status: DEFAULTED
"def" → Sets: [], Status: DEFAULTED
```

## Implementation Details

### Detection Logic
1. When a non-numeric character is encountered (not a digit, parenthesis, or bracket)
2. The parser checks if the remaining input matches any irregular ending pattern
3. If a match is found:
   - `state.irregularEnding` is set to the ending type
   - `state.irregularEndingPosition` marks where it was detected
   - Parser skips to end of input (all remaining text is consumed)

### Case Insensitivity
All patterns are matched case-insensitively:
- `ret`, `RET`, `Ret`, `ReT` all work
- `wo`, `WO`, `Wo` all work
- `def`, `DEF`, `Def` all work

### Partial Matching
The parser accepts partial words to handle various notations:
- "retired" → "ret", "reti", "retir", "retire", "retired"
- "walkover" → "walk", "walko", "walkov", "walkove", "walkover"
- "defaulted" → "def", "defa", "defau", "defaul", "default", "defaulte", "defaulted"

This flexibility accommodates different scoring conventions and abbreviations.

### SUSPENDED
**Patterns detected**: `susp`, `SUSP`, `suspended`, `suspend`, `suspen`, or any partial match of "suspended"

**Behavior**:
- Score before "suspended" is preserved (match to be resumed)
- `matchUpStatus` = `"SUSPENDED"`
- `matchComplete` = `false`
- `incomplete` = `true`

**Examples**:
```
"6-4 3-2 susp" → Sets: [6-4, 3-2], Status: SUSPENDED
"6-4 suspended" → Sets: [6-4], Status: SUSPENDED
"suspended" → Sets: [], Status: SUSPENDED
```

### CANCELLED
**Patterns detected**: `canc`, `CANC`, `cancelled`, `canceled`, `cancel`, or any partial match

**Behavior**:
- **ALL preceding score is removed** (match won't happen)
- `matchUpStatus` = `"CANCELLED"`
- `matchComplete` = `false`
- `incomplete` = `false`

**Examples**:
```
"6-4 canc" → Sets: [], Status: CANCELLED (score removed)
"cancelled" → Sets: [], Status: CANCELLED
"canceled" → Sets: [], Status: CANCELLED (American spelling)
```

### INCOMPLETE
**Patterns detected**: `inc`, `INC`, `incomplete`, `incomplet`, or any partial match of "incomplete"

**Behavior**:
- Score before "incomplete" is preserved
- `matchUpStatus` = `"INCOMPLETE"`
- `matchComplete` = `false`
- `incomplete` = `true`

**Examples**:
```
"6-4 3-2 inc" → Sets: [6-4, 3-2], Status: INCOMPLETE
"incomplete" → Sets: [], Status: INCOMPLETE
```

### DEAD RUBBER
**Patterns detected**: `dead`, `DEAD`, `dead rubber`, or the word "dead" (with optional "rubber")

**Behavior**:
- **ALL preceding score is removed** (match not played/doesn't count)
- `matchUpStatus` = `"DEAD RUBBER"`
- `matchComplete` = `false`
- `incomplete` = `false`

**Examples**:
```
"6-4 dead" → Sets: [], Status: DEAD RUBBER (score removed)
"dead rubber" → Sets: [], Status: DEAD RUBBER
"6-4 3-2 dead rubber" → Sets: [], Status: DEAD RUBBER
```

### IN PROGRESS
**Patterns detected**: `in prog`, `IN PROGRESS`, `in progress`, or "in" followed by optional "prog/progress"

**Behavior**:
- Score is preserved (match currently being played)
- `matchUpStatus` = `"IN PROGRESS"`
- `matchComplete` = `false`
- `incomplete` = `true`

**Examples**:
```
"6-4 3-2 in prog" → Sets: [6-4, 3-2], Status: IN PROGRESS
"6-4 in progress" → Sets: [6-4], Status: IN PROGRESS
"in progress" → Sets: [], Status: IN PROGRESS
```

### AWAITING RESULT
**Patterns detected**: `await`, `AWAITING`, `awaiting result`, or "await" with optional "ing result"

**Behavior**:
- Score is preserved if provided
- `matchUpStatus` = `"AWAITING RESULT"`
- `matchComplete` = `false`
- `incomplete` can be `true` or `false` depending on score

**Examples**:
```
"6-4 6-3 await" → Sets: [6-4, 6-3], Status: AWAITING RESULT
"awaiting result" → Sets: [], Status: AWAITING RESULT
```

## Score Preservation vs Removal

**Score is PRESERVED** for these statuses:
- RETIRED - player couldn't continue
- DEFAULTED - player disqualified
- SUSPENDED - match paused (to be resumed)
- INCOMPLETE - match not finished (unspecified reason)
- IN PROGRESS - match currently being played
- AWAITING RESULT - match complete, result not recorded

**Score is REMOVED** for these statuses:
- WALKOVER - match didn't start (one player didn't show up)
- CANCELLED - match called off (won't happen)
- DEAD RUBBER - match not played (outcome irrelevant)

## Usage

```typescript
import { parseScore, IrregularEnding } from './freeScore';

// Example: Player retired (score preserved)
const result1 = parseScore('6-4 3-2 ret', 'SET3-S:6/TB7');
console.log(result1.matchUpStatus); // "RETIRED"
console.log(result1.sets.length);   // 2
console.log(result1.matchComplete); // false

// Example: Walkover (score removed)
const result2 = parseScore('6-4 wo', 'SET3-S:6/TB7');
console.log(result2.matchUpStatus); // "WALKOVER"
console.log(result2.sets.length);   // 0 (score removed)

// Example: Defaulted (score preserved)
const result3 = parseScore('6-4 3-2 def', 'SET3-S:6/TB7');
console.log(result3.matchUpStatus); // "DEFAULTED"
console.log(result3.sets.length);   // 2

// Example: Suspended (score preserved)
const result4 = parseScore('6-4 3-2 susp', 'SET3-S:6/TB7');
console.log(result4.matchUpStatus); // "SUSPENDED"
console.log(result4.sets.length);   // 2

// Example: Cancelled (score removed)
const result5 = parseScore('6-4 canc', 'SET3-S:6/TB7');
console.log(result5.matchUpStatus); // "CANCELLED"
console.log(result5.sets.length);   // 0 (score removed)

// Example: In Progress (score preserved)
const result6 = parseScore('6-4 3-2 in prog', 'SET3-S:6/TB7');
console.log(result6.matchUpStatus); // "IN PROGRESS"
console.log(result6.sets.length);   // 2
```

## Testing

See `freeScore.irregular.test.ts` for comprehensive test coverage:
- **41 tests** covering all 9 irregular ending types
- Tests for uppercase, lowercase, partial words
- Tests for score preservation vs removal
- Tests for mixed scenarios with various separators
- Tests for British vs American spellings (cancelled/canceled)
- Tests for full phrases vs abbreviations

**All 41 tests passing** ✅

## Summary Table

| Status | Abbreviations | Score Behavior | Complete? | Incomplete? |
|--------|--------------|----------------|-----------|-------------|
| RETIRED | ret, reti, retire, retired | Preserved | false | true |
| WALKOVER | wo, w/o, walk, walkover | **Removed** | false | false |
| DEFAULTED | def, defau, default, defaulted | Preserved | false | true |
| SUSPENDED | susp, suspend, suspended | Preserved | false | true |
| CANCELLED | canc, cancel, cancelled/canceled | **Removed** | false | false |
| INCOMPLETE | inc, incomplet, incomplete | Preserved | false | true |
| DEAD RUBBER | dead, dead rubber | **Removed** | false | false |
| IN PROGRESS | in prog, in progress | Preserved | false | true |
| AWAITING RESULT | await, awaiting, awaiting result | Preserved | false | varies |
