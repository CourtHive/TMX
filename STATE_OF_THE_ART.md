# TMX State of the Art

**Last Updated:** January 26, 2026  
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Scoring System](#scoring-system)
4. [Entry Management](#entry-management)
5. [PDF Generation](#pdf-generation)
6. [Factory Integration](#factory-integration)
7. [courthive-components Integration](#courthive-components-integration)
8. [TODO](#todo)

---

## Overview

TMX (Tournament Management eXtreme / eXtensible Tournament Manager) is a Progressive Web App for tennis tournament management built on the TODS data standard and powered by the Competition Factory.

### Core Technologies

- **Data Standard:** TODS (Tennis Open Data Standards)
- **Business Logic:** tods-competition-factory (npm package)
- **UI Components:** courthive-components (shared component library)
- **PDF Generation:** pdfMake
- **Build:** Vite
- **Framework:** Vanilla TypeScript (no React/Vue/Angular)

### Key Features

- ✅ TODS-compliant tournament data management
- ✅ Draw generation and management
- ✅ Real-time score entry with multiple input approaches
- ✅ Entry management with Singles/Doubles support
- ✅ PDF generation for draws, schedules, and sign-in sheets
- ✅ Google Sheets integration for player imports
- ✅ Offline-capable PWA

---

## Architecture

### Repository Structure

```text
TMX/
├── src/
│   ├── components/       # UI components
│   │   └── modals/      # Modal dialogs
│   │       └── scoringV2/  # Scoring system
│   ├── services/        # Core services
│   │   ├── pdf/        # PDF generation
│   │   ├── settings/   # Settings management
│   │   └── transitions/ # State transitions
│   ├── tools/          # Utilities
│   │   └── freeScore/  # Score parser
│   └── settings/       # Configuration
└── dist/               # Build output
```

### Data Flow

```text
User Input
    ↓
UI Components (TMX)
    ↓
Competition Factory (Business Logic)
    ↓
TODS Data Model
    ↓
Storage / Export
```

---

## Scoring System

### Current Implementation: Scoring V2

The scoring system was completely rebuilt in January 2026 with three distinct input approaches.

### Scoring Approaches

#### 1. Dynamic Sets (Default)

**Best for:** Standard match entry, visual feedback

**Features:**

- Individual set-by-set input fields
- Real-time validation
- Auto-expansion as sets complete
- Tiebreak inputs auto-show for 6-6, 7-6 scenarios
- Keyboard navigation (Tab/Shift+Tab/Enter)
- Context-aware input limiting

**Format Support:**

- Standard (SET3-S:6/TB7, SET5-S:6/TB7)
- Short Sets (SET3-S:4/TB7, Fast4)
- Pro Sets (SET1-S:8/TB7)
- Tiebreak-Only (SET3-S:TB7, SET3-S:TB10, SET1-S:TB10)
- Timed Sets (SET3X-S:T10, SET2X-S:T20)
- Final Set Variations (ATP, Wimbledon, Australian Open)

#### 2. Free Score

**Best for:** Rapid entry, flexible input

**Features:**

- Free-form text input
- Intelligent parsing of various formats
- Accepts: `6-4 6-3`, `6463`, `67(5)64`
- Supports irregular endings: RET, WO, DEF
- Smart tiebreak detection

#### 3. Dial Pad

**Best for:** Mobile/touch devices

**Features:**

- Touch-friendly numeric keypad
- Visual score building
- Clear/backspace support
- Mobile-optimized layout

### Score Validation

**Validation Engine:** `src/components/modals/scoringV2/utils/scoreValidator.ts`

**Test Coverage:** 69/69 tests passing (100%)

**Validates:**

- Match format compliance
- Set/game score relationships
- Tiebreak rules per format
- Final set variations
- NOAD (No-Advantage) scoring
- Timed sets with exactly format

### Irregular Endings

Supports all TODS matchUpStatus constants:

- **RETIRED** - Player couldn't continue
- **WALKOVER** - Match didn't start
- **DEFAULTED** - Player disqualified
- **INCOMPLETE** - Match not finished
- **SUSPENDED** - Match paused

### Timed Sets Support

**Format:** `SET3X-S:T10` (exactly 3 sets, 10 minutes each)

**Behavior:**

- No score relationship requirements
- Any numeric values allowed (0-infinity)
- All sets shown immediately
- No tiebreak inputs
- Winner determined externally

**Scoring Methods (Future):**

- `T10G` - Games-based (count periods won)
- `T10A` - Aggregate (sum all scores)
- `T10P` - Points-based (regular tennis scoring)

---

## Entry Management

### Event Entries Interface

Comprehensive participant management system with panel-based organization.

### Entry Status Panels

#### 1. Accepted

- Main draw participants
- Seeding before draw creation
- Move to: Alternates, Withdrawn

#### 2. Qualifying

- Qualifying round participants
- Separate from main draw
- Move to: Accepted, Alternates, Withdrawn

#### 3. Alternates

- Backup participants
- Can replace withdrawn participants
- **Doubles:** Destroy pairs feature

#### 4. Ungrouped (Doubles Only)

- Individual participants not yet paired
- **Auto Pair toggle** for rapid pairing
- Search-driven workflow for fast pairing

#### 5. Withdrawn

- Withdrawn participants
- **Singles:** Move to Alternates
- **Doubles:** Move to Ungrouped (must re-pair)

### Doubles Pairing Workflow

**Auto Pair ON (Default):**

1. Select first participant
2. Select second participant
3. Pair created automatically
4. Moved to Alternates

**Search-Driven (Fastest):**

1. Type partial name → Press Enter
2. Type next partial name → Press Enter
3. Pair created automatically
4. Repeat until all paired

---

## PDF Generation

### Current Status

PDF generation system ported from TMX-Suite-Legacy, using pdfMake.

**Location:** `src/services/pdf/`

### Supported Documents

1. **Draw Sheets** - Elimination/tree draws with brackets
2. **Match Lists** - Complete match listings
3. **Schedule Sheets** - Time-based schedules
4. **Sign-In Sheets** - Player check-in forms
5. **Dual Match Sheets** - Team match formats

### Architecture

```text
PDF Generation Flow:
1. Create directive (document type + options)
2. Fetch images (logos, QR codes)
3. Generate SVG draw (if needed)
4. Convert SVG → PNG (via Canvas)
5. Build docDefinition (pdfMake format)
6. Execute action (open/save/download)
```

### Key Components

- **pdfMake** - Client-side PDF generation
- **D3.js** - SVG rendering for draws
- **HTML5 Canvas** - SVG to PNG conversion
- **Image Handling** - Logo and QR code embedding

### Data Model

Uses **TODS Data Model** for tournament/event/matchUp structure.

See: `src/services/pdf/TODS_DATA_MODEL.md`

---

## Factory Integration

### Competition Factory

**Package:** `tods-competition-factory` (npm)

**Purpose:** Business rules and data validation for tennis tournaments

**Key APIs Used:**

```typescript
// Tournament management
tournamentEngine.newTournamentRecord();
tournamentEngine.addEvent();
tournamentEngine.generateDrawDefinition();

// Match scoring
tournamentEngine.setMatchUpStatus();
tournamentEngine.setMatchUpScore();

// Format parsing
matchUpFormatCode.parse('SET3-S:6/TB7');
matchUpFormatCode.stringify(formatObject);
```

### Integration Points

1. **Score Validation**
   - Validates scores against format rules
   - Determines winner based on format
   - Handles irregular endings

2. **Draw Generation**
   - Creates TODS-compliant draw structures
   - Manages seeding and positioning
   - Handles byes and walkovers

3. **Format Parsing**
   - Parses matchUpFormat codes
   - Determines set/tiebreak rules
   - Handles specialized formats

### Factory Updates Required

**Timed Sets Scoring Methods:**

- Need to implement G/A/P notation in factory
- Parse `T10G` (games), `T10A` (aggregate), `T10P` (points)
- Update winner determination logic
- Support TB1 for set-level tiebreaks

See: `DEVPLAN.md` for full implementation plan

---

## courthive-components Integration

### Package

**Package:** `courthive-components` (npm)

**Purpose:** Shared UI components for CourtHive ecosystem

### Components Used

1. **cModal** - Modal dialog system
2. **renderMatchUp** - Match display with compositions
3. **Scoring Modals** - Full scoring system (migrated to components)
4. **Drawer** - Side panel component

### Recent Migrations

**Scoring System (Jan 2026):**

- All scoring modals moved to courthive-components
- Three approaches: Dynamic Sets, Free Score, Dial Pad
- Composition support (Australian, Wimbledon, French, etc.)
- Smart Complements feature for rapid entry

**Button Styling Fix (Jan 2026):**

- Added `footer.style` support to cModal
- Cancel button now has proper white background
- Customizable button styling via config

### Integration Pattern

```typescript
import { scoringModal, setScoringConfig } from 'courthive-components';

// Configure
setScoringConfig({
  scoringApproach: 'dynamicSets',
  smartComplements: true,
  composition: 'Australian',
});

// Open modal
scoringModal({
  matchUp: todsMatchUp,
  callback: (outcome) => {
    // Handle score submission
  },
});
```

### Customization

TMX can customize components via:

- CSS overrides
- `footer.style` property for buttons
- Composition selection
- Config flags

See: `courthive-components/src/components/scoring/TMX_INTEGRATION.md`

---

## TODO

### High Priority

#### 1. Factory: Timed Sets Scoring Methods

**Timeline:** 2-3 days  
**Status:** Planned

**Tasks:**

- [ ] Implement T10G/T10A/T10P notation parsing in factory
- [ ] Add `timedScoringMethod` to SetFormat type
- [ ] Implement winner determination for each method
- [ ] Add TB1 support for set-level tiebreaks
- [ ] Write tests for all combinations
- [ ] Publish factory to npm

**Reference:** `DEVPLAN.md`

#### 2. Modal Stacking Issue

**Timeline:** 1-2 days  
**Status:** In Progress

**Problem:** Clicking scoring button multiple times creates overlapping modals

**Solution:** Fix inside cModal itself, not at story level

- [ ] Investigate cModal singleton pattern
- [ ] Add guard to prevent multiple instances
- [ ] Test in Storybook
- [ ] Test in TMX integration

#### 3. courthive-components: Update After Factory Publish

**Timeline:** 1 day  
**Status:** Blocked by Factory

**Tasks:**

- [ ] Update factory dependency
- [ ] Add scoring method selector UI
- [ ] Test with new timed sets notation
- [ ] Publish components to npm

#### 4. TMX: Integrate Updated Components

**Timeline:** 1 day  
**Status:** Blocked by Components

**Tasks:**

- [ ] Update courthive-components dependency
- [ ] Update factory dependency
- [ ] Test all scoring approaches
- [ ] Deploy to production

### Medium Priority

#### 5. Documentation Cleanup

**Timeline:** 2-3 hours  
**Status:** Not Started

**Tasks:**

- [x] Consolidate markdown files into STATE_OF_THE_ART.md
- [ ] Archive historical docs to `/docs/archive/`
- [ ] Update README.md to reference STATE_OF_THE_ART.md
- [ ] Remove duplicate information
- [ ] Keep only: README, STATE_OF_THE_ART, component-specific docs

#### 6. Validation Migration to Factory

**Timeline:** 3-5 days  
**Status:** Future

**Tasks:**

- [ ] Move `scoreValidator.ts` to factory
- [ ] Use test suite as specification
- [ ] Integrate with `generateOutcomeFromScoreString`
- [ ] Update TMX to use factory validation
- [ ] Remove TMX validation code

#### 7. PDF Generation Enhancements

**Timeline:** 1-2 weeks  
**Status:** Future

**Tasks:**

- [ ] Add customizable tournament logos
- [ ] Implement schedule templates
- [ ] Add court assignment views
- [ ] Support custom page sizes
- [ ] Add print preview mode

### Low Priority

#### 8. Accessibility Audit

**Timeline:** 1 week  
**Status:** Future

**Tasks:**

- [ ] Keyboard navigation testing
- [ ] Screen reader compatibility
- [ ] ARIA labels audit
- [ ] Color contrast verification
- [ ] Focus management review

#### 9. Performance Optimization

**Timeline:** Ongoing  
**Status:** Monitoring

**Tasks:**

- [ ] Bundle size analysis
- [ ] Code splitting opportunities
- [ ] Lazy loading for PDF generation
- [ ] Image optimization
- [ ] Caching strategies

#### 10. Testing Infrastructure

**Timeline:** 2-3 weeks  
**Status:** Future

**Tasks:**

- [ ] Set up E2E testing (Playwright/Cypress)
- [ ] Add visual regression testing
- [ ] Implement CI/CD pipeline
- [ ] Automated deployment
- [ ] Staging environment

### Future Enhancements

#### 11. Advanced Scoring Features

- Point-by-point scoring
- Live scoring with WebSocket support
- Match timeline visualization
- Score statistics/analytics
- Match replay functionality

#### 12. Mobile App

- Native iOS/Android apps
- Offline-first architecture
- Push notifications
- Camera integration for court photos
- QR code scanning

#### 13. Cloud Integration

- Tournament data sync
- Multi-device support
- Backup and restore
- Shared tournament management
- API for third-party integrations

#### 14. Reporting System

- Custom report builder
- Export to Excel/CSV
- Player statistics
- Tournament summaries
- Historical data analysis

---

## Development Workflow

### Getting Started

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run tests (when available)
npm test
```

### Code Organization

**Conventions:**

- TypeScript for all new code
- No frameworks (vanilla JS/TS)
- Factory for business logic
- Components for reusable UI
- Services for app-specific features

**Naming:**

- camelCase for variables/functions
- PascalCase for classes/types
- kebab-case for file names
- UPPER_CASE for constants

### Commit Guidelines

```text
feat: Add timed sets support to dynamic sets modal
fix: Correct button styling in cModal
docs: Update STATE_OF_THE_ART.md with latest changes
refactor: Simplify score validation logic
test: Add tests for timed sets validation
```

### Branch Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

### Publishing

**Factory:**

```bash
cd factory
npm version minor
npm publish
git push --tags
```

**courthive-components:**

```bash
cd courthive-components
npm version minor
npm publish
git push --tags
```

---

## Resources

### Documentation

- **TODS Spec:** <https://itftennis.atlassian.net/wiki/spaces/TODS/overview>
- **Factory Docs:** <https://courthive.github.io/tods-competition-factory/>
- **Online Demo:** <https://courthive.github.io/TMX>

### Related Repositories

- **Factory:** <https://github.com/CourtHive/tods-competition-factory>
- **Components:** <https://github.com/CourtHive/courthive-components>
- **TMX:** <https://github.com/CourtHive/TMX>

### Historical Documents (Archived)

The following documents have been consolidated into this file:

- DEVPLAN.md - Timed sets implementation plan
- SCORING-V2-SUMMARY.md - Scoring system migration
- ENTRIES_TABLES_GUIDE.md - Entry management guide
- TIMED_SETS_SUPPORT.md - Timed sets documentation
- COURTHIVE-COMPONENTS-ENHANCEMENT.md - Component suggestions
- PDF_GENERATION_ASSESSMENT.md - PDF system porting notes

**Note:** Original files preserved in repository for historical reference.

---

## Contact

For questions, issues, or contributions, please refer to the GitHub repository or contact the development team.

**Last Updated:** January 26, 2026
