# TODO

---

1. Event Entries needs to have a Ranking Column that is (potentially) editable.
2. For Flight generation to work, the scaleItems need to have the itemType: 'SCALE.RANKING.SINGLES.eventId'
3. There is an outstanding question about whether ranking org can be included, e.g. if considering ITF vs. ATP vs. USTA category rankings...
4. When rankings are pulled in from an external source it must always be in the context of the event, if the eventId is to be one of the '.' keys
5. It could be that 'SCALE.RANKING.SINGLES.ATP' is sufficient and client side logic can work out that ATP applies to MALE gender events?
6. if the event dialog attempts to change category: 1) if draws have been generated, disable the category selector 2) warning popover if a category is selected that would force event entries to be removed from the event due to not matching the category; 3) logic to remove entries that do not meet the category
7. Store seeding method as an extension on the structure (e.g., 'UTR', 'WTN', 'RANKING', 'MANUAL') when seeding is performed. This enables future features like re-sorting within seed blocks during cascade operations.
8. Multi-factor weighted seeding: allow tournament directors to combine multiple ratings/rankings with configurable weights (e.g., 25% UTR, 45% WTN, 30% ranking) to produce a composite seeding order.
9. Refactor `components/drawers/addDraw/getDrawFormItems.ts` + `getDrawFormRelationships.ts` into a state-machine model with a full test suite. The current implementation is a tangle of interacting flags (`isQualifying`, `isPopulateMain`, `isAttachingQualifying`, `isQualifyingFirst`, `drawId`, `structureId`) with duplicated logic and 7-level nested ternaries. Every new mode exposes a new bug because the logic isn't composable.

   **Proposed model:**

   ```text
   DrawFormMode =
     | { kind: 'NEW_MAIN', event }
     | { kind: 'NEW_MAIN_WITH_QUALIFYING_FIRST', event }
     | { kind: 'NEW_QUALIFYING', event }
     | { kind: 'POPULATE_MAIN', event, draw }       // main placeholder exists
     | { kind: 'GENERATE_QUALIFYING', event, draw } // main has placeholder qualifying
     | { kind: 'ATTACH_QUALIFYING', event, draw, structure }
   ```

   Each mode has explicit, isolated logic for:
   - `drawEntries` — which entries to include
   - `qualifiersCount` — initial value + source of truth
   - `drawSize` — how to compute it
   - `visibleFields` — which form fields to show
   - `initialDrawType` + allowed draw types
   - `automatedDefault` — automated vs manual

   Plus a state machine for transitions:
   - `drawType change` → recompute visibility + drawSize
   - `qualifiersCount change` → validate + update drawSize
   - `qualifyingFirst toggle` → switch between NEW_MAIN and NEW_MAIN_WITH_QUALIFYING_FIRST

   Carve out `drawFormModel.ts` — a pure function `(mode, inputs) => { fieldStates, derivedValues, validationErrors }` — and migrate logic incrementally. `getDrawFormItems.ts` and `getDrawFormRelationships.ts` become thin adapters that render the model. Vitest suite pins each mode's behavior.
