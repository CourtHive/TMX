# Scoring Modal V2 ✅ **NOW DEFAULT**

**Status:** Production-ready and active as the default scoring system (January 2026)  
**Default Approach:** dynamicSets (individual set-by-set entry with real-time validation)

Modern TypeScript implementation of the match score entry system.

## Overview

This is a complete rewrite of the scoring system with:
- ✅ **Type Safety**: Full TypeScript with proper types
- ✅ **Modern Architecture**: Clean separation of concerns
- ✅ **Real-time Validation**: Uses `tournamentEngine.parseScoreString()`
- ✅ **Multiple Approaches**: Free text and dynamic sets (both production-ready)
- ✅ **Comprehensive Testing**: 69 test cases covering 15+ matchUpFormat variations
- ✅ **No Legacy Code**: Built from scratch, doesn't touch legacy/scoring/*

## Status

**All Phases Complete!** ✅
- [x] Phase 1: Foundation & Toggle
- [x] Phase 2: Free Text Approach (MVP)
- [x] Phase 3: Dynamic Sets Approach  
- [x] Phase 4: Integration & Testing
- [x] **Migration Complete:** Legacy modal removed, dynamicSets is now default

## How to Use

The scoring modal is **automatically enabled by default**. When you click to enter a score, the V2 modal with dynamicSets approach will appear.

### Switching to Free Text Approach (Optional)

If you prefer the free text entry method, you can change the approach:
```javascript
env.scoringApproach = 'freeText';
```

### Switching Approaches

```javascript
env.scoringApproach = 'freeText';    // Single text input (Phase 2 - READY)
env.scoringApproach = 'dynamicSets'; // Set-by-set inputs (Phase 3 - TODO)
env.scoringApproach = 'visual';      // Point-by-point (Future)
```

## Project Structure

```
scoringV2/
├── index.ts                    # Main entry point
├── types.ts                    # TypeScript type definitions
├── scoringModalV2.ts           # Modal orchestration layer
│
├── approaches/
│   ├── freeTextApproach.ts     # ✅ Phase 2: Single input with validation
│   ├── dynamicSetsApproach.ts  # 🚧 Phase 3: TODO
│   └── visualApproach.ts       # 🔮 Future: Point-by-point scoring
│
├── components/
│   ├── setScoreInput.ts        # 🚧 TODO: Individual set input widget
│   ├── scoreValidationDisplay.ts # 🚧 TODO: Validation feedback UI
│   └── matchFormatDisplay.ts   # 🚧 TODO: Match format info display
│
└── utils/
    ├── scoreValidator.ts       # ✅ Score validation wrapper
    └── setExpansionLogic.ts    # ✅ Logic for dynamic set expansion
```

## Architecture

### Data Flow

```
User Input
    ↓
Approach Component (freeTextApproach.ts)
    ↓
Score Validator (utils/scoreValidator.ts)
    ↓
tournamentEngine.parseScoreString()
    ↓
ScoreOutcome
    ↓
Modal (scoringModalV2.ts)
    ↓
Callback → scoreMatchUp.ts → Mutation
```

### Type System

**ScoreOutcome**: Result from validation
```typescript
{
  isValid: boolean;
  sets: SetScore[];
  winningSide?: number;
  matchUpStatus?: string;
  error?: string;
  score?: string;
}
```

**SetScore**: Individual set data
```typescript
{
  side1Score?: number;
  side2Score?: number;
  side1TiebreakScore?: number;
  side2TiebreakScore?: number;
  winningSide?: number;
}
```

## Approach 1: Free Text Entry (Phase 2) ✅

### Features
- ✅ Single text input: `"6-3 3-6 6-4"` or `"6-3, 3-6, 6-4"`
- ✅ Real-time validation with visual feedback
- ✅ Green checkmark (✓) for valid scores
- ✅ Red cross (✗) with error message for invalid
- ✅ Automatic winner detection
- ✅ Enter key to submit
- ✅ Pre-fills existing scores when editing
- ✅ Displays match format info
- ✅ Shows participant names with courthive-components

### UI Layout
```
┌─────────────────────────────────────┐
│  Score Entry                         │
├─────────────────────────────────────┤
│  [Player 1 Name]                     │
│          vs                          │
│  [Player 2 Name]                     │
│                                      │
│  Format: SET3-S:6/TB7                │
│                                      │
│  Enter score:                        │
│  [6-3 3-6 6-4___________] ✓          │
│  Valid score                         │
│                                      │
│  Winner: Player 1                    │
│                                      │
├─────────────────────────────────────┤
│         [Cancel]  [Submit Score]     │
└─────────────────────────────────────┘
```

### Example Usage
```typescript
import { scoringModalV2 } from 'components/modals/scoringV2';

scoringModalV2({
  matchUp: { ... },
  callback: (outcome) => {
    console.log('Score:', outcome.score);
    console.log('Winner:', outcome.winningSide);
  }
});
```

## Approach 2: Dynamic Sets (Phase 3) 🚧

### Planned Features
- Separate input boxes per set (2 per side)
- Auto-expands when match continues
- Per-set validation
- Visual set winner indicators
- Tiebreak score inputs
- Real-time match status

### Logic
```typescript
shouldExpandSets(sets, matchUpFormat):
  1. Parse format → bestOf, setsToWin
  2. Calculate sets won per side
  3. If neither has won → check if all sets filled
  4. If filled && match not decided → expand
  5. Max expansion = bestOf
```

## Integration Points

### Entry Point
`src/services/transitions/scoreMatchUp.ts`:
```typescript
if (env.scoringV2) {
  scoringModalV2({ matchUp, callback });
} else if (env.scoring) {
  scoringModal({ matchUp, callback });      // V1
} else {
  scoreBoard.setMatchScore({ ... });        // Legacy
}
```

### Modal System
Uses existing `openModal()` from `baseModal.ts`:
- Consistent UI with rest of TMX
- Button rendering via `renderButtons()`
- Standard modal behaviors

### Participant Rendering
Uses `renderParticipant()` from courthive-components:
- Consistent participant display
- Gender color coding
- Rating scale support
- Team composition

## Testing

### Manual Testing Checklist

**Free Text Approach:**
- [ ] Valid score: `6-3 3-6 6-4` → ✓ green
- [ ] Invalid score: `6-3 3-6` → ✗ red (incomplete match)
- [ ] Invalid format: `abc` → ✗ red (parse error)
- [ ] Winner detection: `6-3 6-4` → shows winner
- [ ] Enter key submits when valid
- [ ] Submit button disabled when invalid
- [ ] Pre-fills existing scores correctly
- [ ] Modal closes after submit
- [ ] Callback fires with correct data

### Toggle Testing
```javascript
// Test V2
env.scoringV2 = true;
// Click score entry → should show new modal

// Test V1
env.scoringV2 = false;
env.scoring = true;
// Click score entry → should show old modal

// Test Legacy
env.scoringV2 = false;
env.scoring = false;
// Click score entry → should show scoreBoard
```

## Future Enhancements (Phase 5+)

- [ ] Approach 3: Visual point-by-point scoring
- [ ] Keyboard shortcuts (Tab between sets)
- [ ] Match statistics display
- [ ] Retirement/walkover options
- [ ] Mobile-optimized layout
- [ ] Score history view
- [ ] Undo/redo functionality
- [ ] Quick score templates (e.g., "6-0 6-0")

## Dependencies

**Internal:**
- `tournamentEngine.parseScoreString()` - Score validation
- `openModal()` - Modal system
- `renderParticipant()` - Player display
- `env` - Configuration

**External:**
- `courthive-components` - UI components
- `tods-competition-factory` - Score parsing

## Notes

- Legacy code in `src/legacy/scoring/*` is **untouched**
- Old modal in `src/components/modals/scoringModal.ts` is **untouched**
- All new code is in `src/components/modals/scoringV2/`
- Toggle system allows A/B testing and gradual rollout
- Can run all three approaches simultaneously (via toggle)

## Development

**Next Steps:**
1. Test Phase 2 (Free Text) in production
2. Gather feedback
3. Implement Phase 3 (Dynamic Sets)
4. Add keyboard shortcuts
5. Mobile optimization
6. Consider removing legacy code once stable

**Adding a New Approach:**
1. Create `approaches/myApproach.ts`
2. Implement `renderMyApproach(params: RenderScoreEntryParams)`
3. Add condition in `scoringModalV2.ts`
4. Update `env.scoringApproach` type
5. Test and document
