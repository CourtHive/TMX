# Factory Code Investigation - Irregular Endings

## Key Discovery

The factory's `tidyScore()` has a **`handleRetired`** method but no corresponding **`handleWalkover`** or **`handleDefaulted`** methods.

## Console Evidence

```json
{
    "processedScore": "6-3 DEFAULTED",
    "result": {
        "modifications": [
            {
                "method": "handleRetired",  // <-- Only this method exists
                "score": "6-3 defaulted"
            },
            {
                "method": "removeDanglingBits",  // <-- DEFAULTED removed here
                "score": "6-3"
            }
        ],
        "isValid": true,
        "score": "6-3"
    }
}
```

## Questions to Investigate

### 1. How does WALKOVER work?

**Test this in browser console:**
```javascript
// Test WALKOVER
console.log('WALKOVER:', tournamentEngine.tidyScore({ score: '6-3 WALKOVER' }));

// Expected: Does it return matchUpStatus: 'WALKOVER'?
// Or does it also get removed as a dangling bit?
```

**Possible answers:**
- **Option A:** WALKOVER is handled by `handleRetired` (method handles multiple statuses)
- **Option B:** There's a separate method we haven't seen yet
- **Option C:** WALKOVER also gets removed (same bug as DEFAULTED)

### 2. What does handleRetired actually do?

**Look for in factory source:**
```typescript
// Does it look like this? (specific to RETIRED)
function handleRetired(scoreString: string) {
  const regex = /\bRETIRED\b\s*$/i;
  // ...
}

// Or like this? (handles multiple statuses)
function handleRetired(scoreString: string) {
  const statuses = ['RETIRED', 'WALKOVER'];
  // ...
}
```

### 3. What is removeDanglingBits?

This method removes text that isn't recognized as valid score data.

**Current behavior:**
- Recognizes: numbers, hyphens, parentheses (tiebreaks), RETIRED (maybe WALKOVER)
- Removes: DEFAULTED, and any other unrecognized text

**Location:** Likely in same file as handleRetired

```typescript
function removeDanglingBits(scoreString: string) {
  // Remove anything that's not part of a valid score
  // Problem: DEFAULTED is considered a "dangling bit"
}
```

## Recommended Tests in Browser

### Test 1: RETIRED (known to work)
```javascript
tournamentEngine.tidyScore({ score: '6-3 RETIRED' })
// Expected: { score: '6-3', matchUpStatus: 'RETIRED' }
```

### Test 2: WALKOVER (unknown behavior)
```javascript
tournamentEngine.tidyScore({ score: '6-3 WALKOVER' })
// Question: Does this work or also fail?
```

### Test 3: DEFAULTED (known to fail)
```javascript
tournamentEngine.tidyScore({ score: '6-3 DEFAULTED' })
// Known result: { score: '6-3' } - no matchUpStatus
```

### Test 4: Lowercase variations
```javascript
tournamentEngine.tidyScore({ score: '6-3 retired' })
tournamentEngine.tidyScore({ score: '6-3 walkover' })
tournamentEngine.tidyScore({ score: '6-3 defaulted' })
// Do case-insensitive variations work?
```

### Test 5: RET/WO/DEF abbreviations
```javascript
tournamentEngine.tidyScore({ score: '6-3 RET' })
tournamentEngine.tidyScore({ score: '6-3 WO' })
tournamentEngine.tidyScore({ score: '6-3 DEF' })
// Does factory handle abbreviations natively?
```

## Expected Findings

Based on console output, we expect:

| Input | Current Behavior | Expected Behavior |
|-------|-----------------|-------------------|
| `6-3 RETIRED` | ✅ Works | ✅ Works |
| `6-3 WALKOVER` | ❓ Unknown | ✅ Should work |
| `6-3 DEFAULTED` | ❌ Removed | ✅ Should work |
| `6-3 RET` | ❓ Unknown | ✅ Should work (after our conversion) |
| `6-3 WO` | ❓ Unknown | ✅ Should work (after our conversion) |
| `6-3 DEF` | ❌ Removed | ✅ Should work (after our conversion) |

## Factory Code Structure (Presumed)

```typescript
// tidyScore.ts structure (presumed)

function tidyScore({ score }) {
  let scoreString = score;
  const modifications = [];
  
  // Step 1: Handle retired
  const retiredResult = handleRetired(scoreString);
  if (retiredResult) {
    modifications.push({ method: 'handleRetired', score: retiredResult.score });
    scoreString = retiredResult.score;
    // matchUpStatus set here?
  }
  
  // Step 2: Remove dangling bits (this is where DEFAULTED gets removed!)
  const cleanedScore = removeDanglingBits(scoreString);
  if (cleanedScore !== scoreString) {
    modifications.push({ method: 'removeDanglingBits', score: cleanedScore });
    scoreString = cleanedScore;
  }
  
  // ... more processing
  
  return {
    score: scoreString,
    modifications,
    isValid: true
  };
}
```

## Proposed Factory Fix

### Approach A: Add Missing Methods (Simple)

```typescript
function handleRetired(scoreString: string) { /* existing */ }
function handleWalkover(scoreString: string) { /* new */ }
function handleDefaulted(scoreString: string) { /* new */ }

// Update pipeline
const retiredResult = handleRetired(scoreString) || 
                     handleWalkover(scoreString) || 
                     handleDefaulted(scoreString);
```

### Approach B: Refactor to Generic (Better)

```typescript
function handleIrregularEnding(scoreString: string) {
  const statuses = ['RETIRED', 'WALKOVER', 'DEFAULTED'];
  for (const status of statuses) {
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

// Keep handleRetired as alias for backward compatibility
const handleRetired = handleIrregularEnding;
```

## Next Steps

1. ✅ Run browser tests above to confirm WALKOVER behavior
2. ✅ Look at factory source code (if accessible)
3. ✅ Document findings in factory issue
4. ✅ Propose specific fix based on actual code structure
5. ✅ Test TMX workaround handles all cases

---

**After running the browser tests, update this document with actual results!**
