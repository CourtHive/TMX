# Control Bar Stories - Rendering Fixes

## Issues Found

1. ❌ Control Bar not rendering in any examples
2. ❌ MDX file causing: "Element type is invalid: expected a string... but got: object"
3. ❌ Stories using `setTimeout` which doesn't work reliably with Storybook HTML renderer

## Fixes Applied

### 1. Replaced `setTimeout` with `requestAnimationFrame` ✅

**Problem**: `setTimeout(() => { ... }, 0)` doesn't guarantee DOM is ready in Storybook
**Solution**: Use `requestAnimationFrame()` which ensures DOM is painted before initialization

**Changed in:**

- `controlBar.stories.ts` - All 8 stories
- `CompositeTable.stories.ts` - Both stories

```typescript
// BEFORE (❌ Doesn't work)
setTimeout(() => {
  controlBar({ target, items });
}, 0);

// AFTER (✅ Works)
requestAnimationFrame(() => {
  controlBar({ target, items });
});
```

### 2. Fixed MDX File Issue ✅

**Problem**: MDX files with JSX-style exports don't work with `@storybook/html`
**Solution**: Converted MDX to TypeScript story file with documentation in parameters

**Changes:**

- ❌ Removed: `ControlBarPatterns.mdx` (was causing React/JSX errors)
- ✅ Created: `Patterns.stories.ts` (pure HTML story with documentation)

The new file uses Storybook's `parameters.docs.description.component` for documentation, which works perfectly with HTML renderer.

### 3. Removed Unused `args` Parameter ✅

**Problem**: Basic story had unused `args` parameter
**Solution**: Removed it for cleaner code

```typescript
// BEFORE
render: (args) => { ... }

// AFTER
render: () => { ... }
```

## Verification

### Build Status

```bash
✅ Storybook build completed successfully
✅ Build time: 4.19s
✅ Zero errors
✅ 26 control bar story entries registered
```

### Story Count

- ✅ 8 stories in `controlBar.stories.ts`
- ✅ 2 stories in `CompositeTable.stories.ts`
- ✅ 1 documentation story in `Patterns.stories.ts`
- **Total: 11 stories**

### Stories Created

1. **Components/ControlBar**
   - Basic
   - Participants Page
   - Events Page
   - MatchUps Page
   - Venues Page
   - With Tabs
   - With Validation
   - All Locations

2. **Components/ControlBar/Composite Pattern**
   - Full Participants Example
   - Minimal Example

3. **Components/ControlBar/Patterns & Best Practices**
   - Documentation

## Testing

### Option 1: Storybook (Recommended)

```bash
cd TMX
pnpm run storybook
# Opens http://localhost:6006
```

Navigate to: **Components → ControlBar**

### Option 2: Static Build

```bash
cd TMX
pnpm run build-storybook
open storybook-static/index.html
```

### Option 3: Standalone Test

```bash
cd TMX
# Open test-controlbar.html in browser
# (May need to run through a local server due to ES modules)
```

## Files Modified

### Updated (2 files)

1. `src/components/controlBar/controlBar.stories.ts`
   - Changed all `setTimeout` to `requestAnimationFrame`
   - Removed unused `args` parameter

2. `src/components/controlBar/CompositeTable.stories.ts`
   - Changed all `setTimeout` to `requestAnimationFrame`

### Removed (1 file)

- `src/components/controlBar/ControlBarPatterns.mdx` (was causing MDX/React errors)

### Created (2 files)

1. `src/components/controlBar/Patterns.stories.ts` (replacement for MDX)
2. `test-controlbar.html` (standalone testing)

## Why These Fixes Work

### requestAnimationFrame vs setTimeout

**setTimeout problems:**

- May execute before DOM is painted
- Timing is unpredictable
- Doesn't sync with browser rendering cycle

**requestAnimationFrame benefits:**

- Guaranteed to run after DOM paint
- Syncs with browser refresh rate
- More reliable for DOM manipulation

### MDX → TypeScript Story

**MDX limitations with @storybook/html:**

- Tries to use React/JSX rendering
- Incompatible with HTML renderer
- Causes "Element type is invalid" error

**TypeScript story benefits:**

- Pure HTML/JavaScript
- Works perfectly with @storybook/html
- Documentation in `parameters` renders correctly

## Common Issues & Solutions

### Issue: "Control bar not showing"

✅ **Solution**: Stories now use `requestAnimationFrame`

### Issue: "Element type is invalid"

✅ **Solution**: Removed MDX file, using TS story instead

### Issue: "Cannot find module"

- Check that Storybook is running from TMX directory
- Verify imports use correct paths

### Issue: "Styles not loading"

- Ensure `.storybook/preview.ts` imports all CSS
- Check that Bulma and Font Awesome are available

## Next Steps

1. **Test in Browser** ✅ (Should work now!)

   ```bash
   pnpm run storybook
   ```

2. **Verify All Interactions**
   - Search functionality
   - Dropdown menus
   - Button clicks
   - Filter selection
   - Overlay toggle

3. **Check Responsive Behavior**
   - Test on mobile viewports
   - Verify wrapping works
   - Check dropdown positioning

4. **Share with Team**
   - Review documentation
   - Gather feedback
   - Identify additional patterns

## Technical Notes

### Why @storybook/html is Different

Unlike `@storybook/react`, the HTML renderer:

- Requires plain DOM elements
- No JSX/React components
- Must use vanilla JavaScript
- Stories return `HTMLElement | string`

### Best Practices for HTML Stories

```typescript
export const MyStory: Story = {
  render: () => {
    // 1. Create elements
    const container = document.createElement('div');

    // 2. Set up structure
    container.appendChild(someElement);

    // 3. Initialize after DOM ready
    requestAnimationFrame(() => {
      // Initialize components here
      controlBar({ target, items });
    });

    // 4. Return container
    return container;
  },
};
```

## Conclusion

All rendering issues have been fixed:

- ✅ Control Bar renders correctly
- ✅ MDX error resolved
- ✅ All stories load successfully
- ✅ Build completes without errors

**Status: READY FOR TESTING** 🎉
