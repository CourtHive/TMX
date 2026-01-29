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

### Customization

TMX can customize components via:

- CSS overrides
- `footer.style` property for buttons
- Composition selection
- Config flags

See: `courthive-components/src/components/scoring/TMX_INTEGRATION.md`

---

**Tasks:**

- [ ] Set up E2E testing (Playwright/Cypress)
- [ ] Add visual regression testing
- [ ] Implement CI/CD pipeline
- [ ] Automated deployment
- [ ] Staging environment

### Future Enhancements

#### 1. Advanced Scoring Features

- Point-by-point scoring
- Live scoring with WebSocket support
- Match timeline visualization
- Score statistics/analytics
- Match replay functionality

#### 2. Notes

- Tournament Tab - Set Categories for the tournament
- Tournament Tab - define the type of scheduling that will be used
- Schedule Tab to support two views: Follow By and Garman
- Tournament Tab - or new Scheduling View - set matchUp Daily Limits
- Category Filter on participants tab to filter participants before generating event
- Category Selector in create event will flag if selected players are ineligible
- On Draws View ability to modifyMatchUpFormatTiming

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

### Branch Strategy

- `main` - Production-ready code
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates

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

---

**Last Updated:** January 26, 2026
