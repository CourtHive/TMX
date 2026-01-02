# Scoring V2 Validation

## TB10/Tiebreak-Only Set Validation

This directory contains local validation logic for tiebreak-only set formats (TB10, TB7, TB12, etc.) that was developed and tested in TMX before being integrated into the factory.

### Current Implementation

The validation in `validateMatchUpScore.ts` and `scoreValidator.ts` provides comprehensive TB10 validation:

- **validateSetScore**: Validates individual sets against matchUpFormat rules
  - Tiebreak-only sets (TB10): winner ≥ 10, loser ≥ 9, win by exactly 2
  - Generalized for any tiebreakTo value (TB5, TB7, TB10, TB12, TB20)
  - 112 tests passing

- **validateSetScores**: Validates complete match scores
  - Uses local `validateSetScore` for set-by-set validation
  - Determines winningSide based on sets won
  - Works independently of factory's `generateOutcomeFromScoreString`

### Factory Integration

**Status**: TB10 support has been added to the factory (commit 0620a30ff, 2026-01-02)

**TODO**: Update TMX to use factory's `generateOutcomeFromScoreString` once new factory version is published

The factory now includes:
- Bracket notation parsing `[11-13]` for tiebreak-only sets
- Updated `parseScoreString` to distinguish TB10 from match tiebreaks
- Updated `generateScoreString` to output bracket notation
- 9 passing tests (2 skipped for future enhancements)

**Migration Steps** (once factory is published):

1. Update `tods-competition-factory` package dependency
2. Replace local `validateSetScores` logic with factory's validation
3. Remove or deprecate local TB10 validation in `validateMatchUpScore.ts`
4. Keep comprehensive test suite as integration tests
5. Verify all 112 tests still pass with factory validation

**Benefits of Factory Migration**:
- Single source of truth for validation logic
- Validation consistency across all applications
- Reduced code maintenance in TMX
- Automatic updates when factory adds new formats

### Test Coverage

- **TMX**: 112 tests (110 passing, 2 skipped)
  - validateMatchUpScore.test.ts: Comprehensive set validation
  - TB5, TB7, TB10, TB12, TB20 coverage
  
- **Factory**: 11 tests (9 passing, 2 skipped)
  - generateOutcomeFromScoreString.test.ts: Score generation and parsing
  - Documents expected behavior for TB formats

### Related Files

- `validateMatchUpScore.ts` - Set-level validation logic
- `scoreValidator.ts` - Match-level validation and factory integration
- `dynamicSetsApproach.ts` - UI scoring input handling
- `dialPadApproach.ts` - Alternative dial pad scoring UI
