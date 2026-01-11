# Renderer Migration Plan: TMX → courthive-components

## Overview
The form renderer files (`renderButtons`, `renderField`, `renderForm`, `renderMenu`, `renderValidator`) were copied from TMX into courthive-components. We can now replace the local TMX implementations with imports from courthive-components.

## Current State

### Files to Replace in TMX
```
src/components/renderers/
├── renderButtons.ts      (151 lines)
├── renderField.ts        (399 lines)
├── renderForm.ts         (305 lines)
├── renderMenu.ts         (287 lines)
└── renderValidator.ts    (128 lines)
Total: 1,270 lines of code
```

### Available in courthive-components
All renderers are exported from `courthive-components` v0.8.11 (already in TMX package.json):
```typescript
export { renderButtons } from 'courthive-components';
export { renderField, renderOptions } from 'courthive-components';
export { renderForm } from 'courthive-components';
export { renderMenu } from 'courthive-components';
export { validator } from 'courthive-components'; // Note: renamed from renderValidator
```

## Differences Between Implementations

### 1. renderButtons.ts
**Differences:**
- Import paths: `functions/typeOf` → `../../helpers/typeOf`
- Minor formatting: Single-line vs multi-line conditionals

**Compatibility:** ✅ Functionally identical

### 2. renderField.ts
**Differences:**
- Import paths:
  - `services/dom/createTypeAhead` → `../../helpers/createTypeAhead`
  - `functions/typeOf` → `../../helpers/typeOf`
  - `constants/tmxConstants` → `../../data/componentConstants`

**Compatibility:** ✅ Functionally identical (NONE constant exists in both)

### 3. renderForm.ts
**Differences:**
- Import path: `functions/typeOf` → `../../helpers/typeOf`

**Compatibility:** ✅ Functionally identical

### 4. renderMenu.ts
**Differences:** None! Files are byte-for-byte identical.

**Compatibility:** ✅ Identical

### 5. renderValidator.ts
**Note:** Exported as `validator` in courthive-components (not used in TMX currently)

## Usage Analysis

### Files Importing Renderers (48 files)
```
renderButtons:  8 files
renderField:    2 files (via renderOptions)
renderForm:    40 files
renderMenu:     0 files (only internal cross-references)
```

### Import Pattern
All imports follow this pattern:
```typescript
import { renderButtons } from 'components/renderers/renderButtons';
import { renderForm } from 'components/renderers/renderForm';
import { renderOptions } from 'components/renderers/renderField';
```

## Migration Steps

### Step 1: Update Imports (Automated)
Replace all imports in 48 files:

**Find:**
```typescript
import { renderButtons } from 'components/renderers/renderButtons';
import { renderField, renderOptions } from 'components/renderers/renderField';
import { renderForm } from 'components/renderers/renderForm';
```

**Replace with:**
```typescript
import { renderButtons } from 'courthive-components';
import { renderField, renderOptions } from 'courthive-components';
import { renderForm } from 'courthive-components';
```

### Step 2: Verify courthive-components Version
Ensure `package.json` has courthive-components with renderers:
```json
"courthive-components": "0.8.11"
```
✅ Already present in TMX

### Step 3: Remove Local Renderer Files
After successful migration and testing:
```bash
rm -rf src/components/renderers/
```

### Step 4: Update Build and Test
```bash
npm run build:dev
npm test
npm run lint
```

## Affected Files List

### Files to Update (48 total)

**Pages (5 files):**
1. `pages/tournament/tabs/eventsTab/editEvent.ts`
2. `pages/tournament/tabs/participantTab/sheetsLink.ts`
3. `pages/tournament/tabs/participantTab/editIndividualParticipant.ts`
4. `pages/tournament/tabs/participantTab/editGroupingParticipant.ts`
5. `pages/tournament/tabs/venuesTab/addVenue.ts`

**Drawers (4 files):**
6. `components/drawers/editTournamentDrawer.ts`
7. `components/drawers/addDraw/getDrawFormRelationships.ts`
8. `components/drawers/addDraw/addDraw.ts`
9. `components/drawers/avoidances/editAvoidances.ts`

**Modals (39 files):**
10. `components/modals/removeApproved.ts`
11. `components/modals/addAdHocRound.ts`
12. `components/modals/scheduleNotes.ts`
13. `components/modals/createTeamFromAttribute.ts`
14. `components/modals/addToEvent.ts`
15. `components/modals/deleteFlights.ts`
16. `components/modals/selectProviderModal.ts`
17. `components/modals/mockParticipants.ts`
18. `components/modals/modifyGroupName.ts`
19. `components/modals/settingsModal.ts`
20. `components/modals/tournamentActions.ts`
21. `components/modals/displaySettings/editDisplaySettings.ts`
22. `components/modals/loginModal.ts`
23. `components/modals/editStructureNames.ts`
24. `components/modals/loadTournamentById.ts`
25. `components/modals/fetchTournamentDetails.ts`
26. `components/modals/inviteUser.ts`
27. `components/modals/editGroupNames.ts`
28. `components/modals/registrationModal.ts`
29. `components/modals/editProvider.ts`
30. `components/modals/selectIdiom.ts`
31. `components/modals/addStructures.ts`
32. `components/modals/enterLink.ts`
33. `components/modals/renameCourt.ts`
34. `components/modals/deleteEvents.ts`
35. `components/modals/deleteAdHocMatchUps.ts`
36. `components/modals/resetDraws.ts`
37. `components/modals/addAdHocMatchUps.ts`
38. `components/modals/selectAndDeleteFlights.ts`
39. `components/modals/addRRplayoffs.ts`
40. `components/modals/tournamentImage.ts`

**Internal Cross-References (2 files):**
41. `components/renderers/renderMenu.ts` (imports renderField - will be deleted)
42. `components/renderers/renderForm.ts` (imports renderField - will be deleted)

## Risk Assessment

### Low Risk ✅
- Implementations are functionally identical
- courthive-components already tested and in use
- No breaking API changes
- Can be tested incrementally

### Testing Strategy
1. **Update imports** for all 48 files
2. **Run linting** to catch any issues
3. **Run build** to ensure no compilation errors
4. **Run tests** to verify functionality
5. **Manual testing** of key forms (tournament settings, participant editing, etc.)
6. **Delete local files** only after all tests pass

## Automated Migration Script

```bash
#!/bin/bash
# migrate-renderers.sh

# Replace renderButtons imports
find src -type f -name "*.ts" -exec sed -i '' \
  's|import { renderButtons } from '\''components/renderers/renderButtons'\'';|import { renderButtons } from '\''courthive-components'\'';|g' {} +

# Replace renderForm imports
find src -type f -name "*.ts" -exec sed -i '' \
  's|import { renderForm } from '\''components/renderers/renderForm'\'';|import { renderForm } from '\''courthive-components'\'';|g' {} +

# Replace renderField/renderOptions imports
find src -type f -name "*.ts" -exec sed -i '' \
  's|import { renderOptions } from '\''components/renderers/renderField'\'';|import { renderOptions } from '\''courthive-components'\'';|g' {} +

find src -type f -name "*.ts" -exec sed -i '' \
  's|import { renderField } from '\''components/renderers/renderField'\'';|import { renderField } from '\''courthive-components'\'';|g' {} +

# Verify changes
echo "Changed files:"
git diff --name-only

# Run validation
npm run lint
npm run build:dev
npm test

echo "If all tests pass, delete local renderers:"
echo "rm -rf src/components/renderers/"
```

## Benefits

1. **Reduced Code Duplication:** Removes 1,270 lines of duplicated code
2. **Single Source of Truth:** Updates to renderers only need to happen in courthive-components
3. **Consistency:** Ensures TMX and other projects use identical renderer implementations
4. **Maintainability:** Bug fixes and features automatically available to all consumers
5. **Package Size:** Slightly smaller TMX codebase

## Rollback Plan

If issues arise:
1. Revert import changes: `git checkout src/`
2. Local renderer files remain in git history
3. Can cherry-pick back if needed

## Timeline Estimate

- Step 1 (Update imports): 5 minutes (automated script)
- Step 2 (Verify package): 1 minute
- Step 3 (Testing): 15-30 minutes
- Step 4 (Delete files): 1 minute
- **Total: ~30-45 minutes**

## Next Steps

1. Review and approve this migration plan
2. Run automated migration script
3. Test thoroughly
4. Delete local renderer files
5. Commit changes with descriptive message

---

**Status:** Ready for execution
**Last Updated:** 2026-01-11
