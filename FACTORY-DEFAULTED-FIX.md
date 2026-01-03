# Factory tidyScore - DEFAULTED Support

## Issue Analysis

From the console output:
```json
{
    "processedScore": "6-3 DEFAULTED",
    "result": {
        "modifications": [
            {
                "method": "handleRetired",
                "score": "6-3 defaulted"
            },
            {
                "method": "removeDanglingBits",
                "score": "6-3"
            }
        ],
        "isValid": true,
        "score": "6-3"
    }
}
```

**Problem:** The factory's `tidyScore()`:
1. ✅ Receives "DEFAULTED" correctly (processedScore: "6-3 DEFAULTED")
2. ❌ Calls `handleRetired` method (treating DEFAULTED like RETIRED)
3. ❌ Then calls `removeDanglingBits` which strips "DEFAULTED" entirely
4. ❌ Returns only "6-3" without any `matchUpStatus`

**Root Cause:** tidyScore treats "DEFAULTED" as an invalid "dangling bit" to be removed, not as a valid irregular ending status like "RETIRED" or "WALKOVER".

---

## Factory Fix Needed

The `tidyScore()` function in tods-competition-factory has a `handleRetired` method but no corresponding `handleWalkover` or `handleDefaulted` methods.

### Location in Factory

File: `tods-competition-factory/src/assemblies/governors/scoreGovernor/tidyScore.ts`

### Current Implementation (Based on Console Output)

```typescript
// There's a handleRetired method
function handleRetired(scoreString: string) {
  const regex = /\bRETIRED\b\s*$/i;
  if (regex.test(scoreString)) {
    return {
      score: scoreString.replace(regex, '').trim(),
      matchUpStatus: 'RETIRED'
    };
  }
  return null;
}

// WALKOVER may be handled in handleRetired or elsewhere
// But DEFAULTED is NOT handled - it gets removed by removeDanglingBits
```

### Proposed Fix - Option 1: Add Separate Methods

```typescript
function handleRetired(scoreString: string) {
  const regex = /\bRETIRED\b\s*$/i;
  if (regex.test(scoreString)) {
    return {
      score: scoreString.replace(regex, '').trim(),
      matchUpStatus: 'RETIRED'
    };
  }
  return null;
}

function handleWalkover(scoreString: string) {
  const regex = /\bWALKOVER\b\s*$/i;
  if (regex.test(scoreString)) {
    return {
      score: scoreString.replace(regex, '').trim(),
      matchUpStatus: 'WALKOVER'
    };
  }
  return null;
}

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

// In tidyScore pipeline
const modifications = [];
let result = handleRetired(scoreString) || 
             handleWalkover(scoreString) || 
             handleDefaulted(scoreString);
```

### Proposed Fix - Option 2: Rename to Generic Method (Better)

```typescript
// Rename handleRetired to handleIrregularEnding (more generic)
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
const modifications = [];
let result = handleIrregularEnding(scoreString);
if (result) {
  modifications.push({
    method: 'handleIrregularEnding',
    score: result.score
  });
  scoreString = result.score;
  matchUpStatus = result.matchUpStatus;
}
```

**Option 2 is preferred** because:
- More maintainable (single method for all irregular endings)
- Easier to add new statuses in future
- Cleaner code structure
- Still backward compatible if `handleRetired` is kept as alias

### Expected Behavior After Fix

```json
{
  "modifications": [
    {
      "method": "handleIrregularEnding",  // or "handleDefaulted"
      "score": "6-3"
    }
  ],
  "score": "6-3",
  "matchUpStatus": "DEFAULTED",
  "isValid": true
}
```

### Investigation Notes

**Key Finding:** Factory has `handleRetired` method but no `handleWalkover` or `handleDefaulted` methods.

**Questions for Factory Maintainer:**
1. How does WALKOVER currently work if there's no handleWalkover method?
   - Is it handled inside handleRetired?
   - Is there another method that handles it?
2. Should we add individual methods (handleDefaulted) or refactor to generic approach?
3. Is there a reason DEFAULTED wasn't included originally?

---

## TMX Workaround (Until Factory is Updated)

Since we can't wait for factory changes, implement a local workaround:

### Option 1: Detect and Set Status After tidyScore

**File:** `src/components/modals/scoringV2/utils/scoreValidator.ts`

```typescript
export function tidyScore(scoreString: string): TidyScoreResult {
  if (!scoreString?.trim()) {
    return { error: 'Score is required' };
  }

  try {
    // Pre-process: Convert abbreviations to full matchUpStatus keywords
    let processedScore = scoreString.trim();
    
    const irregularEndingMap: { [key: string]: string } = {
      'RET': 'RETIRED',
      'WO': 'WALKOVER', 
      'DEF': 'DEFAULTED',
    };
    
    // Track if we converted DEFAULTED (factory doesn't support it yet)
    let detectedDefaulted = false;
    
    // Replace abbreviation at end of string with full keyword
    for (const [abbrev, fullWord] of Object.entries(irregularEndingMap)) {
      const regex = new RegExp(`\\b${abbrev}\\b\\s*$`, 'i');
      if (regex.test(processedScore)) {
        processedScore = processedScore.replace(regex, fullWord);
        if (fullWord === 'DEFAULTED') {
          detectedDefaulted = true;
        }
        break;
      }
    }
    
    // Also check if DEFAULTED is already in the string
    if (/\bDEFAULTED\b\s*$/i.test(processedScore)) {
      detectedDefaulted = true;
    }
    
    const result = tournamentEngine.tidyScore({ score: processedScore });

    if (result?.error) {
      const errorMsg =
        typeof result.error === 'string' ? result.error : result.error?.message || JSON.stringify(result.error);
      return { error: errorMsg };
    }

    // WORKAROUND: Factory doesn't return matchUpStatus for DEFAULTED
    // If we detected DEFAULTED and factory didn't return it, set it manually
    let matchUpStatus = result?.matchUpStatus;
    if (detectedDefaulted && !matchUpStatus) {
      matchUpStatus = 'DEFAULTED';
    }

    return {
      tidyScore: result?.score,
      matchUpStatus: matchUpStatus,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid format' };
  }
}
```

### Option 2: Map DEF to RETIRED (Simpler but Less Accurate)

**File:** `src/components/modals/scoringV2/utils/scoreValidator.ts`

```typescript
const irregularEndingMap: { [key: string]: string } = {
  'RET': 'RETIRED',
  'WO': 'WALKOVER', 
  'DEF': 'RETIRED', // Map to RETIRED temporarily (factory supports this)
};
```

**Pros:** Simpler, works immediately
**Cons:** DEF shows as "RETIRED" instead of "DEFAULTED" in UI

---

## Recommended Approach

### Immediate (TMX): Option 1 Workaround
Implement the local detection in TMX to set `matchUpStatus: 'DEFAULTED'` when factory doesn't return it.

### Long-term (Factory): Submit PR or Issue
1. Create issue in tods-competition-factory repo
2. Propose adding 'DEFAULTED' to irregular statuses list
3. Update tidyScore to recognize it like RETIRED/WALKOVER

---

## Additional Factory Changes Needed

### 1. generateOutcomeFromScoreString

Should also recognize DEFAULTED:

```typescript
// In generateOutcomeFromScoreString
const validIrregularStatuses = ['RETIRED', 'WALKOVER', 'DEFAULTED'];
```

### 2. matchUpStatusConstants

Ensure DEFAULTED is defined:

```typescript
export const DEFAULTED = 'DEFAULTED';
```

### 3. Tests

Add test cases for DEFAULTED:

```typescript
it('should handle DEFAULTED status', () => {
  const result = tidyScore({ score: '6-3 3-6 DEFAULTED' });
  expect(result.score).toBe('6-3 3-6');
  expect(result.matchUpStatus).toBe('DEFAULTED');
});

it('should handle DEF abbreviation', () => {
  const result = tidyScore({ score: '6-3 3-6 DEF' });
  expect(result.score).toBe('6-3 3-6');
  expect(result.matchUpStatus).toBe('DEFAULTED');
});
```

---

## Implementation Priority

1. **Immediate:** Implement TMX workaround (Option 1) ✅
2. **This Week:** File factory issue with this documentation
3. **Next Sprint:** Submit factory PR with fix
4. **After Factory Update:** Remove TMX workaround

---

## Files to Modify

### In TMX (Now)
- `src/components/modals/scoringV2/utils/scoreValidator.ts` - Add DEFAULTED detection

### In Factory (Later)
- `src/assemblies/governors/scoreGovernor/tidyScore.ts` - Add DEFAULTED support
- `src/assemblies/governors/scoreGovernor/generateOutcomeFromScoreString.ts` - Recognize DEFAULTED
- `src/constants/matchUpStatusConstants.ts` - Define DEFAULTED constant
- `src/assemblies/governors/scoreGovernor/__tests__/tidyScore.test.ts` - Add tests

---

**Let's implement the TMX workaround now, then file a factory issue for the long-term fix!**
