# Debugging DEF Abbreviation Issue

## Issue
DEF is not being recognized as DEFAULTED irregular ending in the freeText scoring modal.

## Changes Made

### 1. Added Debugging Logs
Added console.log statements to track the abbreviation conversion:

**File:** `src/components/modals/scoringV2/utils/scoreValidator.ts`

```typescript
// Line ~40: When abbreviation is converted
console.log(`[tidyScore] Converted ${abbrev} to ${fullWord}:`, processedScore);

// Line ~47: After factory tidyScore call
console.log('[tidyScore] Factory result:', { processedScore, result });
```

## How to Debug

### Step 1: Open Browser Console
1. Open TMX in browser
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to Console tab

### Step 2: Enter Score with DEF
1. Open a match for scoring
2. In the freeText input, type: `6-3 3-6 DEF`
3. Watch the console output

### Expected Console Output

You should see two log messages:

```
[tidyScore] Converted DEF to DEFAULTED: 6-3 3-6 DEFAULTED
[tidyScore] Factory result: { 
  processedScore: '6-3 3-6 DEFAULTED',
  result: { 
    score: '6-3 3-6',
    matchUpStatus: 'DEFAULTED'  // <-- This is what we need
  }
}
```

## Possible Issues

### Issue 1: Factory Not Returning matchUpStatus
If the factory result doesn't include `matchUpStatus: 'DEFAULTED'`, then the issue is in tods-competition-factory's `tidyScore()` function.

**Solution:** The factory's tidyScore needs to recognize "DEFAULTED" as a keyword and return it in matchUpStatus.

### Issue 2: Abbreviation Not Converting
If you don't see the first log message, the regex isn't matching.

**Check:**
- Is there extra whitespace?
- Is DEF at the end of the string?
- Try with different casing: `def`, `Def`, `DEF`

### Issue 3: Status Not Being Used
If the conversion works and factory returns status, but UI doesn't show it:

**Check `freeTextApproach.ts` line ~298:**
```typescript
const isIrregularEnding = ['RETIRED', 'WALKOVER', 'DEFAULTED'].includes(tidyResult.matchUpStatus || '');
```

## Factory Investigation

The issue might be that the factory's `tidyScore()` function doesn't handle the "DEFAULTED" keyword. Let's verify:

### Test in Console
```javascript
// In browser console
const { tournamentEngine } = window;

// Test with RETIRED (known to work)
console.log('RETIRED:', tournamentEngine.tidyScore({ score: '6-3 3-6 RETIRED' }));

// Test with DEFAULTED
console.log('DEFAULTED:', tournamentEngine.tidyScore({ score: '6-3 3-6 DEFAULTED' }));

// Expected both to return matchUpStatus
```

## Workaround (If Factory Doesn't Support DEFAULTED)

If the factory doesn't recognize "DEFAULTED", we have two options:

### Option 1: Map DEF to RETIRED (Temporary)
In `scoreValidator.ts`:
```typescript
const irregularEndingMap: { [key: string]: string } = {
  'RET': 'RETIRED',
  'WO': 'WALKOVER', 
  'DEF': 'RETIRED', // Temporarily map to RETIRED which factory supports
};
```

### Option 2: Handle DEFAULTED Locally
In `freeTextApproach.ts`, add special handling:
```typescript
// If factory doesn't return matchUpStatus for DEFAULTED, detect it manually
if (!tidyResult.matchUpStatus && /DEFAULTED\s*$/i.test(scoreString)) {
  tidyResult.matchUpStatus = 'DEFAULTED';
}
```

## Next Steps

1. **Run the app and test** - Enter "6-3 3-6 DEF" and check console
2. **Share console output** - Copy the logs and share for analysis
3. **Test factory directly** - Run the console test above
4. **Determine root cause**:
   - Is abbreviation converting? ✓ or ✗
   - Is factory returning status? ✓ or ✗
   - Is UI using the status? ✓ or ✗

## Files to Check

1. `src/components/modals/scoringV2/utils/scoreValidator.ts` - Abbreviation conversion
2. `src/components/modals/scoringV2/approaches/freeTextApproach.ts` - Status handling
3. Factory source (if needed) - tidyScore implementation

---

**Once you have the console output, we can determine the exact issue and implement the right fix!**
