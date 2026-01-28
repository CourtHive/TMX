# Tie Resolution for Timed Aggregate Scoring

## Problem Statement

With aggregate scoring in timed sets, ties are possible at two levels:

### 1. Set-Level Ties
Individual sets can end with equal scores:
```
SET3X-S:T10A
Set 1: 20-20 (no winningSide)
Set 2: 25-22 (side1 wins)
Set 3: 18-21 (side2 wins)

Aggregate: 63-63 → MATCH TIED
```

### 2. Match-Level Ties
Overall aggregate can be tied after all sets complete:
```
SET2X-S:T20A
Set 1: 50-40 (side1 wins set, +10 margin)
Set 2: 40-50 (side2 wins set, +10 margin)

Aggregate: 90-90 → MATCH TIED
```

## Solution: Single Point Tiebreak (TB1)

### Format Notation
`SET{N}X-S:T{minutes}A-F:TB1`

**Components:**
- `SET{N}X` - Exactly N sets
- `S:T{minutes}A` - Timed sets with Aggregate scoring
- `F:TB1` - Final set is 1-point tiebreak (sudden death)

### Examples

**Example 1: Three Timed Sets with TB1**
```
Format: SET3X-S:T10A-F:TB1

Regular play:
  Set 1: 20-20 (tie)
  Set 2: 25-22 (side1)
  Set 3: 18-21 (side2)
  Aggregate: 63-63 (TIED)

Tiebreak needed:
  Set 4: [1-0] (side1 wins single point)

Final result: side1 wins match
Score display: 20-20 25-22 18-21 [1-0]
```

**Example 2: Two Timed Sets with TB1**
```
Format: SET2X-S:T20A-F:TB1

Regular play:
  Set 1: 55-45 (side1)
  Set 2: 45-55 (side2)
  Aggregate: 100-100 (TIED)

Tiebreak needed:
  Set 3: [0-1] (side2 wins single point)

Final result: side2 wins match
Score display: 55-45 45-55 [0-1]
```

**Example 3: Clear Winner (No TB1 Needed)**
```
Format: SET3X-S:T10A-F:TB1

Regular play:
  Set 1: 30-25 (side1)
  Set 2: 22-28 (side2)
  Set 3: 35-30 (side1)
  Aggregate: 87-83 (side1 wins)

No tiebreak needed!
Final result: side1 wins match
Score display: 30-25 22-28 35-30
```

## Implementation Details

### 1. Factory Parse/Stringify

**Parse `F:TB1`:**
```typescript
parse('SET3X-S:T10A-F:TB1') → {
  exactly: 3,
  setFormat: {
    timed: true,
    minutes: 10,
    timedScoringMethod: 'aggregate'
  },
  finalSetFormat: {
    tiebreakSet: {
      tiebreakTo: 1
    }
  }
}
```

**Stringify:**
```typescript
stringify({
  exactly: 3,
  setFormat: { timed: true, minutes: 10, timedScoringMethod: 'aggregate' },
  finalSetFormat: { tiebreakSet: { tiebreakTo: 1 } }
}) → 'SET3X-S:T10A-F:TB1'
```

### 2. Winner Determination Logic

**Algorithm:**
```typescript
function determineWinner(sets, matchUpFormat) {
  const parsed = parse(matchUpFormat);
  
  if (parsed.setFormat.timedScoringMethod === 'aggregate') {
    // Sum scores from timed sets (exclude final TB1 if present)
    const hasTB1 = parsed.finalSetFormat?.tiebreakSet?.tiebreakTo === 1;
    const setsToSum = hasTB1 ? sets.length - 1 : sets.length;
    
    let side1Total = 0;
    let side2Total = 0;
    
    for (let i = 0; i < setsToSum; i++) {
      side1Total += sets[i].side1Score || 0;
      side2Total += sets[i].side2Score || 0;
    }
    
    // Check aggregate winner
    if (side1Total > side2Total) return 1;
    if (side2Total > side1Total) return 2;
    
    // Tie - check for TB1
    if (hasTB1 && sets.length > setsToSum) {
      const tb1Set = sets[setsToSum];
      return tb1Set.winningSide;
    }
    
    // Tie with no resolution
    return undefined;
  }
  
  // ... games-based logic
}
```

### 3. Set-Level Tie Handling

**Individual set ties are OK:**
```typescript
// parseScoreString for "20-20"
{
  side1Score: 20,
  side2Score: 20,
  winningSide: undefined,  // ← No winner for tied set
  setNumber: 1
}
```

**This is valid** - sets don't need winners in aggregate scoring.

### 4. TB1 Validation

**Valid TB1 scores:**
- `[1-0]` - side1 wins
- `[0-1]` - side2 wins
- `[2-1]` - also valid (if they mistakenly played more than 1 point)

**Validation rules:**
- TB1 must have a winningSide (can't be tied)
- Scores must differ by at least 1
- No NoAD rules apply (it's a single point)
- No win-by-2 requirement

**Code:**
```typescript
function validateTB1(set) {
  if (!set.winningSide) {
    return { isValid: false, error: 'TB1 must have a winner' };
  }
  
  const diff = Math.abs(set.side1Score - set.side2Score);
  if (diff < 1) {
    return { isValid: false, error: 'TB1 scores must differ' };
  }
  
  return { isValid: true };
}
```

## UI Changes

### 1. Tiebreak Dropdown - Add [1]

**Current dropdown values:**
```typescript
const tiebreakToOptions = [5, 7, 9, 10, 12];
```

**Updated (conditional):**
```typescript
const tiebreakToOptions = [5, 7, 9, 10, 12];

// Add [1] when aggregate + finalSet context
if (isFinalSet && format.setFormat?.timedScoringMethod === 'aggregate') {
  tiebreakToOptions.unshift(1);
}
```

**Display:**
- `1` → Show as "Single Point" or "TB1" in dropdown
- Only show for **final set format**, not regular set tiebreaks

### 2. UI Flow

**When user selects "Aggregate" scoring:**
1. Show scoring method buttons: `[Games] [Aggregate]`
2. User clicks `[Aggregate]`
3. Final set section appears
4. Final set tiebreak dropdown now includes `[1]` option
5. User selects `[1]` → Format becomes `SET3X-S:T10A-F:TB1`

**Visual mockup:**
```
┌─────────────────────────────────────┐
│ Descriptor: [Best of] [Exactly]     │
│ Number: [1] [2] [3] [4] [5]         │
│                                     │
│ ☑ Timed sets                        │
│ Minutes: [10]                       │
│ Scoring: [Games] [Aggregate] ←      │
│                                     │
│ Final Set:                          │
│ ☑ Tiebreak                          │
│ To: [1] [5] [7] [9] [10] [12] ←     │
│     ↑ Only shows when Aggregate     │
└─────────────────────────────────────┘
```

## Score Display

### DynamicSets Modal
```
Format: SET3X-S:T10A-F:TB1

Display:
┌────────┬────────┬────────┐
│ Set 1  │ Set 2  │ Set 3  │ ← Timed sets
├────────┼────────┼────────┤
│ 20 20  │ 25 22  │ 18 21  │
└────────┴────────┴────────┘

Aggregate: 63-63 (TIED)

┌────────┐
│ TB1    │ ← Appears when tied
├────────┤
│ 1  0   │
└────────┘

Winner: side1
```

### FreeScore Modal
```
Format: SET3X-S:T10A-F:TB1

Input: 20-20 25-22 18-21 [1-0]

Formatted: 20-20 25-22 18-21 [1-0]
Status: Valid ✓
Winner: side1 (aggregate tied 63-63, TB1 resolved)
```

## Edge Cases

### 1. No TB1 When Not Tied
```
Format: SET3X-S:T10A-F:TB1
Score: 30-20 25-22 18-21

Aggregate: 73-63 (side1 wins)
TB1: Not played (not needed)
```

### 2. Multiple Set Ties
```
Format: SET3X-S:T10A-F:TB1
Score: 15-15 20-20 25-25 [1-0]

Sets 1-3: All tied (aggregate 60-60)
TB1: side1 wins
Winner: side1
```

### 3. TB1 Without Aggregate Tie (Error)
```
Format: SET3X-S:T10A-F:TB1
Score: 30-20 25-22 18-21 [1-0]

Aggregate: 73-63 (side1 already won)
ERROR: TB1 should not be played when aggregate isn't tied
```

**Validation:** Warn user if TB1 is entered when not needed.

## Testing Checklist

### Factory Tests
- ✅ Parse `F:TB1` correctly
- ✅ Stringify with TB1 preserved
- ✅ Aggregate winner without TB1
- ✅ Aggregate tie without TB1 → undefined
- ✅ Aggregate tie with TB1 → TB1 winner
- ✅ Set-level ties allowed (winningSide = undefined)
- ✅ TB1 validation (must have winner)

### UI Tests
- ✅ [1] appears in tiebreak dropdown for aggregate + finalSet
- ✅ [1] does NOT appear for games-based
- ✅ [1] does NOT appear for regular set tiebreaks
- ✅ Format round-trips: SET3X-S:T10A-F:TB1 → [Select] → same format

### TMX Integration Tests
- ✅ DynamicSets shows TB1 input when aggregate tied
- ✅ FreeScore accepts "[1-0]" or "[0-1]" notation
- ✅ Winner determined correctly from TB1
- ✅ No TB1 when aggregate not tied

## Documentation Notes

**For users:**
- TB1 = Single Point Tiebreak (sudden death)
- Only used when aggregate scoring results in tie
- Bracket notation: `[1-0]` or `[0-1]`
- Winner of single point wins match

**For developers:**
- TB1 is stored in finalSetFormat as `tiebreakSet: { tiebreakTo: 1 }`
- TB1 set is excluded from aggregate sum
- TB1 winningSide becomes match winningSide when aggregate tied
- Set-level ties (20-20) have `winningSide: undefined` - this is valid
