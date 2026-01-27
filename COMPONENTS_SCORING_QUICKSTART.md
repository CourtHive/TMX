# Quick Start: Courthive-Components Scoring

**For comprehensive testing, see:** [courthive-components/SCORING_MODAL_TESTING_GUIDE.md](../courthive-components/SCORING_MODAL_TESTING_GUIDE.md)

## Enable Feature

```javascript
// In browser console
window.dev.toggleComponentsScoring();
// Reload page
```

## Disable Feature

```javascript
// In browser console
window.dev.toggleComponentsScoring();
// Reload page
```

## Check Status

```javascript
window.dev.useComponentsScoring;
// → true (enabled) or false (disabled)
```

## Configure Smart Complements

```javascript
// Method 1: Via Settings modal (recommended - persists)
// Open Settings modal and check "Smart Complements"

// Method 2: Via localStorage (persists)
const settings = JSON.parse(localStorage.getItem('tmx_settings') || '{}');
settings.smartComplements = true;
localStorage.setItem('tmx_settings', JSON.stringify(settings));

// Method 3: Directly in console (temporary only)
env.smartComplements = true;
// Now typing "6" auto-fills "6-4"
```

## Change Scoring Approach

```javascript
env.scoringApproach = 'dialPad'; // or 'dynamicSets' or 'freeScore'
```

## Set Default Composition

```javascript
env.composition = { compositionName: 'Wimbledon' };
```

## Console Commands

```javascript
// Enable and reload
window.dev.toggleComponentsScoring();
location.reload();

// Quick test
window.dev.useComponentsScoring = true;
env.scoringApproach = 'dynamicSets';
env.smartComplements = true;
```

## Configuration Priority

### Composition Name

1. Draw Extension (from "Edit display settings")
2. `env.composition`
3. `localStorage.getItem('tmx_composition')`
4. Default: "Australian"

### Smart Complements

1. `localStorage.getItem('tmx_settings')` → `smartComplements`
2. `env.smartComplements`
3. Default: `false`

## Expected Console Output

When enabled:

```
✓ Using courthive-components scoring {
  approach: "dynamicSets",
  composition: "Wimbledon",
  smartComplements: false
}
```

When toggling:

```
✓ Components Scoring: ENABLED
⚠ Reload the page to apply changes
```

## Troubleshooting

**Modal doesn't open:**

```javascript
// Disable feature flag
window.dev.toggleComponentsScoring();
location.reload();
```

**Check composition source:**

```javascript
// From console
const result = tournamentEngine.findExtension({
  name: 'display',
  drawId: 'your-draw-id',
});
console.log(result?.extension?.value?.compositionName);
```

**Check Smart Complements setting:**

```javascript
const settings = JSON.parse(localStorage.getItem('tmx_settings'));
console.log('Smart Complements:', settings?.smartComplements);
console.log('Env:', env.smartComplements);
```

**Clear localStorage:**

```javascript
localStorage.removeItem('tmx_useComponentsScoring');
localStorage.removeItem('tmx_composition');
```
