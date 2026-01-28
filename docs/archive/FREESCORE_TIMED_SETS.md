# FreeScore Support for Timed Sets

## Overview
Extended freeScore parser to handle timed sets with exactly format (e.g., `SET3X-S:T10`) using simple literal parsing instead of smart logic.

## Problem
The existing freeScore parser uses sophisticated digit disambiguation and smart complement logic:
- Auto-detects tiebreaks from patterns like "67 3" → "6-7(3)"
- Tries to be smart about digit sequences like "123" → "12-3" or "1-23"
- Uses format context to make assumptions

**This doesn't work for timed sets** because:
- Scores have no relationship requirements
- Any numeric values are valid (0-100+)
- No tiebreaks exist
- Exact set count must be enforced

## Solution

### Detection Logic
Added early detection in `parseScore()`:

```typescript
const isTimed = !!(parsedFormat.setFormat?.timed || parsedFormat.finalSetFormat?.timed);
const isExactlyFormat = !!parsedFormat.exactly || parsedFormat.bestOf === 1;

if (isTimed && isExactlyFormat) {
  return parseTimedExactlyScore(input, parsedFormat);
}
```

### New Parser Function
Created `parseTimedExactlyScore()` with simplified logic:

1. **Split by whitespace**: `"5-3 2-7 4-4".split(/\s+/)`
2. **Match each set**: `/^(\d+)-(\d+)$/` (simple "#-#" pattern)
3. **Validate count**: Must equal `exactly` or `bestOf` value
4. **No smart logic**: Takes input literally

### Input Format
**Required format:** `#-# #-# #-#` (space-separated sets)

**Examples:**
- `SET3X-S:T10`: Must enter `5-3 2-7 4-4` (3 sets)
- `SET2X-S:T20`: Must enter `10-8 15-12` (2 sets)
- `SET1-S:T10`: Must enter `7-5` (1 set)

### Validation

**Valid inputs:**
```
5-3 2-7 4-4          ✓ (3 sets for SET3X)
0-0 0-0 0-0          ✓ (any values allowed)
100-50 75-80 60-65   ✓ (no max limit)
```

**Invalid inputs:**
```
5-3 2-7              ✗ Need 3 sets, got 2
5-3 2-7 4-4 6-2      ✗ Too many sets: got 4, expected 3
5                    ✗ Invalid format (needs "#-#")
5 3                  ✗ Interpreted as 2 separate sets, not 1
5-3(7)               ✗ Tiebreak notation not supported
5-3 abc              ✗ Set 2: Invalid format "abc"
```

### Error Messages

**Missing sets:**
```
Input: "5-3 2-7"
Error: (none shown until complete)
Suggestion: "Need 1 more set"
Incomplete: true
```

**Too many sets:**
```
Input: "5-3 2-7 4-4 6-2" 
Error: "Too many sets: got 4, expected exactly 3"
Valid: false
```

**Invalid format:**
```
Input: "5-3 abc 4-4"
Error: "Set 2: Invalid format \"abc\". Expected \"#-#\" (e.g., \"5-3\")"
Valid: false
```

## User Experience

### Typing Experience (SET3X-S:T10)

| Input | Formatted | Valid | Message |
|-------|-----------|-------|---------|
| (empty) | - | ❌ | Suggestion: Enter 3 sets in format: #-# #-# ... |
| `5` | - | ❌ | Incomplete |
| `5-3` | `5-3` | ❌ | Suggestion: Need 2 more sets |
| `5-3 2` | `5-3` (partial) | ❌ | Incomplete |
| `5-3 2-7` | `5-3 2-7` | ❌ | Suggestion: Need 1 more set |
| `5-3 2-7 4` | `5-3 2-7` (partial) | ❌ | Incomplete |
| `5-3 2-7 4-4` | `5-3 2-7 4-4` | ✅ | Valid - can submit! |

### Comparison: Timed vs Regular

**Timed Sets (SET3X-S:T10):**
```
Input: "5 3 2 7"
Result: ERROR - Set 1: Invalid format "5"
Reason: Expects "#-#" literally
```

**Regular Sets (SET3-S:6/TB7):**
```
Input: "5 3 2 7"  
Result: "5-3 2-7" (smart parsing)
Reason: Uses digit disambiguation
```

## Implementation Details

### Code Location
`/src/tools/freeScore/freeScore.ts`

**Lines 328-415:** New `parseTimedExactlyScore()` function

**Lines 362-369:** Detection and routing in `parseScore()`

### Return Type
Returns `ParseResult` with:
- `valid`: true only when all sets present and no errors
- `sets`: Array of `ParsedSet` (no `winningSide` for timed)
- `errors`: Array of format/count errors
- `suggestions`: Helpful hints for incomplete input
- `incomplete`: true when fewer sets than expected
- `matchComplete`: true when exact count reached

### No Side Effects
- Regular set parsing unchanged
- Only affects timed + exactly format combination
- Falls through to existing parser for all other cases

## Testing

### Manual Test Cases

1. **Basic valid input:**
   ```
   Format: SET3X-S:T10
   Input: 5-3 2-7 4-4
   Expected: Valid, 3 sets parsed
   ```

2. **Incomplete input:**
   ```
   Format: SET3X-S:T10
   Input: 5-3 2-7
   Expected: Invalid, suggestion to add 1 more set
   ```

3. **Too many sets:**
   ```
   Format: SET3X-S:T10
   Input: 5-3 2-7 4-4 6-2
   Expected: Error - too many sets
   ```

4. **Invalid format:**
   ```
   Format: SET3X-S:T10
   Input: 5-3 abc 4-4
   Expected: Error - Set 2 invalid format
   ```

5. **Single set (bestOf:1):**
   ```
   Format: SET1-S:T10
   Input: 7-5
   Expected: Valid, 1 set parsed
   ```

6. **Regular format unchanged:**
   ```
   Format: SET3-S:6/TB7
   Input: 63 46 76 5
   Expected: Smart parsing still works
   ```

## Benefits

1. **Clear Expectations**: Users know they must enter exact format
2. **No Ambiguity**: No smart guessing for timed sets
3. **Better Errors**: Clear messages about what's wrong
4. **Enforces Rules**: Can't submit until exact count reached
5. **Predictable**: Same input always produces same output
6. **Backwards Compatible**: Regular formats unaffected
