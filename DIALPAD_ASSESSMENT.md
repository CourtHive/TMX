# DialPad Scoring Modal Assessment

## Executive Summary

The dialPad approach **does NOT support timed sets** (SET3X-S:T10, SET3X-S:T10A) and needs significant updates to:
1. Support timed set formats with unrestricted score entry
2. Use factory's `preserveSideOrder` parameter for consistency
3. Align validation logic with freeScore and dynamicSets approaches

## Current State Analysis

### Files
- `dialPadApproach.ts` (703 lines) - Main UI component
- `dialPadLogic.ts` (264 lines) - Score formatting logic
- `dialPadApproach.test.ts` (196 lines) - Tests for scoreToDigits function

### What dialPad Does Well
1. **Incremental score building** - Builds scoreString digit-by-digit based on format rules
2. **Format-aware boundaries** - Respects setTo/tiebreakAt limits for traditional formats
3. **Tiebreak-only support** - Handles TB10/TB7 formats with bracket notation
4. **Existing score loading** - `scoreToDigits()` converts score objects back to digit strings
5. **Validation integration** - Uses `validateScore()` for proper validation

### Critical Limitations

#### 1. No Timed Set Support
**Current behavior:**
```typescript
// dialPadLogic.ts line 51-57
const setTo = currentTiebreakSetTo || currentRegularSetTo || 6;
const tiebreakAt = currentSetFormat?.tiebreakAt || setTo;

// For regular sets, enforce maxScore bounds
const potentialValue = side1 + nextDigit;
const val = Number.parseInt(potentialValue);

// Check if adding this digit would create a valid score
// For setTo=4: valid scores are 0-5, so if val>5 after adding digit, stop
// For setTo=6: valid scores are 0-7, so if val>7 after adding digit, stop
const maxScore = setTo + 1;

if (val > maxScore) break;
```

**Problem:**
- Timed formats (T10) have `timed: true, minutes: 10` but NO `setTo` property
- `setTo` defaults to 6, creating wrong boundaries
- Scores like "30-1" are impossible to enter (stops at "7-1")

**Test case missing:**
No tests for timed formats (`T10`, `T10A`, etc.)

#### 2. No Format Detection for Timed Sets
```typescript
// dialPadLogic.ts - missing
const isTimed = currentSetFormat?.timed === true;
```

The code never checks if a set is timed, so it always applies traditional score boundaries.

#### 3. No Aggregate Scoring Awareness
The dialPad has no concept of aggregate scoring (`based: 'A'`). While validation happens via `validateScore()`, the UI doesn't show aggregate totals or provide any indication that scoring is aggregate-based.

### Comparison with Other Approaches

| Feature | freeScore | dynamicSets | dialPad |
|---------|-----------|-------------|---------|
| **Timed sets (T10)** | ✅ Yes | ✅ Yes | ❌ No |
| **Aggregate (T10A)** | ✅ Yes | ✅ Yes | ⚠️ Partial (validates but no UI) |
| **Uses factory preserveSideOrder** | ✅ Yes | ✅ Yes (via validateSetScores) | ⚠️ Indirect (via validateScore) |
| **Unrestricted score entry** | ✅ Yes | ✅ Yes | ❌ No (bounded by setTo) |
| **Format-specific validation** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Handles TB1NOAD** | ✅ Yes | ✅ Yes | ✅ Yes (via validation) |

## Required Changes

### 1. Add Timed Set Detection (dialPadLogic.ts)

**Location:** `formatScoreString()` function, around line 51

**Change:**
```typescript
const currentSetFormat = getSetFormat(setCount + 1);
const currentTiebreakSetTo = currentSetFormat?.tiebreakSet?.tiebreakTo;
const currentRegularSetTo = currentSetFormat?.setTo;
const currentSetIsTiebreakOnly = !!currentTiebreakSetTo && !currentRegularSetTo;
const currentSetIsTimed = currentSetFormat?.timed === true;  // NEW

// For timed sets, don't enforce score boundaries (allow any score)
const setTo = currentSetIsTimed 
  ? 999  // Effectively unlimited for timed sets
  : (currentTiebreakSetTo || currentRegularSetTo || 6);
  
const tiebreakAt = currentSetFormat?.tiebreakAt || setTo;
```

**Why 999?**
- Timed sets can have any score (0-99+ per side)
- Using 999 allows the existing digit-parsing logic to work without major refactor
- Still bounded (prevents infinite input), but effectively unlimited for practical purposes

### 2. Update Score Parsing for Timed Sets (dialPadLogic.ts)

**Location:** Side score parsing loop, around line 72

**Change:**
```typescript
// For tiebreak-only formats (TB10), user MUST use minus to separate scores
// So keep consuming all digits until we hit a minus
if (currentSetIsTiebreakOnly || currentSetIsTimed) {  // Add timed check
  side1 += nextDigit;
  i++;
  continue;
}

// For regular sets, enforce maxScore bounds
const potentialValue = side1 + nextDigit;
const val = Number.parseInt(potentialValue);

// For timed sets, allow unlimited digits (up to 999)
const maxScore = currentSetIsTimed ? 999 : (setTo + 1);

if (val > maxScore) break;
```

### 3. Add Aggregate Scoring UI Indicator (dialPadApproach.ts)

**Location:** After matchUpFormat display, around line 100

**Add:**
```typescript
// Show aggregate scoring indicator if format uses aggregate
const parsedFormat = matchUpFormatCode.parse(matchUp.matchUpFormat);
const isAggregateScoring = parsedFormat?.setFormat?.based === 'A' || 
                          parsedFormat?.finalSetFormat?.based === 'A';

if (isAggregateScoring) {
  const aggregateIndicator = document.createElement('div');
  aggregateIndicator.style.fontSize = '0.75em';
  aggregateIndicator.style.color = '#666';
  aggregateIndicator.style.marginTop = '0.25em';
  aggregateIndicator.textContent = '⚠️ Aggregate Scoring: Winner determined by total points';
  container.appendChild(aggregateIndicator);
}
```

### 4. Add Timed Set Tests

**Create:** `dialPadLogic.test.ts` (new file)

**Tests needed:**
```typescript
describe('dialPadLogic - Timed sets', () => {
  it('should format SET3X-S:T10 score 10-0 0-1 0-1', () => {
    const digits = '1000101';
    const result = formatScoreString(digits, { matchUpFormat: 'SET3X-S:T10' });
    expect(result).toBe('10-0 0-1 0-1');
  });

  it('should allow high scores for timed sets (30-25)', () => {
    const digits = '3025';
    const result = formatScoreString(digits, { matchUpFormat: 'SET3X-S:T10' });
    expect(result).toBe('30-25');
  });

  it('should handle aggregate with TB1 final', () => {
    const digits = '3025 2530 -10';
    const result = formatScoreString(digits, { matchUpFormat: 'SET3X-S:T10A-F:TB1' });
    expect(result).toBe('30-25 25-30 [1-0]');
  });

  it('should not restrict scores for timed sets', () => {
    const digits = '99-0'; // Should be allowed
    const result = formatScoreString(digits, { matchUpFormat: 'SET3X-S:T10' });
    expect(result).toBe('99-0');
  });
});

describe('dialPadApproach - scoreToDigits for timed sets', () => {
  it('should convert timed set score to digits', () => {
    const score = {
      sets: [
        { side1Score: 30, side2Score: 1, winningSide: 1 },
        { side1Score: 0, side2Score: 1, winningSide: 2 },
        { side1Score: 0, side2Score: 1, winningSide: 2 }
      ]
    };
    expect(scoreToDigits(score)).toBe('301 01 01');
  });
});
```

### 5. Update scoreToDigits for Timed Sets (dialPadApproach.ts)

**Location:** `scoreToDigits()` function, around line 29

**Current code works, but add separator handling:**
```typescript
scoreObject.sets.forEach((set: any, index: number) => {
  // Add separator between sets
  if (index > 0) {
    digitParts.push(' ');  // Already correct
  }
  
  // Add game scores
  digitParts.push(set.side1Score?.toString() || '0');
  // For timed sets with high scores, add explicit separator
  const needsSeparator = set.side1Score >= 10 || set.side2Score >= 10;
  if (needsSeparator) digitParts.push('-');  // NEW: Add explicit minus
  
  digitParts.push(set.side2Score?.toString() || '0');
  
  // ... rest of tiebreak handling
});
```

## Effort Estimation

### Low Effort (1-2 hours)
- ✅ Add timed set detection (`isTimed` flag)
- ✅ Update maxScore calculation (use 999 for timed sets)
- ✅ Update side score parsing to allow unlimited digits for timed sets
- ✅ Add aggregate scoring UI indicator

### Medium Effort (2-4 hours)
- ✅ Update `scoreToDigits()` with explicit separators for high scores
- ✅ Write comprehensive tests for timed formats
- ✅ Test dialPad with various timed formats (T10, T10A, T10A-F:TB1)
- ✅ Update documentation

### Total: 3-6 hours

## Testing Strategy

### Manual Testing Checklist
- [ ] Enter score `10-0 0-1 0-1` for format `SET3X-S:T10`
- [ ] Enter score `30-25 25-30 [1-0]` for format `SET3X-S:T10A-F:TB1`
- [ ] Enter high scores (50+, 99) for timed sets
- [ ] Verify aggregate indicator shows for T10A formats
- [ ] Verify winningSide calculated correctly (via validateScore)
- [ ] Load existing timed set score into dialPad (scoreToDigits)
- [ ] Compare behavior with freeScore and dynamicSets

### Automated Tests Needed
- [ ] formatScoreString with T10 format
- [ ] formatScoreString with T10A format
- [ ] formatScoreString with high scores (30+)
- [ ] scoreToDigits with timed set scores
- [ ] Integration test: full dialPad entry for T10 format

## Factory Integration Status

### Already Using Factory
- ✅ `validateScore()` - Uses factory's `generateOutcomeFromScoreString` with `preserveSideOrder: true`
- ✅ `matchUpFormatCode.parse()` - Uses factory to parse format codes
- ✅ Format validation - Indirect via `validateScore()`

### Not Using Factory Directly
- ⚠️ Score formatting logic (`formatScoreString`) - Custom implementation
- ⚠️ Digit boundaries - Custom maxScore calculation
- ⚠️ Set completion logic - Custom state tracking

**Note:** dialPad's custom logic is necessary for its incremental digit-by-digit entry UX. The key is ensuring it produces valid scoreStrings that factory can validate.

## Recommendations

### Priority 1: Enable Timed Sets (Required)
Implement changes 1, 2, and 4 to support timed formats. This is **critical** since freeScore and dynamicSets both support timed sets, making dialPad the only approach that doesn't work.

### Priority 2: Add Aggregate UI Indicator (Nice to have)
Implement change 3 to help users understand aggregate scoring. This is less critical since validation still works, but improves UX.

### Priority 3: Comprehensive Testing (Required)
Add tests in change 4 to ensure timed sets work correctly. Without tests, regressions are likely.

### Priority 4: Documentation (Nice to have)
Update dialPad documentation to explain timed set support and aggregate scoring behavior.

## Conclusion

**Current Status:** dialPad is **incompatible** with timed set formats (SET3X-S:T10, SET3X-S:T10A)

**Fix Complexity:** **Low to Medium** (3-6 hours)

**Risk:** **Low** - Changes are localized to digit parsing logic and don't affect existing functionality for traditional formats

**Impact:** **High** - Makes dialPad consistent with other approaches and enables full format support

**Recommendation:** Implement Priority 1 and 3 changes immediately to achieve parity with freeScore and dynamicSets.
