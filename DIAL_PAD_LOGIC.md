# Dial Pad Scoring Logic - Pseudocode

## State Variables

```
state = {
  digits: string  // Raw input digits with spaces, e.g., "673 63"
}

matchUp = {
  matchUpFormat: string  // e.g., "SET3-S:6/TB7"
  score: {
    scoreStringSide1: string
    scoreStringSide2: string
    sets: array
  }
}
```

## Core Methods Called

### 1. `formatScore(digits)` → formatted score string
- Input: Raw digits string (e.g., "673")
- Output: Formatted score (e.g., "6-7(3)")
- Calls: `formatScoreString()` from dialPadLogic.ts

### 2. `validateScore(scoreString, matchUpFormat)` → validation object
- Input: Formatted score string and format
- Output: `{ isValid, winningSide, sets, ... }`
- Calls: `validateScore()` from tods-competition-factory

### 3. `matchUpFormatCode.parse(matchUpFormat)` → parsed format
- Input: Format code string
- Output: `{ setFormat: { bestOf, setTo, tiebreakAt, ... }, ... }`

## Main Logic Flow

### A. User Presses Digit/Button → `handleDigitPress(digit)`

```
FUNCTION handleDigitPress(digit):
  
  // 1. Calculate current state
  currentScoreString = formatScore(state.digits)
  inTiebreak = currentScoreString.includes('(') AND NOT currentScoreString.includes(')')
  
  // 2. Test if input will be accepted
  IF digit == '-' AND inTiebreak:
    testDigits = state.digits + ' '  // Minus in tiebreak adds space
  ELSE:
    testDigits = state.digits + digit.toString()
  
  testScoreString = formatScore(testDigits)
  
  // 3. Check if match is complete
  IF currentScoreString exists:
    validation = validateScore(currentScoreString, matchUp.matchUpFormat)
    
    // Block if match complete (unless in incomplete tiebreak)
    IF validation.isValid AND validation.winningSide AND NOT inTiebreak:
      RETURN  // Block input
    
    // Block if formatter rejected digit (incomplete set)
    IF NOT inTiebreak AND digit != '-' AND testScoreString == currentScoreString:
      RETURN  // Block input - formatter rejected
  
  // 4. Add digit to state
  IF digit == '-':
    IF inTiebreak:
      state.digits += ' '  // Close tiebreak, start next set
    ELSE:
      // Check if already on side2
      IF adding space wouldn't change score:
        RETURN  // Ignore minus - already advanced
      state.digits += ' '  // Set separator
  ELSE:
    state.digits += digit.toString()
  
  // 5. Update display
  updateDisplay()
END FUNCTION
```

### B. Format Raw Digits → `formatScoreString(digits, matchUpFormat)`

```
FUNCTION formatScoreString(digits, matchUpFormat):
  
  // 1. Parse format
  parsed = matchUpFormatCode.parse(matchUpFormat)
  setTo = parsed.setFormat.setTo  // e.g., 6
  tiebreakAt = parsed.setFormat.tiebreakAt  // e.g., 6
  bestOf = parsed.setFormat.bestOf  // e.g., 3
  
  result = ""
  setCount = 0
  
  // 2. Split into segments (space = set separator)
  segments = digits.split(' ').filter(non-empty)
  
  // 3. Process each segment
  FOR EACH segment IN segments:
    IF setCount >= bestOf:
      BREAK  // Max sets reached
    
    i = 0
    side1 = ""
    side2 = ""
    tb1 = ""
    
    // 3a. Parse side1 score
    WHILE i < segment.length:
      digit = segment[i]
      
      IF digit == '-':
        i++
        CONTINUE  // Skip minuses in side parsing
      
      potentialValue = parseInt(side1 + digit)
      
      IF potentialValue > setTo + 1:
        BREAK  // Too high
      
      IF side1.length >= 2:
        BREAK  // Max 2 digits
      
      side1 += digit
      i++
      
      IF side1.length == 1 AND digit != '1' AND setTo < 10:
        BREAK  // Single digit (except '1' for 10+)
    
    // 3b. Parse side2 score
    WHILE i < segment.length:
      digit = segment[i]
      
      IF digit == '-':
        i++
        CONTINUE  // Skip minuses
      
      potentialValue = parseInt(side2 + digit)
      
      IF potentialValue > setTo + 3:
        BREAK  // Allow some extra for coercion
      
      IF side2.length >= 2:
        BREAK
      
      side2 += digit
      i++
      
      IF side2.length == 1 AND digit != '1' AND setTo < 10:
        BREAK
    
    // 3c. Check if incomplete
    IF side2 is empty:
      result += side1
      BREAK  // Incomplete set
    
    // 3d. Apply score coercion
    s1 = parseInt(side1)
    s2 = parseInt(side2)
    wasCoerced = false
    
    // Coerce excessive scores DOWN to setTo
    IF s1 > setTo + 1:
      s1 = setTo
      side1 = setTo.toString()
      wasCoerced = true
    
    IF s2 > setTo + 1:
      s2 = setTo
      side2 = setTo.toString()
      wasCoerced = true
    
    // Coerce invalid combinations (e.g., 3-7 → 3-6)
    IF s1 == setTo + 1 AND s2 < setTo - 1:
      s1 = setTo
      side1 = setTo.toString()
      wasCoerced = true
    
    IF s2 == setTo + 1 AND s1 < setTo - 1:
      s2 = setTo
      side2 = setTo.toString()
      wasCoerced = true
    
    // 3e. Check if tiebreak needed
    hasWinner = (max(s1,s2) >= setTo) AND (abs(s1-s2) >= 2)
    
    remainingDigits = i < segment.length
    scoresTied = (s1 == tiebreakAt AND s2 == tiebreakAt)
    scoresOneApart = ((s1 == tiebreakAt+1 AND s2 == tiebreakAt) OR 
                      (s2 == tiebreakAt+1 AND s1 == tiebreakAt))
    
    needsTiebreak = NOT wasCoerced AND 
                    (scoresTied OR (scoresOneApart AND remainingDigits))
    
    // 3f. Format result
    IF needsTiebreak:
      // Parse tiebreak (consume all remaining digits)
      tb1 = segment.substring(i)
      
      IF tb1.length > 0:
        result += side1 + '-' + side2 + '(' + tb1 + ')'
        setCount++
      ELSE:
        result += side1 + '-' + side2 + '('  // Open tiebreak
    ELSE:
      result += side1 + '-' + side2
      setCount++
      
      IF NOT hasWinner AND remainingDigits:
        BREAK  // Incomplete set with extra digits
  
  RETURN result
END FUNCTION
```

## Key Decision Points

### 1. When to block input?
- Match is complete (validation.winningSide exists) AND not in tiebreak
- Formatter rejected digit (score unchanged after adding digit) AND not in tiebreak AND not minus

### 2. When is user in tiebreak?
- Current score contains '(' but NOT ')'
- Tiebreak stays open until user explicitly closes with minus/space

### 3. When to coerce scores?
- **Rule 1**: If score > setTo+1, coerce DOWN to setTo
  - Example: [3,8] with setTo=6 → 3 gets coerced to 3, 8 gets coerced to 6 → "3-6"
  
- **Rule 2**: If score = setTo+1 but other side < setTo-1, coerce HIGH side DOWN to setTo
  - Example: [3,7] with setTo=6 → 7 gets coerced to 6 → "3-6"

### 4. When to trigger tiebreak?
- Scores are tied at tiebreakAt (e.g., 6-6), OR
- Scores are one apart at tiebreakAt (e.g., 6-7) AND remaining digits exist

### 5. How does minus key work?
- **In tiebreak**: Add SPACE to close tiebreak and start next set
- **Not in tiebreak**: 
  - If already on side2 (adding space wouldn't change score): IGNORE
  - Otherwise: Add SPACE as set separator

## Examples

### Example 1: [6,7,3,-,6,3]
```
Step 1: Press 6 → digits="6" → score="6-"
Step 2: Press 7 → digits="67" → score="6-7("
Step 3: Press 3 → digits="673" → score="6-7(3)"
Step 4: Press - → inTiebreak=true → digits="673 " → score="6-7(3) "
Step 5: Press 6 → digits="673 6" → score="6-7(3) 6-"
Step 6: Press 3 → digits="673 63" → score="6-7(3) 6-3"
```

### Example 2: [3,7]
```
Step 1: Press 3 → digits="3" → score="3-"
Step 2: Press 7 → digits="37" → parse: side1=3, side2=7
        Coercion: s2=7 (setTo+1) and s1=3 (<setTo-1) → s2 coerced to 6
        → score="3-6"
```

### Example 3: [6,-,7]
```
Step 1: Press 6 → digits="6" → score="6-"
Step 2: Press - → inTiebreak=false, check if already on side2
        Test: "6 " formats to "6-" (same as current)
        Decision: Ignore minus (already advanced to side2)
Step 3: Press 7 → digits="67" → score="6-7"
```

## Data Flow Diagram

```
User Input (Button/Key)
    ↓
handleDigitPress(digit)
    ↓
Calculate: currentScoreString = formatScore(state.digits)
           inTiebreak = has '(' but not ')'
    ↓
Test Input: testDigits, testScoreString
    ↓
Validate: Check if match complete or input blocked
    ↓
Add to state.digits: Either digit, space, or ignore
    ↓
updateDisplay()
    ↓
formatScore(state.digits) → formatted string
    ↓
validateScore(formatted, format) → { isValid, winningSide, sets }
    ↓
Update UI with formatted score and validation state
```
