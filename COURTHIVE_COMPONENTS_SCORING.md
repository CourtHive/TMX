# Courthive-Components Scoring Integration

Feature flag implementation for using courthive-components scoring modals in TMX.

**For comprehensive testing guidelines, see:** [courthive-components/SCORING_MODAL_TESTING_GUIDE.md](../courthive-components/SCORING_MODAL_TESTING_GUIDE.md)

## Overview

TMX now supports two scoring modal implementations:

1. **TMX Implementation** (default) - Local implementation in `src/components/modals/scoringV2/`
2. **Courthive-Components** (experimental) - Published npm package `courthive-components`

The system uses a facade pattern with dynamic imports to switch between implementations without code changes.

## Feature Flag

### Enabling/Disabling

The feature is controlled via `window.dev.useComponentsScoring`:

```javascript
// Check current state
window.dev.useComponentsScoring;

// Toggle the feature
window.dev.toggleComponentsScoring();
```

The setting persists in `localStorage` under key `tmx_useComponentsScoring`.

**Important:** After toggling, reload the page for changes to take effect.

### Console Output

When toggling:

```
✓ Components Scoring: ENABLED
⚠ Reload the page to apply changes
```

When using courthive-components (in console):

```
✓ Using courthive-components scoring {
  approach: "dynamicSets",
  composition: "Wimbledon",
  smartComplements: false
}
```

## Composition Resolution

### Composition Name Priority

Composition name is resolved in priority order:

1. **Draw Extension** (highest priority)
   - Read from drawDefinition's display extension
   - Set via "Edit display settings" modal
   - Example: `{ compositionName: "Wimbledon", configuration: {...} }`

2. **Environment Object**
   - Fallback to `env.composition.compositionName`
   - Set when display settings are saved

3. **LocalStorage**
   - Fallback to `localStorage.getItem('tmx_composition')`

4. **Default** (lowest priority)
   - `"Australian"`

### Smart Complements Priority

Smart Complements is resolved independently:

1. **LocalStorage Settings** (highest priority)
   - Read from `localStorage.getItem('tmx_settings')`
   - Set via Settings modal
   - Key: `smartComplements: true|false`

2. **Environment Object**
   - Fallback to `env.smartComplements`

3. **Default** (lowest priority)
   - `false`

### Example Resolution Flow

```typescript
// MatchUp with drawId
matchUp = {
  drawId: "abc-123",
  matchUpFormat: "SET3-S:6/TB7",
  ...
}

// 1. Check draw extension for composition name
tournamentEngine.findExtension({
  name: "display",
  drawId: "abc-123"
})
// → { compositionName: "Wimbledon" }

// 2. Check localStorage for smartComplements
const settings = JSON.parse(localStorage.getItem('tmx_settings'))
// → { smartComplements: true, scoringApproach: "dynamicSets", ... }

// 3. Result used for courthive-components
setScoringConfig({
  scoringApproach: "dynamicSets",
  composition: "Wimbledon",  // ← from draw extension
  smartComplements: true      // ← from localStorage settings
})
```

## Configuration

### Scoring Approach

Set in `env.scoringApproach` (applies to both implementations):

- `'dynamicSets'` (default) - Set-by-set entry with real-time validation
- `'freeScore'` - Flexible text-based entry (e.g., "6-4 6-3")
- `'dialPad'` - Touch-friendly numeric keypad

```javascript
// Change approach
env.scoringApproach = 'dialPad';
```

### Smart Complements

Enable auto-fill of complement scores via Settings modal (persists to localStorage):

```javascript
// Method 1: Via Settings modal (recommended - persists)
// Open Settings modal and check "Smart Complements"

// Method 2: Directly in console (temporary)
env.smartComplements = true;

// Method 3: Via localStorage (persists)
const settings = JSON.parse(localStorage.getItem('tmx_settings') || '{}');
settings.smartComplements = true;
localStorage.setItem('tmx_settings', JSON.stringify(settings));
```

When enabled:

- Type `6` → fills `6-4`
- Type `7` → fills `7-5`
- Hold `Shift+6` → fills `4-6` (reversed)

**Note:** Only works with courthive-components implementation and `dynamicSets` approach.

## Implementation Details

### Facade Pattern

File: `src/components/modals/scoringV2/index.ts`

```typescript
export function scoringModal(params: ScoringModalParams): void {
  if (window.dev?.useComponentsScoring) {
    // Dynamic import - only loads when feature is enabled
    import('courthive-components').then(({ scoringModal, setScoringConfig }) => {
      // Configure and call
      setScoringConfig({ ... });
      scoringModal(params);
    }).catch(() => {
      // Fallback to TMX implementation
      tmxScoringModal(params);
    });
  } else {
    // Default: use TMX implementation
    tmxScoringModal(params);
  }
}
```

### Dynamic Import Benefits

1. **Zero overhead** - courthive-components only bundled when used
2. **Graceful fallback** - Automatic fallback on import errors
3. **No code changes** - All existing `scoringModal()` calls work unchanged
4. **Runtime switching** - Toggle feature without rebuilding

### Type Safety

Both implementations share identical types:

```typescript
type ScoringModalParams = {
  matchUp: any;
  callback: (outcome: ScoreOutcome) => void;
};

type ScoreOutcome = {
  isValid: boolean;
  sets: SetScore[];
  winningSide?: number;
  matchUpStatus?: string;
  matchUpFormat?: string;
  // ...
};
```

## Testing

### Manual Testing Steps

1. **Enable feature flag**

   ```javascript
   window.dev.toggleComponentsScoring();
   // Reload page
   ```

2. **Open scoring modal**
   - Navigate to a tournament
   - Click any match to score
   - Verify console shows: `"Using courthive-components scoring"`

3. **Test composition resolution**
   - Edit draw display settings
   - Set composition to "Wimbledon"
   - Open scoring modal
   - Verify composition in console output

4. **Test feature toggle**
   ```javascript
   window.dev.toggleComponentsScoring(); // Disable
   // Reload page
   // Open scoring modal
   // Verify using TMX implementation (no console log)
   ```

### Validation Checklist

- [ ] Feature flag persists across page reloads
- [ ] TMX implementation works (default)
- [ ] Courthive-components implementation works (when enabled)
- [ ] Composition resolved from draw extension
- [ ] Composition fallback to env/localStorage works
- [ ] Score submission triggers correct mutations
- [ ] Callback receives expected outcome
- [ ] Fallback works if import fails

## Migration Path

### Phase 1: Development Testing (Current)

- Feature flag controlled via console
- Default: TMX implementation
- Manual testing by developers

### Phase 2: Beta Testing

- Add toggle to settings UI
- Enable for beta testers
- Collect feedback

### Phase 3: Production Rollout

- Change default to courthive-components
- Keep TMX implementation as fallback
- Monitor for issues

### Phase 4: Cleanup

- Remove TMX `scoringV2` directory
- Remove feature flag
- Direct import from courthive-components

## Troubleshooting

### Scoring modal doesn't open

1. Check console for errors
2. Verify `courthive-components@0.9.6` is installed
3. Try disabling feature flag

### Composition not applying

1. Check draw has display extension: `tournamentEngine.findExtension({ name: "display", drawId })`
2. Check `env.composition` value
3. Check localStorage: `localStorage.getItem('tmx_composition')`

### Smart Complements not working

1. Check localStorage settings: `JSON.parse(localStorage.getItem('tmx_settings'))?.smartComplements`
2. Check `env.smartComplements` value
3. Ensure using `dynamicSets` approach: `env.scoringApproach === 'dynamicSets'`
4. Verify feature flag enabled: `window.dev.useComponentsScoring === true`

### Feature flag not working

1. Verify in console: `window.dev.useComponentsScoring`
2. Check localStorage: `localStorage.getItem('tmx_useComponentsScoring')`
3. Ensure page was reloaded after toggle

## Development Notes

### Adding New Features

To add features to courthive-components scoring:

1. Update `courthive-components` package
2. Publish new version
3. Update `package.json` in TMX
4. Run `pnpm install`
5. Test with feature flag enabled

### Debugging

Enable verbose logging:

```javascript
// Watch composition resolution
window.dev.useComponentsScoring = true;
// Open scoring modal and check console
```

## Files Modified

- `src/services/setDev.ts` - Added feature flag and toggle function
- `src/settings/env.ts` - Added composition config properties
- `src/components/modals/scoringV2/index.ts` - Created facade with dynamic import
- `src/components/modals/scoringV2/resolveComposition.ts` - Created composition resolver utility

## Benefits

✅ **Zero Risk** - TMX implementation remains default and unchanged
✅ **Easy Testing** - Toggle via console during development
✅ **No Breaking Changes** - All existing code continues to work
✅ **Bundle Optimization** - Dynamic import only loads when enabled
✅ **Graceful Degradation** - Automatic fallback on errors
✅ **Progressive Enhancement** - Smooth path to courthive-components
