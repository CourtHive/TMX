# Development Plan - Timed Sets Scoring Methods

## TL;DR - REVISED
The "periods won" and "aggregate" approaches can give **different winners** (e.g., 100-1 | 0-30 | 0-30). Need to implement proper scoring method notation (G/A) throughout the stack: factory parse/stringify → winner determination → UI selector → TMX validation.

## Original Plan (Obsolete)
~~Just call factory's parseScoreString from dynamicSets~~ 
This assumed periods won = aggregate, which is FALSE!

## Background (Completed Today)
- ✅ FreeScore works: passes score string to factory → factory counts periods won → winner determined
- ✅ DynamicSets doesn't work: explicitly skips winningSide for timed sets
- ❌ WRONG ASSUMPTION: "periods won" ≠ "aggregate" (they can differ significantly!)
- ✅ Reviewed TODS spec: Has P (points) and G (games) notation
- ✅ Decided to add A (aggregate) as extension to TODS spec
- ✅ Created comprehensive implementation plan

## Counter-Example Proving They Differ
```
Score: 100-1 | 0-30 | 0-30

Games-based (G) - count periods won:
  Period 1: 100-1 → side1 wins
  Period 2: 0-30 → side2 wins
  Period 3: 0-30 → side2 wins
  Winner: side2 (won 2 of 3 periods)

Aggregate (A) - sum all scores:
  side1 total: 100 + 0 + 0 = 100
  side2 total: 1 + 30 + 30 = 61
  Winner: side1 (100 > 61)

DIFFERENT WINNERS!
```

## The NEW Plan - Implement Scoring Methods

See `TIMED_SETS_SCORING_PLAN.md` for comprehensive 8.5-hour implementation plan.

### Proposed Notation
- `SET3X-S:T10` - Default to games-based (backwards compatible)
- `SET3X-S:T10G` - Games-based (explicit): count periods won
- `SET3X-S:T10A` - Aggregate (new): sum all scores
- `SET3X-S:T10P` - Points-based (future): regular tennis scoring

### Implementation Stack (Bottom-Up)
1. **Factory:** Parse/stringify T10G/T10A notation
2. **Factory:** Winner determination logic for each method
3. **UI:** Scoring method selector (Games/Aggregate buttons)
4. **TMX:** Validation understands scoring methods
5. **Testing:** Verify both methods work correctly

## Current Work: Factory (Days 1-2)

**CRITICAL:** Work ONLY on factory until it's published to npm. Do not touch components or TMX yet!

**Repository:** `tods-competition-factory`
**Branch:** `feature/timed-sets-scoring`
**Goal:** Complete, test, and publish factory with scoring methods

Focus on **factory foundation** - get parse/stringify and winner logic working first.

## UI Clarification for TB1

**Set-Level TB1** (`T10P/TB1`, `T10G/TB1`):
- ❌ NO UI changes in matchUpFormat editor
- ❌ NO special input fields in scoring modals
- ✅ Notation only - for tournament directors to know resolution method
- Score entry: Normal score fields (20-20, then TD resolves manually)

**Final Set TB1** (`F:TB1`):
- ✅ YES - Add to matchUpFormat editor final set tiebreak dropdown
- ✅ YES - Add special input fields in scoring modals: [0] or [1] only
- ✅ Constrain inputs to only accept 0 or 1
- Score entry: Bracket notation `[1-0]` or `[0-1]`

### Factory Phase 1 (Parse/Stringify) - STARTING NOW

### Step 1: Factory - Parse/Stringify (2.5 hours)

**Goal:** Support T10A, T10G, T10P notation in matchUpFormatCode

**Files:**
- `/factory/src/helpers/matchUpFormatCode/parse.ts`
- `/factory/src/helpers/matchUpFormatCode/stringify.ts`
- `/factory/src/helpers/matchUpFormatCode/matchUpFormatCode.test.ts`

**Changes:**
1. Update timed set parsing regex: `/T(\d+)([PGA])?(?:\/TB(\d+))?/`
   - Captures: minutes, scoring method, set-level tiebreak
2. Add `timedScoringMethod` to SetFormat type
3. Parse A/G/P suffix, default to 'games' if missing
4. Parse /TB1 for set-level tiebreak
5. Stringify with A/P suffix (omit G since it's default)
6. Stringify with /TB{n} if set-level tiebreak present
7. Add tests for all combinations

**Examples:**
```typescript
parse('SET3X-S:T10A') → {
  exactly: 3,
  setFormat: {
    timed: true,
    minutes: 10,
    timedScoringMethod: 'aggregate'
  }
}

parse('SET3-S:T10P/TB1') → {
  bestOf: 3,
  setFormat: {
    timed: true,
    minutes: 10,
    timedScoringMethod: 'points',
    tiebreakFormat: { tiebreakTo: 1 }
  }
}

parse('SET3-S:T10') → {
  bestOf: 3,
  setFormat: {
    timed: true,
    minutes: 10,
    timedScoringMethod: 'games'  // default
  }
}
```

### Step 2: Factory - Winner Determination (2 hours)

**Goal:** Calculate winner based on scoring method

**File:** `/factory/src/assemblies/generators/mocks/generateOutcomeFromScoreString.ts`

**Changes:**
1. Check if format is timed + exactly + aggregate
2. If aggregate: sum all scores → determine winner
3. If games (default): count periods won → determine winner
4. Add tests for both methods

**Example:**
```typescript
generateOutcomeFromScoreString({
  scoreString: '100-1 0-30 0-30',
  matchUpFormat: 'SET3X-S:T10A',
}) → winningSide: 1 (aggregate: 100 > 61)

generateOutcomeFromScoreString({
  scoreString: '100-1 0-30 0-30',
  matchUpFormat: 'SET3X-S:T10G',
}) → winningSide: 2 (periods won: 2 > 1)
```

### Step 3: Factory Build, Test, Publish (1 hour)

Run all tests, verify nothing broke, commit, publish to npm.

**Commands:**
```bash
cd ~/Development/GitHub/CourtHive/factory
npm test
git add .
git commit -m "feat: timed sets scoring methods (A/G/P) and TB1"
npm version minor
npm publish
git push origin main --tags
```

---

## ⏸️ STOP HERE - PUBLISH CHECKPOINT

**Before proceeding to components:**
- ✅ Verify factory published: `npm info tods-competition-factory`
- ✅ New version available on npm
- ✅ All tests passing

**DO NOT work on components or TMX until factory is published!**

---

## Day 3 Plan (After Factory Publish)

### Step 4: courthive-components - Update Dependencies (15 min)

```bash
cd ~/Development/GitHub/CourtHive/courthive-components
npm update tods-competition-factory
npm list tods-competition-factory  # verify version
npm run build  # ensure it works
```

### Step 5: courthive-components - UI Updates (2 hours)

Add scoring method selector and conditional [1] in tiebreak dropdown

### Step 6: courthive-components - Test & Publish (45 min)

Test, commit, publish to npm

---

## ⏸️ STOP HERE - PUBLISH CHECKPOINT #2

**Before proceeding to TMX:**
- ✅ Verify components published: `npm info courthive-components`
- ✅ New version available on npm

**DO NOT work on TMX until components is published!**

---

## Days 4-5 Plan (After Components Publish)

### Step 7: TMX - Update Dependencies & Validation (2 hours)

Update both dependencies, modify validation logic

### Step 8: TMX - Integration & Testing (2 hours)

Test all scoring methods in both modals

---

## ~~Old Step 1~~ (Superseded)

**File:** `/TMX/src/components/modals/scoringV2/utils/scoreValidator.ts`

**Current code (lines 323-360):**
```typescript
if (isTimed && isExactlyFormat) {
  // Validation only, returns sets WITHOUT winningSide
  return {
    isValid: true,
    sets: sets.map(set => ({
      side1Score: set.side1,
      side2Score: set.side2,
      // No winningSide for timed sets - determined externally ← PROBLEM!
    })),
    matchUpStatus: COMPLETED,
    matchUpFormat,
  };
}
```

**New code:**
```typescript
if (isTimed && isExactlyFormat) {
  // Convert sets to score string for factory parsing
  const scoreString = sets
    .map(set => `${set.side1 || 0}-${set.side2 || 0}`)
    .join(' ');
  
  // Use factory to parse and determine winningSide per set
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
  
  // Count periods won (factory already determined winningSide per set)
  const periodsWon = { side1: 0, side2: 0 };
  parsedSets.forEach((set: any) => {
    if (set.winningSide === 1) periodsWon.side1++;
    else if (set.winningSide === 2) periodsWon.side2++;
  });
  
  // Determine match winner based on periods won
  let matchWinningSide: number | undefined;
  if (periodsWon.side1 > periodsWon.side2) {
    matchWinningSide = 1;
  } else if (periodsWon.side2 > periodsWon.side1) {
    matchWinningSide = 2;
  }
  // else: tie (each won same number of periods)
  
  // Build scoreObject for display (call existing validateScore for this)
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

**What this does:**
1. Takes dynamicSets input: `[{side1: 33, side2: 37}, {side1: 22, side2: 21}, {side1: 20, side2: 24}]`
2. Converts to string: `"33-37 22-21 20-24"`
3. Passes to factory's `parseScoreString()`
4. Factory returns: `[{..., winningSide: 2}, {..., winningSide: 1}, {..., winningSide: 2}]`
5. Counts periods won: side1=1, side2=2
6. Returns match winningSide: 2

### Step 2: Test in TMX - 30 minutes

**Test cases:**

1. **Standard timed sets:**
   - Format: SET3X-S:T10
   - DynamicSets: Enter 33, 37 | 22, 21 | 20, 24
   - Expected: side2 wins (2 periods won)
   - FreeScore: Enter "33-37 22-21 20-24"
   - Expected: same winner
   - ✅ Both modals show side2 winner

2. **Dominant winner:**
   - Format: SET3X-S:T10
   - DynamicSets: 50, 30 | 48, 27 | 40, 25
   - Expected: side1 wins all 3 periods
   - ✅ Shows side1 winner

3. **Tie scenario:**
   - Format: SET2X-S:T10
   - DynamicSets: 50, 40 | 30, 40
   - Expected: Each wins 1 period → no winner
   - ✅ No winningSide shown (or needs UI for tie handling)

4. **Single set:**
   - Format: SET1-S:T20
   - DynamicSets: 75, 68
   - Expected: side1 wins
   - ✅ Shows side1 winner

5. **Regular format unchanged:**
   - Format: SET3-S:6/TB7
   - DynamicSets: 6, 3 | 3, 6 | 6, 4
   - Expected: side1 wins 2 sets
   - ✅ Shows side1 winner (existing logic still works)

### Step 3: Handle Edge Cases - 15 minutes

**Tie handling:**
When periodsWon are equal (1-1 in SET2X, or 1-1-1 in SET3X if possible):
- Current: `winningSide = undefined`
- Question: Should UI show "Tie" or require manual winner selection?
- Decision: Leave as undefined for now, can add UI later

**Single set (SET1):**
- Already works (winner = whoever scored more in that set)

**Incomplete sets:**
- Already handled by existing validation
- Factory's parseScoreString will still determine winningSide per completed set

### Step 4: Update Documentation - 15 minutes

**Update TIMED_SETS_SUPPORT.md:**

Add section:
```markdown
## Winner Determination for Timed Sets

### How It Works
Timed sets use a "periods won" approach:
1. Each timed set is treated as a period
2. The side with more points in a period "wins" that period
3. Match winner = whoever wins more periods

### Why Not True Aggregate?
Originally thought freeScore used aggregate (total points across all sets).
Actually uses "periods won" which is mathematically equivalent to aggregate
except for tie scenarios.

Example:
- Scores: 33-37 | 22-21 | 20-24
- Periods won: side2 wins sets 1 & 3 → winner
- Aggregate: side1=75, side2=82 → same winner

### Tie Scenarios
When each side wins equal periods:
- SET2X: 50-40 | 30-40 → each wins 1 → no winningSide
- Currently returns winningSide=undefined
- Future: May add UI for tie-breaking rules

### Implementation
Both modals use factory's `parseScoreString()` which determines
winningSide per set based on higher score.
```

## Time Estimate
- Code changes: 30 min
- Testing: 30 min
- Edge cases: 15 min
- Documentation: 15 min
- **Total: 90 minutes**

## Success Criteria
✅ DynamicSets determines winner for timed sets
✅ FreeScore and DynamicSets show same winner for same scores
✅ Regular formats unaffected
✅ Tie scenarios handled gracefully
✅ Documentation updated

## Notes
- Factory's existing logic works perfectly for timed sets
- No factory changes needed
- Just need to use factory's parsing in dynamicSets path
- "Periods won" ≈ aggregate scoring (except ties)
