# Timed Sets Scoring Methods - Implementation Plan

## Problem Statement

**Current situation:** 
- Timed sets implemented with 'X' suffix (SET3X-S:T10)
- No distinction between scoring methods
- Factory assumes "periods won" approach
- This is WRONG for many timed set scenarios

**Counter-example proving periods ≠ aggregate:**
```
Score: 100-1 | 0-30 | 0-30

Aggregate scoring:
  side1 = 100 + 0 + 0 = 100
  side2 = 1 + 30 + 30 = 61
  Winner: side1 ✓

Periods won scoring:
  Period 1: side1 wins (100-1)
  Period 2: side2 wins (0-30)
  Period 3: side2 wins (0-30)
  Winner: side2 (2-1) ✗

DIFFERENT WINNERS!
```

## TODS Specification

From https://itftennis.atlassian.net/wiki/spaces/TODS/pages/1272840309/MatchUp+Format+Code

**Timed Game Notation from TODS:**
- `T30P` - Timed 30 minute game - points based
- `T30G` - Timed 30 minute game - games based

**TODS Examples:**
```
| T30P | | | T30 | 21-12 | Timed 90 minute game - points based | Timed 90 mins |
| T30G | | | T30 | 7-3   | Timed 90 minute game - game based   | Timed 90 mins |
| SET3 | S:T20 | | SET3-S:T20 | 7-0 4-4 5-3 | 3 sets of 20 minutes. | |
```

**Interpretation:**
- `T{minutes}P` - Points-based: Regular tennis scoring within period (0,15,30,40,game)
- `T{minutes}G` - Games-based: Count games won within period, winner = most games
- `SET3-S:T20` - Three 20-minute timed sets (no suffix = games-based implied)

## Proposed Enhancement

### Add 'A' for Aggregate Scoring + TB1 for Set-Level Ties

**Why:** TODS has P/G, but we need to distinguish:
- **P (Points):** Regular tennis scoring within period (0, 15, 30, 40, game)
- **G (Games):** Winner of each period determined by games won, then count periods
- **A (Aggregate):** Sum scores across all periods (not in TODS, our extension)

**Set-Level Ties:** When timed sets end with tied scores, need tie resolution:
- `T10P/TB1` - Points-based timed set with single-point tiebreak if tied
- `T10G/TB1` - Games-based timed set with single-point tiebreak if tied
- `T10A/TB1` - Aggregate (same as T10A, but explicit about set ties)

**The problem with 100-1 | 0-30 | 0-30:**
- **Games-based (G):** side2 wins 2 periods → side2 wins match
- **Aggregate (A):** side1 total=100, side2 total=61 → side1 wins match
- **Different winners!**

**Proposed notation:**
- `T{minutes}` - Timed set (default to G for compatibility)
- `T{minutes}P` - Points-based within period (0,15,30,40,game like regular tennis)
- `T{minutes}G` - Games-based (count games in period, then count periods won)
- `T{minutes}A` - **Aggregate** (sum all scores across all periods) ← NEW

**Examples:**

**Set-level tiebreak (when individual set is tied):**
- `SET3-S:T10P/TB1` - Three 10-minute points-based sets, TB1 if set tied
- `SET3-S:T10G/TB1` - Three 10-minute games-based sets, TB1 if set tied
- `SET3X-S:T10A/TB1` - Three 10-minute aggregate sets, TB1 if set tied

**Match-level tiebreak (when aggregate/overall is tied):**
- `SET3X-S:T10A-F:TB1` - Three aggregate sets, final TB1 if match tied

**Complete examples:**
- `SET4X-S:T10A` - Four 10-minute sets, winner = highest aggregate score
- `SET3X-S:T15G` - Three 15-minute sets, winner = most periods won (explicit)
- `SET3X-S:T15` - Three 15-minute sets, winner = most periods won (G implied)
- `SET2X-S:T20P/TB1` - Two 20-minute points-based sets, TB1 per set if tied

**Default behavior:**
- `SET3X-S:T10` (no suffix) → interpreted as `SET3X-S:T10G` (games-based)
- This maintains backwards compatibility with existing formats

**Note on P (Points):**
Per TODS spec, `T30P` means regular tennis scoring within a timed period:
- Points: 0, 15, 30, 40, game
- Games: counted normally within the period
- Winner: whoever has more games at end of period
- This is more complex than our current implementation which treats scores as simple integers

**Implementation priority:**
1. **Phase 1:** Implement G (games) and A (aggregate) - these use simple integer scores
2. **Phase 2:** Implement P (points) later - requires more complex scoring logic

## Implementation Phases

### Phase 1: Factory - matchUpFormatCode Parse/Stringify (2.5 hours)

**File:** `/factory/src/helpers/matchUpFormatCode/parse.ts`

**Current timed set parsing:**
```typescript
// Line ~200 in parse.ts - detect T{minutes}
const timedMatch = what.match(/T(\d+)/);
if (timedMatch) {
  setFormat.timed = true;
  setFormat.minutes = parseInt(timedMatch[1]);
}
```

**New parsing (handles scoring method AND set-level TB1):**
```typescript
// Parse T{minutes}[P|G|A][/TB{n}]
// Examples: T10, T10A, T10P/TB1, T10G/TB1
const timedMatch = what.match(/T(\d+)([PGA])?(?:\/TB(\d+))?/);
if (timedMatch) {
  setFormat.timed = true;
  setFormat.minutes = parseInt(timedMatch[1]);
  
  // Parse scoring method (A, P, or G)
  const scoringMethod = timedMatch[2];
  if (scoringMethod === 'A') {
    setFormat.timedScoringMethod = 'aggregate';
  } else if (scoringMethod === 'P') {
    setFormat.timedScoringMethod = 'points';
  } else if (scoringMethod === 'G') {
    setFormat.timedScoringMethod = 'games';
  } else {
    // Default to games-based if not specified
    setFormat.timedScoringMethod = 'games';
  }
  
  // Parse set-level tiebreak (if present)
  const setTiebreakTo = timedMatch[3];
  if (setTiebreakTo) {
    setFormat.tiebreakFormat = {
      tiebreakTo: parseInt(setTiebreakTo)
    };
  }
}
```

**Examples of what this parses:**
- `T10` → `{ timed: true, minutes: 10, timedScoringMethod: 'games' }`
- `T10A` → `{ timed: true, minutes: 10, timedScoringMethod: 'aggregate' }`
- `T10P/TB1` → `{ timed: true, minutes: 10, timedScoringMethod: 'points', tiebreakFormat: { tiebreakTo: 1 } }`
- `T10G/TB1` → `{ timed: true, minutes: 10, timedScoringMethod: 'games', tiebreakFormat: { tiebreakTo: 1 } }`

**File:** `/factory/src/helpers/matchUpFormatCode/stringify.ts`

**New stringify logic (with set-level TB1):**
```typescript
if (setFormat.timed && setFormat.minutes) {
  let result = `T${setFormat.minutes}`;
  
  // Add scoring method suffix
  if (setFormat.timedScoringMethod === 'aggregate') {
    result += 'A';
  } else if (setFormat.timedScoringMethod === 'points') {
    result += 'P';
  }
  // Games-based (G) is default, don't add suffix
  // This keeps formats clean: T10 instead of T10G
  
  // Add set-level tiebreak if present
  if (setFormat.tiebreakFormat?.tiebreakTo) {
    result += `/TB${setFormat.tiebreakFormat.tiebreakTo}`;
  }
  
  return `${what}:${result}`;
}
```

**Stringify examples:**
- `{ timed: true, minutes: 10, timedScoringMethod: 'games' }` → `S:T10`
- `{ timed: true, minutes: 10, timedScoringMethod: 'aggregate' }` → `S:T10A`
- `{ timed: true, minutes: 10, timedScoringMethod: 'points', tiebreakFormat: { tiebreakTo: 1 } }` → `S:T10P/TB1`

**Type updates:**
```typescript
// In ParsedFormat type
export type SetFormat = {
  setTo?: number;
  tiebreakAt?: number;
  tiebreakFormat?: TiebreakFormat;
  tiebreakSet?: TiebreakSet;
  timed?: boolean;
  minutes?: number;
  timedScoringMethod?: 'games' | 'points' | 'aggregate'; // NEW
};
```

**Tests to add:**
```typescript
// parse.test.ts
test('T10A parses as aggregate scoring', () => {
  const result = parse('SET3X-S:T10A');
  expect(result.setFormat.timedScoringMethod).toBe('aggregate');
});

test('T10G parses as games scoring', () => {
  const result = parse('SET3X-S:T10G');
  expect(result.setFormat.timedScoringMethod).toBe('games');
});

test('T10 defaults to games scoring', () => {
  const result = parse('SET3X-S:T10');
  expect(result.setFormat.timedScoringMethod).toBe('games');
});

// stringify.test.ts
test('aggregate method stringifies with A suffix', () => {
  const format = {
    bestOf: undefined,
    exactly: 3,
    setFormat: {
      timed: true,
      minutes: 10,
      timedScoringMethod: 'aggregate'
    }
  };
  expect(stringify(format)).toBe('SET3X-S:T10A');
});

test('games method stringifies without suffix', () => {
  const format = {
    bestOf: undefined,
    exactly: 3,
    setFormat: {
      timed: true,
      minutes: 10,
      timedScoringMethod: 'games'
    }
  };
  expect(stringify(format)).toBe('SET3X-S:T10');
});
```

### Phase 1b: Factory - TB1 Support (30 min)

**Goal:** Support single-point tiebreak in finalSetFormat

**Files:**
- `/factory/src/helpers/matchUpFormatCode/parse.ts`
- `/factory/src/helpers/matchUpFormatCode/stringify.ts`

**Changes:**
1. Ensure `F:TB1` parses correctly
2. Test that tiebreakTo=1 is preserved
3. Stringify test: format with TB1 round-trips

**Example:**
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

### Phase 2: Factory - Winner Determination Logic (2 hours)

**File:** `/factory/src/tools/parseScoreString.ts`

**Current logic:**
```typescript
// Line 106 - always determines winningSide by comparing scores
winningSide = (side1Score > side2Score && 1) || 
              (side1Score < side2Score && 2) || 
              undefined;
```

**Enhanced logic:**
```typescript
// Determine winningSide based on scoring method
// Note: parseScoreString determines PER-SET winner
// Match-level winner determination happens in generateOutcomeFromScoreString
winningSide = (side1Score > side2Score && 1) || 
              (side1Score < side2Score && 2) || 
              undefined;
```

**File:** `/factory/src/assemblies/generators/mocks/generateOutcomeFromScoreString.ts`

**Current logic (lines 27-43):**
```typescript
// Count sets won by each side
const setsWon = { side1: 0, side2: 0 };
neutralParsedSets.forEach((set: any) => {
  if (set.winningSide === 1) setsWon.side1++;
  else if (set.winningSide === 2) setsWon.side2++;
});

// Determine match winner based on sets won
if (setsWon.side1 > setsWon.side2) inferredWinningSide = 1;
else if (setsWon.side2 > setsWon.side1) inferredWinningSide = 2;
```

**Enhanced logic:**
```typescript
// Parse format to check for timed aggregate scoring
const parsedFormat = matchUpFormat ? parse(matchUpFormat) : undefined;
const isTimedAggregate = 
  parsedFormat?.setFormat?.timed && 
  parsedFormat?.setFormat?.timedScoringMethod === 'aggregate';
const isExactlyFormat = !!parsedFormat?.exactly || parsedFormat?.bestOf === 1;

if (isTimedAggregate && isExactlyFormat) {
  // AGGREGATE SCORING: Sum all points across all sets (excluding final TB1)
  let side1Total = 0;
  let side2Total = 0;
  
  // Check if there's a final set tiebreak (TB1)
  const hasFinalTiebreak = parsedFormat?.finalSetFormat?.tiebreakSet?.tiebreakTo === 1;
  const setsToSum = hasFinalTiebreak ? neutralParsedSets.length - 1 : neutralParsedSets.length;
  
  // Sum scores from regular timed sets (not the TB1)
  for (let i = 0; i < setsToSum; i++) {
    const set = neutralParsedSets[i];
    side1Total += set.side1Score || 0;
    side2Total += set.side2Score || 0;
  }
  
  if (side1Total > side2Total) {
    inferredWinningSide = 1;
  } else if (side2Total > side1Total) {
    inferredWinningSide = 2;
  } else if (hasFinalTiebreak && neutralParsedSets.length > setsToSum) {
    // Tie in aggregate - check TB1 result
    const finalSet = neutralParsedSets[setsToSum];
    inferredWinningSide = finalSet.winningSide;
  }
  // else: tie with no tiebreak (undefined)
} else {
  // GAMES-BASED or STANDARD SCORING: Count sets won
  const setsWon = { side1: 0, side2: 0 };
  neutralParsedSets.forEach((set: any) => {
    if (set.winningSide === 1) setsWon.side1++;
    else if (set.winningSide === 2) setsWon.side2++;
  });
  
  if (setsWon.side1 > setsWon.side2) inferredWinningSide = 1;
  else if (setsWon.side2 > setsWon.side1) inferredWinningSide = 2;
}
```

**Tests to add:**
```typescript
test('aggregate scoring sums points across sets', () => {
  const result = generateOutcomeFromScoreString({
    scoreString: '100-1 0-30 0-30',
    matchUpFormat: 'SET3X-S:T10A',
  });
  
  // side1 total: 100, side2 total: 61
  expect(result.outcome.winningSide).toBe(1);
});

test('games-based scoring counts periods won', () => {
  const result = generateOutcomeFromScoreString({
    scoreString: '100-1 0-30 0-30',
    matchUpFormat: 'SET3X-S:T10G', // or just T10
  });
  
  // side2 wins 2 periods (sets 2 and 3)
  expect(result.outcome.winningSide).toBe(2);
});

test('games-based is default for timed sets', () => {
  const result = generateOutcomeFromScoreString({
    scoreString: '100-1 0-30 0-30',
    matchUpFormat: 'SET3X-S:T10',
  });
  
  expect(result.outcome.winningSide).toBe(2);
});

test('aggregate tie resolved by TB1', () => {
  const result = generateOutcomeFromScoreString({
    scoreString: '20-20 25-22 18-21 [1-0]',
    matchUpFormat: 'SET3X-S:T10A-F:TB1',
  });
  
  // Aggregate: 63-63 (tie), TB1: side1 wins
  expect(result.outcome.winningSide).toBe(1);
});

test('aggregate tie without TB1 returns undefined', () => {
  const result = generateOutcomeFromScoreString({
    scoreString: '20-20 25-22 18-21',
    matchUpFormat: 'SET3X-S:T10A',
  });
  
  // Aggregate: 63-63 (tie), no tiebreak
  expect(result.outcome.winningSide).toBeUndefined();
});

test('set-level tie in aggregate scoring', () => {
  const result = generateOutcomeFromScoreString({
    scoreString: '20-20 30-25',
    matchUpFormat: 'SET2X-S:T10A',
  });
  
  // Set 1: tie (no winningSide)
  expect(result.outcome.score.sets[0].winningSide).toBeUndefined();
  // Set 2: side1 wins
  expect(result.outcome.score.sets[1].winningSide).toBe(1);
  // Aggregate: side1 wins (50 > 45)
  expect(result.outcome.winningSide).toBe(1);
});
```

### Phase 3: courthive-components - UI Updates (2 hours)

**File:** `/courthive-components/src/components/matchUpFormat/matchUpFormat.ts`

**Part A: Add scoring method selector (only when timed = true):**

```typescript
// After the "Timed sets" checkbox and minutes input
// Add new selector for scoring method

if (format.setFormat?.timed) {
  // Scoring method selector
  const scoringMethodContainer = document.createElement('div');
  scoringMethodContainer.className = 'format-row';
  
  const scoringMethodLabel = document.createElement('label');
  scoringMethodLabel.textContent = 'Scoring:';
  
  const scoringMethodButtons = document.createElement('div');
  scoringMethodButtons.className = 'button-group';
  
  const methods = [
    { value: 'games', label: 'Games' },
    { value: 'aggregate', label: 'Aggregate' },
    // Optional: { value: 'points', label: 'Points' },
  ];
  
  methods.forEach(({ value, label }) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = 'button';
    
    if (format.setFormat.timedScoringMethod === value ||
        (!format.setFormat.timedScoringMethod && value === 'games')) {
      button.classList.add('active');
    }
    
    button.addEventListener('click', () => {
      // Update format
      format.setFormat = format.setFormat || {};
      format.setFormat.timedScoringMethod = value;
      
      // Update UI
      scoringMethodButtons.querySelectorAll('button').forEach(b => 
        b.classList.remove('active')
      );
      button.classList.add('active');
      
      // Trigger update
      pluralize();
    });
    
    scoringMethodButtons.appendChild(button);
  });
  
  scoringMethodContainer.appendChild(scoringMethodLabel);
  scoringMethodContainer.appendChild(scoringMethodButtons);
  setFormatContainer.appendChild(scoringMethodContainer);
}
```

**Part B: Add [1] to tiebreak dropdown conditionally:**

```typescript
// When building final set tiebreak dropdown
const tiebreakToOptions = [5, 7, 9, 10, 12];

// Add [1] if timed + aggregate format
if (format.setFormat?.timed && 
    format.setFormat?.timedScoringMethod === 'aggregate') {
  tiebreakToOptions.unshift(1); // Add 1 at beginning
}

// Build dropdown with conditional options
tiebreakToOptions.forEach(value => {
  const button = document.createElement('button');
  button.textContent = value === 1 ? 'Single Point' : value.toString();
  button.className = 'button';
  // ... rest of button setup
});
```

**Update initializeFormatFromString:**
```typescript
setFormat: {
  setTo: parsed.setFormat?.setTo,
  tiebreakAt: parsed.setFormat?.tiebreakAt,
  timed: parsed.setFormat?.timed,
  minutes: parsed.setFormat?.minutes,
  timedScoringMethod: parsed.setFormat?.timedScoringMethod || 'games', // NEW
  // ...
}
```

**UI mockup:**
```
┌─────────────────────────────────┐
│ [Best of] [Exactly]             │
│ Number: [1] [2] [3] [4] [5]     │
│                                 │
│ ☑ Timed sets                    │
│ Minutes: [10]                   │
│ Scoring: [Games] [Aggregate]    │  ← NEW
│                                 │
│ What: [Set] [Timed set]         │
└─────────────────────────────────┘
```

### Phase 4: TMX - Update Validation (1 hour)

**File:** `/TMX/src/components/modals/scoringV2/utils/scoreValidator.ts`

**Update validateSetScores for timed sets:**

```typescript
if (isTimed && isExactlyFormat) {
  // Build score string
  const scoreString = sets.map(s => `${s.side1 || 0}-${s.side2 || 0}`).join(' ');
  
  // Parse using factory (which now understands scoring methods)
  const parsedSets = tournamentEngine.parseScoreString({
    scoreString,
    matchUpFormat,
  });
  
  if (!parsedSets || parsedSets.length === 0) {
    return {
      isValid: false,
      sets: [],
      error: 'Failed to parse timed set scores',
    };
  }
  
  // Check scoring method from parsed format
  const parsed = matchUpFormatCode.parse(matchUpFormat);
  const scoringMethod = parsed?.setFormat?.timedScoringMethod || 'games';
  
  let matchWinningSide: number | undefined;
  
  if (scoringMethod === 'aggregate') {
    // AGGREGATE: Sum all points
    let side1Total = 0;
    let side2Total = 0;
    
    parsedSets.forEach((set: any) => {
      side1Total += set.side1Score || 0;
      side2Total += set.side2Score || 0;
    });
    
    if (side1Total > side2Total) matchWinningSide = 1;
    else if (side2Total > side1Total) matchWinningSide = 2;
    // else: tie
  } else {
    // GAMES-BASED: Count periods won (default)
    const periodsWon = { side1: 0, side2: 0 };
    parsedSets.forEach((set: any) => {
      if (set.winningSide === 1) periodsWon.side1++;
      else if (set.winningSide === 2) periodsWon.side2++;
    });
    
    if (periodsWon.side1 > periodsWon.side2) matchWinningSide = 1;
    else if (periodsWon.side2 > periodsWon.side1) matchWinningSide = 2;
  }
  
  // Build scoreObject for display
  const validationResult = validateScore(scoreString, matchUpFormat);
  
  return {
    isValid: true,
    sets: parsedSets,
    scoreObject: validationResult.scoreObject,
    winningSide: matchWinningSide,
    matchUpStatus: COMPLETED,
    matchUpFormat,
    score: scoreString,
  };
}
```

**Update freeScore.ts:**

The freeScore parser already passes through to factory validation, so it should automatically pick up the new logic once factory is updated. No changes needed!

### Phase 5: Testing (2 hours)

**Test matrix:**

| Format | Score | Method | Expected Winner | Reason |
|--------|-------|--------|----------------|---------|
| SET3X-S:T10A | 100-1 0-30 0-30 | Aggregate | side1 | 100 > 61 |
| SET3X-S:T10G | 100-1 0-30 0-30 | Games | side2 | Won 2 periods |
| SET3X-S:T10 | 100-1 0-30 0-30 | Games (default) | side2 | Default to games |
| SET3X-S:T10A | 33-37 22-21 20-24 | Aggregate | side2 | 82 > 75 |
| SET3X-S:T10G | 33-37 22-21 20-24 | Games | side2 | Won 2 periods |
| SET2X-S:T10A | 50-40 30-40 | Aggregate | side1 | 80 > 80... wait tie! |
| SET2X-S:T10G | 50-40 30-40 | Games | Tie | Each won 1 |
| SET1-S:T20A | 75-68 | Aggregate | side1 | Single set |
| SET1-S:T20G | 75-68 | Games | side1 | Single set |

**Manual testing:**
1. Factory tests pass
2. UI shows scoring selector only for timed sets
3. DynamicSets determines winner correctly for both methods
4. FreeScore determines winner correctly for both methods
5. Both modals show same winner for same input
6. Round-trip: SET3X-S:T10A → [Select] → SET3X-S:T10A (preserves A)

### Phase 6: Documentation (1 hour)

**Update all docs:**
- TIMED_SETS_SUPPORT.md - Add scoring methods section
- Factory README - Document new P/G/A notation
- Components README - Document UI changes
- TODS compliance note

## Implementation Order (Respecting Dependencies)

### Phase 1: Factory (Days 1-2) - 6 hours

**Repository:** `tods-competition-factory`

1. **Parse/Stringify (2.5 hrs)**
   - Support T10A, T10G, T10P notation
   - Support /TB1 at set level: `T10P/TB1`, `T10G/TB1`
   - Support -F:TB1 at final set level
   - Add `timedScoringMethod` property
   - Add tests for all combinations

2. **Winner Determination (2.5 hrs)**
   - Aggregate scoring logic
   - Games-based scoring logic (existing)
   - Handle set-level TB1 (set winner)
   - Handle match-level TB1 (match winner)
   - Tests for all scoring methods

3. **Testing & Documentation (1 hr)**
   - All factory tests pass
   - Update factory README
   - Document new notation

**Deliverable:** Factory v[next] ready to publish

---

### 🚀 PUBLISH FACTORY TO NPM

Wait for factory publish before proceeding to components.

---

### Phase 2: courthive-components (Day 3) - 3 hours

**Repository:** `courthive-components`

**Prerequisites:** 
- ✅ Factory published with new parse/stringify
- ✅ Install new factory version

1. **Update Dependencies (15 min)**
   - Update `tods-competition-factory` to latest
   - Verify parse/stringify works
   - Test format round-trips

2. **UI Updates (2 hrs)**
   - Add scoring method selector (Games/Aggregate)
   - Add [1] to tiebreak dropdown (conditional)
   - Support set-level TB1: `/TB1` notation
   - Support final-level TB1: `-F:TB1` notation
   - Update format initialization logic

3. **Testing & Documentation (45 min)**
   - Test all new UI controls
   - Test format generation: `SET3-S:T10P/TB1`
   - Test round-trip preservation
   - Update components README

**Deliverable:** Components v[next] ready to publish

---

### 🚀 PUBLISH COURTHIVE-COMPONENTS TO NPM

Wait for components publish before proceeding to TMX.

---

### Phase 3: TMX (Days 4-5) - 4 hours

**Repository:** `TMX`

**Prerequisites:**
- ✅ Factory published with scoring logic
- ✅ Components published with new UI
- ✅ Install both new versions

1. **Update Dependencies (15 min)**
   - Update `tods-competition-factory` to latest
   - Update `courthive-components` to latest
   - Verify imports work

2. **Validation Updates (1.5 hrs)**
   - Update `validateSetScores()` for scoring methods
   - Handle set-level TB1 in dynamicSets
   - Handle aggregate vs games-based winner logic
   - Update freeScore parser (should work automatically)

3. **UI Integration (1.5 hrs)**
   - Test dynamicSets with new formats
   - Test freeScore with new formats
   - Verify winner determination works
   - Test TB1 scenarios

4. **End-to-End Testing (1 hr)**
   - Test all scoring methods (G, A, P)
   - Test set-level TB1
   - Test match-level TB1
   - Test ties without TB1
   - Verify both modals agree on winners

**Deliverable:** TMX with full timed sets support

---

### Phase 4: Future Enhancements (Optional, 5-6 hrs)

**Repository:** `courthive-components`

1. Configuration JSON system
2. Presets support
3. Internationalization

**Total Core Implementation: ~13 hours**
**Total with Config: ~18-19 hours**

---

## Publish Sequence Summary

```
Day 1-2: Work on Factory
        ↓
        🚀 Publish Factory v[X]
        ↓
Day 3:  Work on Components (uses Factory v[X])
        ↓
        🚀 Publish Components v[Y]
        ↓
Day 4-5: Work on TMX (uses Factory v[X] + Components v[Y])
        ↓
        ✅ TMX Complete
```

**Critical:** Each publish must complete before dependent work starts!

## Success Criteria

✅ Factory parse/stringify supports T10A, T10G, T10P
✅ Factory correctly determines winner for aggregate vs games-based
✅ UI shows scoring method selector for timed sets
✅ DynamicSets determines winner using correct method
✅ FreeScore determines winner using correct method
✅ All tests pass
✅ Documentation updated
✅ TODS compliant

## Tie Resolution for Aggregate Scoring

### The Problem
With aggregate scoring, ties are possible:

**Set-level ties:**
```
SET3X-S:T10A
Score: 20-20 | 25-22 | 18-21

Set 1: 20-20 → TIE (no winningSide)
Set 2: 25-22 → side1 wins
Set 3: 18-21 → side2 wins

Aggregate: side1=63, side2=63 → TIE!
```

**Match-level ties:**
When aggregate is tied after all sets, need resolution mechanism.

### The Solution: Single Point Tiebreak (TB1)

**Format:** `SET3X-S:T10A-F:TB1`
- Play 3 aggregate-scored timed sets
- If aggregate is tied, play single point tiebreak to decide winner
- TB1 = sudden death point

**Examples:**
```
SET3X-S:T10A-F:TB1
Score: 20-20 | 25-22 | 18-21 | [1-0]

Sets 1-3: Aggregate tied 63-63
Final set: Single point tiebreak, side1 wins
Winner: side1

SET2X-S:T20A-F:TB1
Score: 50-40 | 40-50 | [0-1]

Sets 1-2: Aggregate tied 90-90
Final set: Single point tiebreak, side2 wins
Winner: side2
```

### Implementation Requirements

1. **Factory Parse/Stringify:**
   - Support `F:TB1` notation
   - Parse finalSetFormat as tiebreak-only with tiebreakTo=1
   - Stringify correctly

2. **Winner Determination:**
   ```typescript
   // In generateOutcomeFromScoreString for aggregate scoring
   if (side1Total === side2Total) {
     // Check if there's a final set tiebreak
     if (parsed.finalSetFormat?.tiebreakSet?.tiebreakTo === 1) {
       // Look for final set score
       const finalSet = sets[sets.length - 1];
       if (finalSet) {
         winningSide = finalSet.winningSide;
       }
     }
     // else: tie remains (winningSide = undefined)
   }
   ```

3. **UI - Tiebreak Dropdown:**
   - Current: [5, 7, 9, 10, 12]
   - **Add [1] when timed aggregate format is selected**
   - Show as "Single Point" in dropdown
   - Only show for finalSetFormat, not regular tiebreaks

4. **Validation:**
   - TB1 scores must be [1-0] or [0-1]
   - No win-by-2 requirement for TB1
   - Valid as final set only

## UI Configuration (Long-term Enhancement)

### Vision: Configurable matchUpFormat Editor

**Problem:** 
- Hard-coded dropdown values
- No way to customize for different contexts
- Can't define pre-defined formats like "Standard Advantage"
- No internationalization support

**Solution:** JSON configuration object

### Configuration Schema

```typescript
interface MatchUpFormatEditorConfig {
  // Dropdown value definitions
  dropdowns: {
    number: number[];              // [1, 2, 3, 4, 5] or [1, 3, 5]
    tiebreakTo: number[];          // [1, 5, 7, 9, 10, 12]
    setTo: number[];               // [4, 6, 8]
    timedMinutes: number[];        // [5, 10, 15, 20, 30]
    scoringMethod: string[];       // ['games', 'aggregate', 'points']
  };
  
  // Conditional visibility rules
  conditionals: {
    // Show [1] in tiebreakTo only for finalSet + timed + aggregate
    tiebreakTo: {
      showOne: {
        when: {
          finalSet: true,
          timed: true,
          scoringMethod: 'aggregate'
        }
      }
    };
    // Show scoring method only when timed
    scoringMethod: {
      visible: {
        when: { timed: true }
      }
    };
  };
  
  // Pre-defined formats (for quick selection)
  presets: {
    label: string;
    format: string;
    description?: string;
  }[];
  
  // Internationalization
  i18n?: {
    locale: string;
    labels: Record<string, string>;
  };
}
```

### Example Configuration

```json
{
  "dropdowns": {
    "number": [1, 2, 3, 4, 5],
    "tiebreakTo": [1, 5, 7, 9, 10, 12],
    "setTo": [4, 6, 8],
    "timedMinutes": [5, 10, 15, 20, 30],
    "scoringMethod": ["games", "aggregate"]
  },
  
  "conditionals": {
    "tiebreakTo": {
      "showOne": {
        "when": {
          "finalSet": true,
          "timed": true,
          "scoringMethod": "aggregate"
        }
      }
    }
  },
  
  "presets": [
    {
      "label": "Standard Advantage",
      "format": "SET3-S:6/TB7",
      "description": "Best 2 out of 3 sets to 6 games with tiebreak to 7"
    },
    {
      "label": "Fast4",
      "format": "SET5-S:4NOAD/TB5@3",
      "description": "Best 3 out of 5 sets, 4 games, no-ad, tiebreak at 3"
    },
    {
      "label": "Timed Aggregate",
      "format": "SET3X-S:T10A-F:TB1",
      "description": "3 timed sets (10min) with aggregate scoring and single-point tiebreak"
    }
  ],
  
  "i18n": {
    "locale": "es",
    "labels": {
      "bestOf": "Mejor de",
      "exactly": "Exactamente",
      "games": "Juegos",
      "aggregate": "Agregado",
      "timedSets": "Sets cronometrados",
      "minutes": "Minutos"
    }
  }
}
```

### Implementation Phases for Configuration

**Phase A: Internal Refactoring (1-2 hours)**
- Extract all hard-coded arrays into constants
- Create default configuration object
- Refactor UI to use configuration values

**Phase B: Configuration API (2 hours)**
- Add `getMatchUpFormatModal({ config, ... })` parameter
- Merge user config with defaults
- Apply conditional visibility rules

**Phase C: Presets Support (1 hour)**
- Add preset selector dropdown
- Apply preset formats on selection
- Allow editing after preset selection

**Phase D: Internationalization (1 hour)**
- Load i18n labels from config
- Replace hard-coded English strings
- Test with different locales

**Total: 5-6 hours for full configuration support**

## Open Questions

1. **Should we support 'P' (points)?**
   - TODS spec includes it
   - Means regular tennis scoring within each timed period
   - More complex to implement
   - **Recommendation:** Add parsing for 'P' but don't implement validation yet

2. **Default behavior for existing T10 formats?**
   - Old: `SET3X-S:T10` (no suffix)
   - **Recommendation:** Default to 'G' (games-based) for backwards compatibility

3. ~~**Tie scenarios?**~~ ✅ RESOLVED
   - ✅ Set-level ties: Return `winningSide = undefined` for that set
   - ✅ Match-level ties: Support F:TB1 for single-point resolution
   - ✅ UI: Add [1] to tiebreak dropdown when aggregate + finalSet

4. **Display in matchUp?**
   - Should aggregate totals be shown?
   - **Recommendation:** Show in matchUpFormat but not in score display yet

5. **TB1 validation strictness?**
   - Should TB1 only allow [1-0] or [0-1]?
   - Or allow higher scores if someone plays it wrong?
   - **Recommendation:** Allow any score but document expected usage
