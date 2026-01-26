# PDF Generation Assessment - TMX-Suite-Legacy → TMX

**Date:** 2026-01-11  
**Source:** TMX-Suite-Legacy  
**Target:** TMX (current)

## Executive Summary

The TMX-Suite-Legacy project contains a comprehensive PDF generation system using **pdfMake** that can generate:
- Draw sheets (elimination/tree draws)
- Match lists
- Schedule sheets
- Sign-in sheets
- Dual match sheets

The system is well-structured but uses an old data model. With adaptation, it can be ported to modern TMX.

## Architecture Overview

### Core Components

```
engineFactory/pdfEngine/
├── index.js                 # Main engine entry point
├── pdfLegacy.js            # Legacy compatibility layer
├── generators/             # Document generators
│   ├── pdfDrawGenerator.js    # Draw sheet generation
│   └── matchListGenerator.js  # Match list generation
├── draws/                  # Draw-specific templates
│   └── drawSheet.js          # Draw sheet layout
├── headers/                # Page headers
│   ├── drawSheetHeader.js
│   ├── scheduleHeader.js
│   └── matchesListHeader.js
├── footers/                # Page footers
├── matches/                # Match-related templates
│   ├── matchesList.js
│   ├── matchesByCourt.js
│   ├── matchesByTime.js
│   └── dualSheet.js
├── players/                # Player lists
│   ├── signInSheet.js
│   ├── doublesSignInSheet.js
│   └── tournamentPlayerList.js
├── schedule/               # Schedule templates
│   ├── scheduleCell.js
│   └── scheduleDocDefinition.js
├── svgGeneration/          # SVG → PNG conversion
│   ├── renderTreeDraw.js
│   └── svgUtilities.js
└── templateProvider/       # Template registry

services/files/pdf/
└── pdfExport.js           # pdfMake wrapper (open/save/emit)
```

### Data Flow

```
1. Create Directive
   ↓
2. Fetch Images (logos, QR codes)
   ↓
3. Generate SVG Draw (if needed)
   ↓
4. Convert SVG → PNG (via Canvas)
   ↓
5. Build docDefinition (pdfMake format)
   ↓
6. Execute Action (open/save/emit)
```

## Key Technologies

### pdfMake (v0.1.68)
- **Client-side PDF generation** library
- Declarative document definition format
- Supports images, tables, styling, columns
- Can output: base64, buffer, blob, or auto-download
- **Size:** Large bundle (~500KB+), included via CDN in legacy project

### SVG Generation
- Uses **D3.js** for SVG rendering
- Renders draw structure off-screen (`.hidden_render`)
- Converts SVG to PNG via HTML5 Canvas
- Embeds PNG images in PDF

### Image Handling
- Fetches tournament logos
- Generates QR codes
- Converts all to base64 data URIs for embedding

## Conversion Strategy

### Phase 1: Infrastructure Setup ✅
1. Install pdfMake: `npm install pdfmake`
2. Create `/src/services/pdf/` directory structure
3. Port core utilities (no business logic dependencies)

### Phase 2: Data Model Mapping
Legacy model → Factory model mapping needed:

| Legacy Field | Factory Equivalent | Notes |
|-------------|-------------------|-------|
| `event.draw.opponents` | `matchUps` with `sides` | Complete restructure needed |
| `opponent.seed` | `participant.seeding` | Different structure |
| `opponent.category_ranking` | `participant.rankings` | Array of ranking objects |
| `opponent.entry` | `participant.entries` | Entry type (WC, LL, A) |
| `draw.compass` | `drawDefinition.structures` | Multiple structures |
| `max_round` | Calculated from `matchUps` | Not stored directly |

### Phase 3: Adaptation Priority

**HIGH PRIORITY (Most Useful):**
1. ✅ **Draw Sheet Generator** - Primary use case
   - Generates visual draw brackets
   - Includes seeding, rankings, entry types
   - Footer with tournament info

2. ✅ **Match List Generator** - Scheduling essential
   - List of matches with times
   - Court assignments
   - Player names

**MEDIUM PRIORITY:**
3. **Sign-in Sheets** - Tournament operations
4. **Schedule by Court** - Operations

**LOW PRIORITY:**
5. Dual match sheets (team format specific)
6. Round-robin SVG generation (niche)

## Technical Challenges

### 1. SVG Draw Rendering
**Challenge:** Legacy uses D3-based `treeDraw` component that doesn't exist in modern TMX.

**Solutions:**
- **Option A:** Port the D3 tree draw component (significant work)
- **Option B:** Use existing courthive-components `renderMatchUp` and convert to SVG
- **Option C:** Generate draw as HTML, convert HTML → Canvas → PNG
- **Option D:** Use factory's `drawDefinitionToSVG` if available

**Recommendation:** Option B - leverage existing components

### 2. Image Conversion
**Challenge:** SVG → PNG conversion requires browser APIs (Canvas).

**Current Code:**
```javascript
function svgString2DataURL({ svg_string, images=[], min_height }) {
  return new Promise( (resolve, reject) => {
     var canvas = document.createElement('canvas');
     var imgsrc = 'data:image/svg+xml;base64,'+ btoa( unescape( encodeURIComponent( svg_string ) ) );
     var image = new Image();
     image.onload = function () {
        canvas.width = this.naturalWidth;
        canvas.height = min_height ? Math.max(this.naturalHeight, min_height) : this.naturalHeight;
        canvas.getContext('2d').drawImage(this, 0, 0);
        resolve(canvas.toDataURL('image/png'));
     };
     image.src = imgsrc;
  });
}
```

**Status:** ✅ This is portable - uses standard Web APIs

### 3. pdfMake Bundle Size
**Challenge:** pdfMake is large (~500KB).

**Legacy Approach:**
```javascript
// importing makes the bundle too large
// for the future look into code-splitting to include in PWA
import pdfMake from "pdfmake/build/pdfmake";
```

They load via CDN instead:
```html
<script src="/lib/pdfmake.min.js"></script>
<script src="/lib/vfs_fonts.js"></script>
```

**Modern Solutions:**
1. **Code splitting** - Load pdfMake dynamically when needed
2. **CDN approach** - Keep as external script
3. **Tree shaking** - Use ESM version of pdfMake

**Recommendation:** Dynamic import for code splitting:
```typescript
async function generatePDF(docDefinition) {
  const pdfMake = await import('pdfmake/build/pdfmake');
  const pdfFonts = await import('pdfmake/build/vfs_fonts');
  pdfMake.vfs = pdfFonts.pdfMake.vfs;
  return pdfMake.createPdf(docDefinition);
}
```

## Portable Components

### ✅ Can Port As-Is (Minimal Changes)

1. **svgUtilities.js** - Pure DOM/Canvas utilities
   - `SVGasURI()` - Convert SVG element to PNG data URI
   - `getSVGString()` - Serialize SVG with styles
   - `svgString2DataURL()` - SVG → Canvas → PNG

2. **pdfExport.js** - pdfMake wrapper (just update imports)
   ```typescript
   export function openPDF({ docDefinition }) {
     pdfMake.createPdf(docDefinition).open();
   }
   export function savePDF({ docDefinition, filename }) {
     pdfMake.createPdf(docDefinition).download(filename);
   }
   ```

3. **drawSheetHeader.js** - Page header template
   - Minor updates for factory data model

4. **primitives.js** - Utility functions
   - `fullName()` - Format participant name
   - `localizeDate()` - Date formatting

### ⚠️ Needs Adaptation

1. **drawSheet.js** - Draw sheet layout
   - Update data accessors for factory model
   - Replace `event.draw.opponents` with matchUp traversal
   - Update ranking/seeding field names

2. **pdfDrawGenerator.js** - Main generator
   - Replace `drawInfo()` with factory functions
   - Update opponent/participant mapping
   - Replace D3 tree draw with modern component

3. **matchListGenerator.js** - Match lists
   - Update data model accessors
   - Use factory `matchUpFormat` instead of legacy format

## Minimal Viable Product (MVP) Scope

### Goal: Generate basic draw sheet PDF

**Include:**
1. ✅ pdfMake infrastructure (install, wrapper)
2. ✅ Basic draw sheet template (header + content area)
3. ✅ SVG utilities (for future draw rendering)
4. ⚠️ Simple bracket rendering (text-based, no graphics initially)
5. ✅ Tournament metadata (name, dates, event info)

**Exclude (for now):**
- Complex SVG draw rendering
- Match lists
- Sign-in sheets
- Scheduling features

### MVP Data Requirements

```typescript
interface DrawPDFInput {
  tournament: {
    tournamentName: string;
    startDate: string;
    endDate?: string;
    organizers?: string[];
  };
  event: {
    eventName: string;
    eventType: string; // SINGLES, DOUBLES
    category?: string;
    gender?: string;
  };
  drawDefinition: {
    drawId: string;
    drawName: string;
    structures: Structure[];
  };
  matchUps: MatchUp[];
  participants: Participant[];
}
```

### MVP Output

```
┌─────────────────────────────────────────┐
│  Tournament Logo    Tournament Name     │
│                     Event Name          │
│                     Category            │
├─────────────────────────────────────────┤
│                                         │
│  [Draw Bracket Content Area]            │
│  (Initially: Simple text-based)         │
│  (Future: SVG graphic)                  │
│                                         │
├─────────────────────────────────────────┤
│  Seeded Players        Alternates       │
│  1. Player [rank]      A1. Player [A]   │
│  ...                   ...              │
│                                         │
│  Organizers:           Signature:       │
│  ...                   _____________    │
└─────────────────────────────────────────┘
```

## Files to Port

### Essential (MVP)
```
src/services/pdf/
├── pdfEngine.ts              # NEW: Main entry point
├── export/
│   └── pdfExport.ts          # PORT: pdfExport.js
├── utils/
│   ├── svgUtilities.ts       # PORT: svgUtilities.js
│   ├── primitives.ts         # PORT: primitives.js (name formatting, dates)
│   └── imageUtils.ts         # NEW: Image fetching/conversion
├── templates/
│   └── drawSheet/
│       ├── drawSheetHeader.ts    # PORT: drawSheetHeader.js
│       ├── drawSheetFooter.ts    # PORT: scheduleFooter.js (adapted)
│       └── drawSheetTemplate.ts  # PORT: drawSheet.js
└── generators/
    └── drawGenerator.ts      # PORT: pdfDrawGenerator.js (simplified)
```

### Future Additions
```
src/services/pdf/
├── templates/
│   ├── matchList/
│   ├── schedule/
│   └── signIn/
└── generators/
    ├── matchListGenerator.ts
    └── scheduleGenerator.ts
```

## Implementation Plan

### Step 1: Setup (15 minutes)
```bash
cd /Users/charlesallen/Development/GitHub/CourtHive/TMX
npm install pdfmake
mkdir -p src/services/pdf/{export,utils,templates/drawSheet,generators}
```

### Step 2: Port Utilities (30 minutes)
1. Copy `svgUtilities.js` → `utils/svgUtilities.ts`
   - Convert to TypeScript
   - Add type definitions
   - No business logic changes

2. Copy `primitives.js` → `utils/primitives.ts`
   - Update for factory data model
   - Add types

3. Create `export/pdfExport.ts`
   - Wrap pdfMake with modern async/await
   - Add dynamic import

### Step 3: Scaffold Templates (45 minutes)
1. Port `drawSheetHeader.js`
   - Update tournament data accessors
   - Maintain layout/styling

2. Port `drawSheet.js` (simplified)
   - Remove complex footer initially
   - Focus on header + content area
   - Placeholder for draw content

### Step 4: Create Generator (60 minutes)
1. Scaffold `drawGenerator.ts`
   - Accept factory data model
   - Build docDefinition
   - Initially: text-based draw (no SVG)

### Step 5: Integration (30 minutes)
1. Add menu item or button in TMX
2. Wire up to tournament/draw data
3. Test with sample tournament

### Step 6: Testing & Polish (60 minutes)
1. Test with various draw sizes
2. Handle edge cases
3. Add error handling
4. Document usage

**Total Time Estimate:** 3-4 hours for MVP

## Dependencies to Add

```json
{
  "dependencies": {
    "pdfmake": "^0.2.10"
  }
}
```

**Note:** pdfMake v0.2.x has breaking changes from v0.1.68. Review changelog.

## Code Example: MVP Draw Generator

```typescript
// src/services/pdf/generators/drawGenerator.ts
import type { Tournament, EventData, DrawDefinition } from 'types';

interface DrawPDFConfig {
  tournament: Tournament;
  event: EventData;
  drawDefinition: DrawDefinition;
  matchUps: any[];
  participants: any[];
}

export async function generateDrawPDF(config: DrawPDFConfig): Promise<void> {
  const { tournament, event, drawDefinition } = config;
  
  // Dynamic import to avoid bloating main bundle
  const pdfMake = await import('pdfmake/build/pdfmake');
  const pdfFonts = await import('pdfmake/build/vfs_fonts');
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
  
  const docDefinition = {
    pageSize: 'LETTER',
    pageOrientation: 'portrait',
    pageMargins: [40, 60, 40, 60],
    
    content: [
      // Header
      {
        text: tournament.tournamentName,
        style: 'header',
        alignment: 'center'
      },
      {
        text: event.eventName,
        style: 'subheader',
        alignment: 'center'
      },
      '\n',
      
      // Draw content (placeholder)
      {
        text: 'Draw bracket will be rendered here',
        alignment: 'center',
        italics: true
      },
      '\n',
      
      // Footer with seeded players
      {
        text: 'Seeded Players',
        style: 'sectionHeader'
      },
      {
        text: '1. [Player Name] [Ranking]',
        fontSize: 10
      }
    ],
    
    styles: {
      header: {
        fontSize: 18,
        bold: true
      },
      subheader: {
        fontSize: 14,
        bold: true
      },
      sectionHeader: {
        fontSize: 12,
        bold: true,
        marginTop: 10
      }
    }
  };
  
  const pdf = pdfMake.createPdf(docDefinition);
  pdf.download(`${drawDefinition.drawName || 'draw'}.pdf`);
}
```

## Next Steps

1. **Review & Approve** this assessment
2. **Install pdfMake** in TMX
3. **Port utilities** (svgUtilities, primitives)
4. **Create MVP generator** (simple text-based draw)
5. **Test with sample data**
6. **Iterate** - Add SVG rendering, match lists, etc.

## Questions to Resolve

1. **SVG Rendering:** Use courthive-components or port legacy D3 tree draw?
2. **Bundle Size:** CDN or code-splitting for pdfMake?
3. **Priority:** Draw sheets only, or also match lists in MVP?
4. **Data Source:** Generate from current view or modal selector?

## Conclusion

✅ **Viable:** PDF generation from legacy is portable  
✅ **Architecture:** Well-structured, separates concerns  
✅ **Utilities:** Core SVG/Canvas code is reusable  
⚠️ **Adaptation Needed:** Data model mapping required  
⚠️ **SVG Rendering:** Need strategy for draw bracket graphics  

**Recommendation:** Proceed with MVP - port infrastructure and create simple text-based draw PDF, then iterate to add graphic rendering.

---

**Author:** Droid  
**Status:** Ready for Implementation  
**Estimated Effort:** 3-4 hours (MVP), 8-12 hours (full feature)
