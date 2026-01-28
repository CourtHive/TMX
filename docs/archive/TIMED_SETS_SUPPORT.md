# Timed Sets Support in Dynamic Sets Modal

## Overview
Added support for timed sets with `exactly` format (e.g., `SET3X-S:T10`) in the dynamicSets scoring modal.

## Key Concepts

### Timed Sets
- Format: `SET3X-S:T10` (exactly 3 sets, 10 minutes each)
- Scores represent points/games scored within the time limit
- Scores have **no relationship requirements** (no minimum, no maximum)
- Winner is NOT determined by set scores - determined externally by other factors

### Exactly Format
- `exactly: N` - Play exactly N sets (vs `bestOf: N` which is first to win ceil(N/2))
- Can be any number: 1, 2, 3, 4, 5
- `bestOf: 1` is functionally equivalent to `exactly: 1` (both play 1 set)

## Changes Made

### 1. setExpansionLogic.ts
**Updated `parseMatchUpFormat()`:**
- Now uses `matchUpFormatCode.parse()` from factory for detailed parsing
- Detects `isTimed` and `isExactlyFormat` flags
- Returns `exactly` count when present

**Updated `shouldExpandSets()`:**
- For exactly/bestOf:1 formats: Shows all sets immediately upon modal open
- For regular bestOf formats: Uses dynamic expansion (existing behavior)
- This ensures all set rows are visible for timed/exactly formats

### 2. dynamicSetsLogic.ts
**Added `isSetTimed()` function:**
```typescript
export function isSetTimed(format?: SetFormat): boolean {
  return format?.timed === true && format?.minutes !== undefined;
}
```

**Updated `getMaxAllowedScore()`:**
- Returns `Infinity` for timed sets
- No validation of score relationships for timed sets

**Updated `isSetComplete()`:**
- For timed sets: Complete when both sides have values
- No score relationship requirements

**Updated `shouldShowTiebreak()`:**
- Timed sets never show tiebreak input
- Returns `false` immediately for timed sets

**Updated `SetFormat` type:**
- Added `timed?: boolean` and `minutes?: number` properties

### 3. scoreValidator.ts
**Updated `validateSetScores()`:**
- Detects timed + exactly/bestOf:1 formats early in validation
- For these formats:
  - Only checks that all sets have both scores
  - Validates set count matches expected (`exactly` or `bestOf`)
  - **No winningSide** assigned (winner determined externally)
  - Allows submission when all sets are filled
- Bypasses complex tennis scoring validation for timed sets

## Validation Rules

### Timed Sets (exactly/bestOf:1)
✅ Valid when:
- All sets have both side1 and side2 scores
- Number of sets matches expected count
- Any numeric values are acceptable (0-infinity)

❌ Invalid when:
- Missing scores on any set
- Wrong number of sets

### Regular Sets (bestOf with standard scoring)
- Existing validation rules still apply
- Tennis scoring relationships enforced
- Winner determined by set scores

## Example Formats

### ✅ Timed Exactly Formats (New Support)
- `SET3X-S:T10` - Exactly 3 sets, 10 minutes each
- `SET4X-S:T15` - Exactly 4 sets, 15 minutes each
- `SET2X-S:T20` - Exactly 2 sets, 20 minutes each
- `SET1-S:T10` - BestOf 1 (functionally same as exactly 1)

### ✅ Regular BestOf Formats (Existing)
- `SET3-S:6/TB7` - Best of 3 sets to 6
- `SET5-S:6/TB7` - Best of 5 sets to 6

## User Experience

### Opening Modal with Timed Sets
1. All set input rows display immediately
2. Example: `SET3X-S:T10` shows 3 rows upon open
3. No dynamic expansion - all rows visible from start

### Score Entry
1. Enter any numeric values for each set
2. No validation errors for score relationships
3. No tiebreak inputs shown
4. Submit enabled when all sets have values

### Submission
- Can submit when all sets filled
- No winningSide required
- Winner determined by external logic (total points, etc.)

## Testing Checklist

- [ ] Open modal with `SET3X-S:T10` - should show 3 set rows immediately
- [ ] Enter scores like 5-3, 2-7, 4-4 - should all be valid
- [ ] Verify no tiebreak inputs appear
- [ ] Submit button enables when all 3 sets filled
- [ ] Scores can be any values (0-100, etc.) without validation errors
- [ ] Open with `SET1-S:T10` - should show 1 set row
- [ ] Regular formats like `SET3-S:6/TB7` still work correctly

## FreeScore Support for Timed Sets

### Changes to freeScore.ts

**New Function: `parseTimedExactlyScore()`**
- Simple parser specifically for timed sets with exactly format
- No smart logic or digit disambiguation
- Expects exact format: `#-# #-# #-#` (space-separated)
- Validates exact set count matches expected

**Detection Logic:**
```typescript
const isTimed = !!(parsedFormat.setFormat?.timed || parsedFormat.finalSetFormat?.timed);
const isExactlyFormat = !!parsedFormat.exactly || parsedFormat.bestOf === 1;

if (isTimed && isExactlyFormat) {
  return parseTimedExactlyScore(input, parsedFormat);
}
```

### User Experience in FreeScore Modal

**For `SET3X-S:T10` (Timed Exactly):**
- Input: `5-3 2-7 4-4`
- Validation: Must enter exactly 3 sets
- No smart complement (typing "5" doesn't auto-add "-3")
- No tiebreak detection
- Format errors shown: `Set 2: Invalid format "abc". Expected "#-#"`

**For `SET3-S:6/TB7` (Regular BestOf):**
- Smart logic still applies (existing behavior)
- Tiebreak auto-detection works
- Complement logic active

### Validation Rules

✅ Valid timed exactly input:
- `5-3 2-7 4-4` (exactly 3 sets for SET3X)
- `10-8 15-12` (exactly 2 sets for SET2X)
- `7-5` (exactly 1 set for SET1)

❌ Invalid timed exactly input:
- `5-3 2-7` (only 2 sets when 3 expected)
- `5-3 2-7 4-4 6-2` (4 sets when 3 expected)
- `5` (incomplete set)
- `5 3` (interpreted as 2 sets, not 1)
- `5-3(7)` (tiebreak notation not supported for timed)

## Future Enhancements

1. **Winner Determination**: Add UI to manually select winner for timed sets
2. **Point Totals**: Show running total of points across sets
3. **Time Tracking**: Display time remaining/elapsed per set
4. **Mixed Formats**: Support different formats per set (e.g., first 2 timed, last regular)
