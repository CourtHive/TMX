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
- Win-by-2 required: score difference must be ≥ 2

**Examples:**
- `setTo: 6` → Valid: 6-0, 6-4, 7-5, 7-6(with tiebreak)
- `setTo: 6` → Invalid: 8-6 (exceeds setTo + 1), 9-6 (violates deuce rule), 6-5 (not win-by-2)

**Deuce Rule (non-NOAD):**
- If winner > `setTo`, loser must be ≥ `setTo - 1`
- Example: 9-7 valid for setTo:8, but 9-6 invalid (requires setTo:9)

**Score Coercion (dialPad implementation):**
- If score > `setTo + 1`: coerce DOWN to `setTo`
- If score = `setTo + 1` but opposite < `setTo - 1`: coerce DOWN to `setTo`
- Example: "6-9" with setTo:6 coerces to "6-6"

**Context-Aware Input Limits (dynamicSets implementation):**
- Maximum allowed score depends on opposite side's value
- If opposite < `setTo - 1`: this side max = `setTo` (can't trigger tiebreak)
- If opposite = `setTo - 1`: this side max = `setTo + 1` (could win 7-5 or go to tiebreak)
- If opposite = `setTo`: this side max = `setTo + 1` (could win normally or go to tiebreak)
- If opposite = `setTo + 1`: this side must = `setTo` (tiebreak scenario only)

### Tiebreaks (setFormat.tiebreakFormat)

**tiebreakTo**: Points required to win tiebreak (e.g., 7, 10)

**tiebreakAt**: Game score when tiebreak occurs (defaults to setTo if not specified)

**Rules:**
- Tiebreak occurs when games tied at `tiebreakAt`
- Final game score: `(tiebreakAt + 1) - tiebreakAt`
- Tiebreak score: winner ≥ `tiebreakTo`, win-by-2 required
- Notation: only losing tiebreak score shown in parentheses

**Examples:**
- `setTo: 6, tiebreakAt: 6` → Score 7-6(10) means tied at 6-6, tiebreak 12-10
- `setTo: 8, tiebreakAt: 8` → Score 9-8(7) means tied at 8-8, tiebreak 9-7

**Validation:**
- If set has tiebreak scores, game scores must be `(tiebreakAt + 1) - tiebreakAt`
- Score 7-6(10) only matches formats with `tiebreakAt: 6`, not `tiebreakAt: 8`

**Explicit tiebreakAt Specification:**
- Default: tiebreakAt = `setTo` (e.g., `SET3-S:6/TB7` means tiebreak at 6-6)
- Use `@` symbol ONLY when tiebreakAt differs from setTo (typically `setTo - 1`)
- `SET3-S:4/TB5@3` → Sets to 4, tiebreak (to 5) at 3-3 (not default 4-4)
- `SET3-S:6/TB7@5` → Sets to 6, tiebreak (to 7) at 5-5 (not default 6-6)
- `SET1-S:8/TB7@7` → Sets to 8, tiebreak (to 7) at 7-7 (not default 8-8)
- Most common use: tiebreak at `setTo - 1` to shorten matches

**Maximum Set Scores (determined by tiebreakAt):**
- When `tiebreakAt = setTo` (default): sets can reach `setTo + 1` via tiebreak or win-by-2
  - Example: `setTo: 6, tiebreakAt: 6` → Valid: 6-0, 6-4, 7-5, 7-6(TB)
- When `tiebreakAt < setTo`: sets are capped at `setTo` via earlier tiebreak
  - Example: `setTo: 4, tiebreakAt: 3` → Max score 4-3(TB), cannot reach 5-3 or 4-4
  - Example: `setTo: 6, tiebreakAt: 5` → Max score 6-5(TB), cannot reach 7-5 or 6-6
- The tiebreakAt value controls when tiebreak triggers, limiting maximum scores

### Tiebreak-Only Sets (setFormat.tiebreakSet)

**tiebreakSet.tiebreakTo**: Points required to win (no regular games)

**Rules:**
- No game scores, only tiebreak points (shown in brackets: [10-8])
- Winner reaches `tiebreakTo`, win-by-2 required
- Used for match tiebreaks (3rd set tiebreak to 10)
- Notation: brackets indicate tiebreak-only set

**Examples:**
- `tiebreakSet: { tiebreakTo: 10 }` → Valid: [10-8], [11-9], [12-10]
- Score [10-8] requires format with tiebreak-only final set

**Validation:**
- Sets with game scores cannot match tiebreak-only formats
- For completed matches, at least one side must reach `tiebreakTo`

**Input Handling (dynamicSets):**
- For tiebreak-only sets: `max = opposite + 2` (win-by-2 rule)
- Example: If opposite = 11, this side max = 13
- No coercion applied (user builds extended tiebreak scores like 33-35)

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

**Important Distinction:**
- **Game-level NoAD**: Applies to point scoring within games (no deuce/advantage)
- **Tiebreak-level NoAD**: If applied to tiebreaks, means first to reach `tiebreakTo` wins (no win-by-2)

**Rules:**
- At deuce (40-40), the next point wins the game (no advantage)
- Does NOT affect set-level scoring structure
- Sets can still reach `setTo + 1` if tiebreak is played or win-by-2 applies

**Examples:**
- `setTo: 6, NoAD: true, tiebreakAt: 6` → Valid: 6-0, 6-4, 7-5, 7-6(TB)
- `setTo: 4, NoAD: true, tiebreakAt: 3` (Fast4) → Valid: 4-0, 4-2, 4-3(TB)
- `tiebreakTo: 10, NoAD: true` → Tiebreak ends at 10-9 (no win-by-2 required)

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

**Rules (COMPLETED matches only):**
- Minimum sets: `Math.ceil(bestOf / 2)` (e.g., bestOf:3 needs ≥ 2 sets)
- Maximum sets: `bestOf` (e.g., bestOf:3 allows ≤ 3 sets)
- Deciding set: when `sets.length === bestOf`

**Examples (COMPLETED):**
- `bestOf: 3` → Valid: 2 or 3 sets; Invalid: 1 or 4 sets
- `bestOf: 5` → Valid: 3, 4, or 5 sets

**Irregular Endings (RETIRED, WALKOVER, DEFAULTED):**
- Any number of sets allowed (including zero)
- `bestOf: 3, RETIRED` → Valid: 0, 1, 2, or 3 sets
- `bestOf: 3, WALKOVER` → Valid: 0 sets (no play occurred)

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
