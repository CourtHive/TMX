# MatchUp Format Scoring Logic

This document defines how parsed matchUpFormat attributes control score validation logic.

## Parsed Format Structure

A parsed matchUpFormat contains:
- `bestOf`: Number of sets in the match (1, 3, 5)
- `setFormat`: Rules for regular sets
- `finalSetFormat`: (optional) Different rules for the deciding set

## Set Format Attributes

### Regular Sets (setFormat.setTo)

**setTo**: Games required to win a set (e.g., 6, 4, 8)

**Rules:**
- Winner reaches `setTo` with at least 2-game margin, OR
- Winner reaches `setTo + 1` with exactly `setTo - 1` for loser (deuce rule)
- Maximum allowed score: `setTo + 1`

**Examples:**
- `setTo: 6` → Valid: 6-0, 6-4, 7-5, 7-6(with tiebreak)
- `setTo: 6` → Invalid: 8-6 (exceeds setTo + 1), 9-6 (violates deuce rule)

**Deuce Rule (non-NOAD):**
- If winner > `setTo`, loser must be ≥ `setTo - 1`
- Example: 9-7 valid for setTo:8, but 9-6 invalid (requires setTo:9)

### Tiebreaks (setFormat.tiebreakFormat)

**tiebreakTo**: Points required to win tiebreak (e.g., 7, 10)

**tiebreakAt**: Game score when tiebreak occurs (defaults to setTo if not specified)

**Rules:**
- Tiebreak occurs when games tied at `tiebreakAt`
- Final game score: `(tiebreakAt + 1) - tiebreakAt`
- Tiebreak score: winner ≥ `tiebreakTo`, margin ≥ 2

**Examples:**
- `setTo: 6, tiebreakAt: 6` → Score 7-6(10) means tied at 6-6, tiebreak 12-10
- `setTo: 8, tiebreakAt: 8` → Score 9-8(7) means tied at 8-8, tiebreak 9-7

**Validation:**
- If set has tiebreak scores, game scores must be `(tiebreakAt + 1) - tiebreakAt`
- Score 7-6(10) only matches formats with `tiebreakAt: 6`, not `tiebreakAt: 8`

### Tiebreak-Only Sets (setFormat.tiebreakSet)

**tiebreakSet.tiebreakTo**: Points required to win (no regular games)

**Rules:**
- No game scores, only tiebreak points (shown in brackets: [10-8])
- Winner reaches `tiebreakTo` with margin ≥ 2
- Used for match tiebreaks (3rd set tiebreak to 10)

**Examples:**
- `tiebreakSet: { tiebreakTo: 10 }` → Valid: [10-8], [11-9], [12-10]
- Score [10-8] requires format with tiebreak-only final set

**Validation:**
- Sets with game scores cannot match tiebreak-only formats
- For completed matches, at least one side must reach `tiebreakTo`

### Timed Sets (setFormat.timed)

**timed**: Boolean indicating time-based format

**minutes**: Duration in minutes

**Rules:**
- Any score valid (match ends when time expires)
- No constraints on game scores or tiebreak requirements

**Examples:**
- `timed: true, minutes: 20` → Valid: any score (3-2, 7-6(10), 0-0)

### No-Ad Scoring (setFormat.NoAD)

**NoAD**: Boolean indicating no-advantage scoring

**Rules:**
- No deuce - winner determined at first opportunity
- Maximum winner score: `setTo`
- Maximum loser score: `setTo - 1`
- Cannot exceed setTo (match ends immediately when setTo is reached)

**Examples:**
- `setTo: 6, NoAD: true` → Valid: 6-0, 6-4, 6-5
- `setTo: 6, NoAD: true` → Invalid: 7-5, 7-6 (cannot exceed setTo)

## Final Set Format (finalSetFormat)

Applied to the deciding set when `sets.length === bestOf`

**Rules:**
- If `finalSetFormat` exists, use it for the last set instead of `setFormat`
- Common pattern: match tiebreak instead of full set
  - `finalSetFormat: { tiebreakSet: { tiebreakTo: 10 } }`

**Validation for Completed Matches:**
- If format has tiebreak-only `finalSetFormat`, score must have match tiebreak
- If score has match tiebreak, format must have tiebreak-only `finalSetFormat`
- Score 6-3 6-7(3) 6-0 matches SET3-S:6/TB7 (not SET3-S:6/TB7-F:TB10)
- Score 6-2 2-6 [10-2] matches SET3-S:6/TB7-F:TB10 (not SET3-S:6/TB7)

## Best Of (bestOf)

**Rules:**
- Minimum sets: `Math.ceil(bestOf / 2)` (e.g., bestOf:3 needs ≥ 2 sets)
- Maximum sets: `bestOf` (e.g., bestOf:3 allows ≤ 3 sets)
- Deciding set: when `sets.length === bestOf`

**Examples:**
- `bestOf: 3` → Valid: 2 or 3 sets; Invalid: 1 or 4 sets
- `bestOf: 5` → Valid: 3, 4, or 5 sets

## Match Status Assumptions

- **COMPLETED**: Default unless `matchUpStatus` explicitly states otherwise
- For completed matches:
  - All format constraints fully apply
  - Tiebreak-only final sets must exist if format requires them
  - Scores must reach required minimums (setTo, tiebreakTo)

## Example Parsed Formats

### Standard Best of 3
```json
{
  "bestOf": 3,
  "setFormat": {
    "setTo": 6,
    "tiebreakFormat": { "tiebreakTo": 7 },
    "tiebreakAt": 6
  }
}
```

### Best of 3 with Match Tiebreak
```json
{
  "bestOf": 3,
  "setFormat": {
    "setTo": 6,
    "tiebreakFormat": { "tiebreakTo": 7 },
    "tiebreakAt": 6
  },
  "finalSetFormat": {
    "tiebreakSet": { "tiebreakTo": 10 }
  }
}
```

### Tiebreak-Only (Match Tiebreak)
```json
{
  "bestOf": 1,
  "setFormat": {
    "tiebreakSet": { "tiebreakTo": 10 }
  }
}
```

### Timed Set
```json
{
  "bestOf": 1,
  "setFormat": {
    "timed": true,
    "minutes": 20
  }
}
```

### Pro Set
```json
{
  "bestOf": 1,
  "setFormat": {
    "setTo": 8,
    "tiebreakFormat": { "tiebreakTo": 7 },
    "tiebreakAt": 8
  }
}
```

### Fast4 (No-Ad)
```json
{
  "bestOf": 5,
  "setFormat": {
    "setTo": 4,
    "NoAD": true
  }
}
```
