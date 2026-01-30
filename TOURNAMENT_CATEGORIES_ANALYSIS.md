# Tournament-Level Category Management - Analysis & Implementation Plan

## Executive Summary

The TODS (Tennis Open Data Standards) schema already includes support for tournament-level category definitions via the `tournamentCategories` field. The factory provides methods to set/get these categories, enabling:

1. **Tournament-level category definitions** that can be reused across events
2. **Dynamic category selectors** in the Add Event dialog
3. **Custom category creation** that adds to tournament categories
4. **Tournament category editor** for managing categories centrally

## Current State Analysis

### ✅ Schema Support (Already Exists)

**Tournament Type** (`factory/src/types/tournamentTypes.ts`):
```typescript
export interface Tournament {
  // ... other fields
  tournamentCategories?: Category[];
  // ... other fields
}
```

**Category Type** (Complete definition already exists):
```typescript
export interface Category {
  ageCategoryCode?: string;      // e.g., "U18", "10-12U", "35-45O"
  ageMax?: number;                // Maximum age
  ageMaxDate?: string;            // Birth date (YYYY-MM-DD)
  ageMin?: number;                // Minimum age
  ageMinDate?: string;            // Birth date (YYYY-MM-DD)
  ballType?: BallTypeUnion;       // Ball type constant
  categoryName?: string;          // Display name
  categoryType?: string;          // Additional type info
  createdAt?: Date | string;      // Timestamp
  extensions?: Extension[];       // Custom extensions
  isMock?: boolean;               // Test data flag
  notes?: string;                 // Additional information
  ratingMax?: number;             // Maximum rating
  ratingMin?: number;             // Minimum rating
  ratingType?: string;            // WTN, UTR, NTRP, DUPR, TRN
  subType?: string;               // Sub-category
  timeItems?: TimeItem[];         // Time-based data
  type?: CategoryUnion;           // AGE | BOTH | LEVEL (note: LEVEL not RATING in current enum)
  updatedAt?: Date | string;      // Timestamp
}

type CategoryUnion = 'AGE' | 'BOTH' | 'LEVEL';
```

**Note:** The `CategoryUnion` type uses `'LEVEL'` instead of `'RATING'`. The courthive-components category editor uses `'RATING'`, so we need to either:
- Update the factory enum to include `'RATING'`
- OR map `'RATING'` → `'LEVEL'` when saving to tournament
- OR update the editor to use `'LEVEL'` instead

### ✅ Factory Methods (Already Exist)

#### Mutation Method

**`tournamentEngine.setTournamentCategories({ categories })`**

Located in: `factory/src/mutate/tournaments/tournamentDetails.ts`

```typescript
export function setTournamentCategories({ tournamentRecord, categories }) {
  if (!tournamentRecord) return { error: MISSING_TOURNAMENT_RECORD };
  
  // Filters categories to only include valid ones (must have categoryName and type)
  categories = (categories || []).filter((category) => 
    category.categoryName && category.type
  );
  
  tournamentRecord.tournamentCategories = categories;

  addNotice({
    topic: MODIFY_TOURNAMENT_DETAIL,
    payload: {
      parentOrganisation: tournamentRecord.parentOrganisation,
      tournamentId: tournamentRecord.tournamentId,
      categories,
    },
  });

  return { ...SUCCESS };
}
```

**Usage:**
```typescript
const categories = [
  {
    categoryName: 'Boys 10-12',
    ageCategoryCode: '10-12U',
    type: 'AGE',
    ageMin: 10,
    ageMax: 12
  },
  {
    categoryName: 'Intermediate 3.5-4.0',
    ratingType: 'NTRP',
    ratingMin: 3.5,
    ratingMax: 4.0,
    type: 'LEVEL'  // or 'RATING' if we update the enum
  }
];

const result = tournamentEngine.setTournamentCategories({ categories });
```

#### Query Methods

**`tournamentEngine.getTournament()`** - Returns tournament record with categories

```typescript
const { tournamentRecord } = tournamentEngine.getTournament();
const categories = tournamentRecord.tournamentCategories || [];
```

**`tournamentEngine.getTournamentInfo()`** - Returns tournament info (may include categories)

#### Validation/Query Utilities

**`getCategoryAgeDetails({ category, consideredDate })`**
- Calculates age ranges from category code
- Validates category structure
- Returns ageMin, ageMax, ageMinDate, ageMaxDate
- Located: `factory/src/query/event/getCategoryAgeDetails.ts`

**`categoryCanContain({ category, childCategory })`**
- Checks if one category can contain another
- Useful for flight validation
- Located: `factory/src/query/event/categoryCanContain.ts`

**`validateCategory({ category })`**
- Validates category structure
- Located: `factory/src/validators/validateCategory.ts`

### ❌ Missing Methods (Need to Add)

1. **`getTournamentCategories()`** - Convenience method to get just categories
2. **`addTournamentCategory({ category })`** - Add single category
3. **`removeTournamentCategory({ categoryName })`** - Remove by name
4. **`updateTournamentCategory({ categoryName, updates })`** - Update existing

## Implementation Plan

### Phase 1: Update Event Dialog to Use Inputs Object (Immediate)

**Goal:** Add custom category to dropdown after creation using the returned inputs object.

**Changes Required:**

1. **Store inputs reference** in editEvent function:
```typescript
let formInputs: any;  // Store at function scope

const content = (elem: HTMLElement) => {
  formInputs = renderForm(elem, items, relationships);
  return formInputs;
};
```

2. **Add category to dropdown** in `proceedWithSave` callback:
```typescript
const proceedWithSave = (category?: any) => {
  if (category && category.ageCategoryCode && formInputs?.ageCategoryCode) {
    // Add the new category to the dropdown
    const newOption = new Option(
      `${category.categoryName} (${category.ageCategoryCode})`,
      category.ageCategoryCode
    );
    formInputs.ageCategoryCode.options.add(newOption);
    
    // Select the new option
    formInputs.ageCategoryCode.value = category.ageCategoryCode;
  }
  
  // ... rest of save logic
};
```

**Benefits:**
- No DOM manipulation/hacking required
- Uses official renderForm API
- Category immediately visible in dropdown
- User can see what they just created

### Phase 2: Read Tournament Categories (Short Term)

**Goal:** Populate category dropdown from tournament-level definitions.

**Changes Required:**

1. **Get tournament categories** when opening dialog:
```typescript
export function editEvent({ table, event, participants, callback }: EditEventParams): void {
  // ... existing setup code
  
  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const tournamentCategories = tournamentRecord?.tournamentCategories || [];
  
  // Build category options from tournament categories + defaults
  const categoryOptions = [
    {
      selected: ['', undefined].includes(values.ageCategoryCode),
      label: '------------',
      value: '',
    },
    // Add tournament categories first
    ...tournamentCategories.map(cat => ({
      selected: values.ageCategoryCode === cat.ageCategoryCode,
      label: `${cat.categoryName} (${cat.ageCategoryCode || 'Custom'})`,
      value: cat.ageCategoryCode || cat.categoryName,
    })),
    // Then add standard defaults if not already present
    ...(tournamentCategories.length === 0 ? [
      { selected: values.ageCategoryCode === 'U10', label: '10 and Under', value: 'U10' },
      { selected: values.ageCategoryCode === 'U12', label: '12 and Under', value: 'U12' },
      // ... other defaults
    ] : []),
    {
      label: 'Custom',
      value: 'custom',
    },
  ];
}
```

2. **Remove hardcoded categories** from form items
3. **Use dynamic options** based on tournament state

**Benefits:**
- Tournament-specific categories available immediately
- Consistent categories across events
- Reduced redundant data entry

### Phase 3: Save Custom Categories to Tournament (Medium Term)

**Goal:** When user creates custom category, add it to tournament categories.

**Changes Required:**

1. **Add helper method** in TMX:
```typescript
function addCategoryToTournament(category: any): boolean {
  const { tournamentRecord } = tournamentEngine.getTournament();
  const existing = tournamentRecord.tournamentCategories || [];
  
  // Check if category already exists
  const isDuplicate = existing.some(cat => 
    cat.ageCategoryCode === category.ageCategoryCode ||
    cat.categoryName === category.categoryName
  );
  
  if (isDuplicate) return false;
  
  // Add category
  const categories = [...existing, category];
  const result = tournamentEngine.setTournamentCategories({ categories });
  
  return result.success;
}
```

2. **Call after category creation**:
```typescript
const setCategory = (categoryResult: any) => {
  if (categoryResult && categoryResult.ageCategoryCode) {
    // Add to tournament categories
    addCategoryToTournament(categoryResult);
    
    // Update dropdown with new category
    const newOption = new Option(
      `${categoryResult.categoryName} (${categoryResult.ageCategoryCode})`,
      categoryResult.ageCategoryCode
    );
    formInputs.ageCategoryCode.options.add(newOption);
    
    // Proceed with event save
    proceedWithSave(categoryResult);
  }
};
```

**Benefits:**
- Category reusable in future events
- Tournament maintains category library
- Reduced duplicate definitions

### Phase 4: Tournament Category Editor (Long Term)

**Goal:** Dedicated UI for managing tournament-level categories.

**Location:** New tab or section in Tournament settings

**UI Components:**

1. **Category List Table**
   - Column: Category Name
   - Column: Type (AGE / RATING / BOTH)
   - Column: Details (age range, rating range, ball type)
   - Column: Actions (Edit, Delete)

2. **Add Category Button**
   - Opens getCategoryModal
   - Saves to tournament categories

3. **Edit Category Button**
   - Opens getCategoryModal with existing category
   - Updates tournament categories

4. **Delete Category Button**
   - Confirms deletion
   - Checks if category is in use by events
   - Removes from tournament categories

**Implementation File:** `/TMX/src/pages/tournament/tabs/categoriesTab/categoriesView.ts`

```typescript
export function categoriesView(): void {
  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const categories = tournamentRecord?.tournamentCategories || [];
  
  const { table } = createCategoriesTable(categories);
  
  const addCategory = () => {
    getCategoryModal({
      callback: (category) => {
        // Add to tournament
        const existing = tournamentRecord.tournamentCategories || [];
        const result = tournamentEngine.setTournamentCategories({
          categories: [...existing, category]
        });
        
        if (result.success) {
          // Refresh table
          table.updateOrAddData([mapCategory(category)]);
        }
      }
    });
  };
  
  const deleteCategory = (categoryName: string) => {
    // Check if category is in use
    const events = tournamentEngine.getEvents().events || [];
    const inUse = events.some(e => 
      e.category?.categoryName === categoryName
    );
    
    if (inUse) {
      tmxToast({
        message: `Category "${categoryName}" is in use by events`,
        intent: 'is-warning'
      });
      return;
    }
    
    // Remove category
    const existing = tournamentRecord.tournamentCategories || [];
    const updated = existing.filter(c => c.categoryName !== categoryName);
    
    tournamentEngine.setTournamentCategories({ categories: updated });
    table.deleteRow([categoryName]);
  };
  
  // ... control bar setup
}
```

### Phase 5: Default Categories & Policies (Future)

**Goal:** Support default categories from provider policies or tournament templates.

**Approaches:**

1. **Policy-based Categories**
   - Define `POLICY_TYPE_CATEGORIES = 'categories'` in policyConstants
   - Store default categories in policy
   - Apply when tournament is created

2. **Provider Defaults**
   - Provider info includes default category set
   - Applied to new tournaments
   - User can override/extend

3. **Tournament Templates**
   - Pre-configured category sets
   - "Youth Tournament" template: U10, U12, U14, U16, U18
   - "Adult Tournament" template: Open, 35+, 45+, 55+, 65+
   - "NTRP Tournament" template: 2.5-3.0, 3.0-3.5, 3.5-4.0, etc.

**Implementation:**
```typescript
// In policy
export const POLICY_DEFAULT_CATEGORIES = {
  categories: [
    { categoryName: 'U10', ageCategoryCode: 'U10', type: 'AGE' },
    { categoryName: 'U12', ageCategoryCode: 'U12', type: 'AGE' },
    // ... more defaults
  ]
};

// Apply on tournament creation
tournamentEngine.newTournamentRecord({ 
  policyDefinitions: { categories: POLICY_DEFAULT_CATEGORIES }
});
```

## Technical Considerations

### 1. Category Type Enum Mismatch

**Issue:** Factory uses `'LEVEL'`, editor uses `'RATING'`

**Solutions:**
- **Option A:** Update factory enum to include `'RATING'`
  - Most aligned with common terminology
  - Matches editor expectations
  - May break existing data if `'LEVEL'` is used anywhere
  
- **Option B:** Map in TMX layer
  ```typescript
  const mapCategoryTypeToFactory = (type: string) => {
    if (type === 'RATING') return 'LEVEL';
    return type;
  };
  ```
  
- **Option C:** Update editor to use `'LEVEL'`
  - Changes user-facing terminology
  - Less intuitive

**Recommendation:** Option A (add 'RATING' to enum) or update enum to support both

### 2. Category Uniqueness

**Challenge:** How to identify unique categories?

**Options:**
- By `categoryName` (user-friendly, may have collisions)
- By `ageCategoryCode` (unique for age categories, null for rating-only)
- By composite key (categoryName + type + age/rating details)
- Add `categoryId` field (most robust, requires schema update)

**Recommendation:** Use `categoryName` as primary key, validate uniqueness on add

### 3. Category Deletion Safety

**Challenge:** Prevent deleting categories in use by events

**Implementation:**
```typescript
function isCategoryInUse(categoryName: string): boolean {
  const events = tournamentEngine.getEvents().events || [];
  return events.some(event => 
    event.category?.categoryName === categoryName
  );
}

function canDeleteCategory(categoryName: string): {
  canDelete: boolean;
  reason?: string;
  eventsUsing?: string[];
} {
  const events = tournamentEngine.getEvents().events || [];
  const eventsUsing = events
    .filter(e => e.category?.categoryName === categoryName)
    .map(e => e.eventName);
  
  return {
    canDelete: eventsUsing.length === 0,
    reason: eventsUsing.length > 0 
      ? `Category is used by ${eventsUsing.length} event(s)`
      : undefined,
    eventsUsing
  };
}
```

### 4. Migration Strategy

**For Existing Tournaments:**

1. **Detect legacy events** with categories not in tournament categories
2. **Auto-migrate** on first edit:
   ```typescript
   function migrateEventCategoriesToTournament() {
     const { tournamentRecord } = tournamentEngine.getTournament();
     const events = tournamentEngine.getEvents().events || [];
     const existing = tournamentRecord.tournamentCategories || [];
     
     const newCategories = events
       .map(e => e.category)
       .filter(Boolean)
       .filter(cat => 
         !existing.some(ec => ec.categoryName === cat.categoryName)
       );
     
     if (newCategories.length > 0) {
       tournamentEngine.setTournamentCategories({
         categories: [...existing, ...newCategories]
       });
     }
   }
   ```

3. **No data loss** - event categories preserved even if not in tournament list

## Implementation Timeline

### Sprint 1 (This Week)
- ✅ Enable Custom category in Add Event dialog
- ✅ Integrate category editor
- ✅ Add custom category to dropdown via inputs object

### Sprint 2 (Next Week)
- [ ] Read tournament categories in Add Event dialog
- [ ] Save custom categories to tournament
- [ ] Add factory helper methods if needed

### Sprint 3 (Following Week)
- [ ] Build tournament categories table
- [ ] Add category management UI to tournament tab
- [ ] Implement add/edit/delete operations

### Sprint 4 (Future)
- [ ] Add category policies
- [ ] Create category templates
- [ ] Build migration tool for existing tournaments

## Testing Strategy

### Unit Tests (Factory)
- ✅ `setTournamentCategories` with valid/invalid categories
- ✅ Category validation
- ✅ Age detail calculation
- [ ] Helper methods for add/remove/update

### Integration Tests (TMX)
- [ ] Add event with custom category
- [ ] Custom category appears in dropdown
- [ ] Custom category saved to tournament
- [ ] Tournament categories load in dropdown
- [ ] Category editor integration

### E2E Tests
- [ ] Create tournament → add categories → create events
- [ ] Edit categories → verify events unaffected
- [ ] Delete unused category → success
- [ ] Delete used category → blocked with message

## Success Metrics

1. **User Experience**
   - Time to create event with custom category: < 30 seconds
   - Category reuse: > 60% of events use tournament categories
   - User confusion: < 5% support requests about categories

2. **Code Quality**
   - No DOM manipulation outside renderForm API
   - All category operations go through tournamentEngine
   - 100% test coverage for category mutations

3. **Data Integrity**
   - Zero data loss during category operations
   - All events maintain valid category references
   - Categories validated before save

## Conclusion

The infrastructure for tournament-level category management already exists in the factory. Implementation involves:

1. **Phase 1 (Done):** Custom category creation in Add Event dialog
2. **Phase 2 (Immediate):** Add custom categories to dropdown via inputs object
3. **Phase 3 (Short term):** Read tournament categories when opening Add Event
4. **Phase 4 (Medium term):** Save custom categories to tournament automatically
5. **Phase 5 (Long term):** Build tournament category editor UI
6. **Phase 6 (Future):** Support category policies and templates

This phased approach allows incremental delivery of value while building toward a complete category management system.
