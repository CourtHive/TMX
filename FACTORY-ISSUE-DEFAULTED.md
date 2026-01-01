# Factory Issue: Add DEFAULTED Support to tidyScore

## Issue for tods-competition-factory Repository

---

### Title
Add support for DEFAULTED matchUpStatus in tidyScore and related functions

### Description

The `tidyScore()` function currently recognizes `RETIRED` and `WALKOVER` as valid irregular ending statuses, but does not recognize `DEFAULTED`. When "DEFAULTED" appears at the end of a score string, it is treated as a "dangling bit" and removed rather than being returned as a `matchUpStatus`.

### Current Behavior

```typescript
tidyScore({ score: '6-3 3-6 DEFAULTED' })

// Returns:
{
  "modifications": [
    {
      "method": "handleRetired",
      "score": "6-3 3-6 defaulted"
    },
    {
      "method": "removeDanglingBits",
      "score": "6-3 3-6"
    }
  ],
  "isValid": true,
  "score": "6-3 3-6"
  // matchUpStatus is NOT returned
}
```

### Expected Behavior

```typescript
tidyScore({ score: '6-3 3-6 DEFAULTED' })

// Should return:
{
  "score": "6-3 3-6",
  "matchUpStatus": "DEFAULTED",
  "isValid": true
}
```

### Why This Matters

1. **Tennis Regulations:** DEFAULTED is a valid and distinct irregular ending in tennis (different from RETIRED or WALKOVER)
2. **ITF/ATP/WTA Scoring:** Official tennis bodies use DEFAULTED as a matchUpStatus
3. **Consistency:** DEFAULTED should be treated the same as RETIRED and WALKOVER
4. **User Experience:** TMX users expect "DEF" abbreviation to work like "RET" and "WO"

### Current Code Structure

The factory has a `handleRetired` method but no corresponding `handleWalkover` or `handleDefaulted` methods. This causes DEFAULTED to be treated as a "dangling bit" and removed.

### Proposed Solution

**Option 1: Add handleDefaulted method** (mirrors existing handleRetired)

```typescript
function handleDefaulted(scoreString: string) {
  const regex = /\bDEFAULTED\b\s*$/i;
  if (regex.test(scoreString)) {
    return {
      score: scoreString.replace(regex, '').trim(),
      matchUpStatus: 'DEFAULTED'
    };
  }
  return null;
}

// Add to tidyScore pipeline
let result = handleRetired(scoreString) || 
             handleWalkover(scoreString) || 
             handleDefaulted(scoreString);
```

**Option 2: Refactor to Generic Method** (recommended - more maintainable)

```typescript
// Rename handleRetired to handleIrregularEnding
function handleIrregularEnding(scoreString: string) {
  const irregularStatuses = ['RETIRED', 'WALKOVER', 'DEFAULTED'];
  
  for (const status of irregularStatuses) {
    const regex = new RegExp(`\\b${status}\\b\\s*$`, 'i');
    if (regex.test(scoreString)) {
      return {
        score: scoreString.replace(regex, '').trim(),
        matchUpStatus: status
      };
    }
  }
  return null;
}

// In tidyScore pipeline
const result = handleIrregularEnding(scoreString);
if (result) {
  modifications.push({
    method: 'handleIrregularEnding',
    score: result.score
  });
  scoreString = result.score;
  matchUpStatus = result.matchUpStatus;
}
```

**Recommendation:** Option 2 is preferred because:
- Single source of truth for irregular endings
- Easier to add new statuses (e.g., SUSPENDED, ABANDONED)
- More maintainable code
- Can keep `handleRetired` as alias for backward compatibility

#### 2. Update generateOutcomeFromScoreString

Ensure DEFAULTED is recognized alongside RETIRED and WALKOVER:

```typescript
const validIrregularStatuses = ['RETIRED', 'WALKOVER', 'DEFAULTED'];
```

#### 3. Add matchUpStatus Constant

```typescript
// In matchUpStatusConstants.ts
export const DEFAULTED = 'DEFAULTED';
```

#### 4. Add Tests

```typescript
describe('tidyScore - DEFAULTED support', () => {
  it('should recognize DEFAULTED as irregular ending', () => {
    const result = tidyScore({ score: '6-3 3-6 DEFAULTED' });
    expect(result.score).toBe('6-3 3-6');
    expect(result.matchUpStatus).toBe('DEFAULTED');
  });

  it('should handle DEFAULTED case-insensitively', () => {
    const result = tidyScore({ score: '6-3 3-6 defaulted' });
    expect(result.score).toBe('6-3 3-6');
    expect(result.matchUpStatus).toBe('DEFAULTED');
  });

  it('should handle incomplete score with DEFAULTED', () => {
    const result = tidyScore({ score: '6-3 DEFAULTED' });
    expect(result.score).toBe('6-3');
    expect(result.matchUpStatus).toBe('DEFAULTED');
  });

  it('should handle DEFAULTED with tiebreak scores', () => {
    const result = tidyScore({ score: '7-6(5) 3-4 DEFAULTED' });
    expect(result.score).toBe('7-6(5) 3-4');
    expect(result.matchUpStatus).toBe('DEFAULTED');
  });
});
```

### Files to Modify

1. **tidyScore.ts** - Add DEFAULTED to irregular statuses list
2. **generateOutcomeFromScoreString.ts** - Recognize DEFAULTED status
3. **matchUpStatusConstants.ts** - Add DEFAULTED constant
4. **tidyScore.test.ts** - Add test coverage

### Impact

- **Breaking Change:** No - purely additive
- **Backward Compatible:** Yes - existing RETIRED/WALKOVER functionality unchanged
- **Performance Impact:** Negligible - just one more string to check

### Current Workaround

TMX has implemented a local workaround that detects DEFAULTED after factory processing and manually sets the matchUpStatus. This workaround should be removed once factory support is added.

### Related

This aligns with official tennis scoring standards:
- ITF Rules of Tennis
- ATP/WTA tournament regulations
- Grand Slam scoring guidelines

All recognize DEFAULTED as a distinct matchUpStatus separate from RETIRED or WALKOVER.

### Labels

- `enhancement`
- `scoring`
- `good first issue` (simple addition)

---

**Would you like me to submit a PR with this change?**
