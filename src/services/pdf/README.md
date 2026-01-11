# PDF Generation Services

**Status:** 🚧 In Development  
**Source:** Ported from TMX-Suite-Legacy  
**Library:** pdfMake v0.3.2

## Overview

PDF generation services for creating tournament documents including draw sheets, match lists, schedules, and sign-in sheets.

## Architecture

```
src/services/pdf/
├── export/              # PDF output functions (open/save/download)
├── utils/              # Utilities (SVG conversion, formatting)
├── templates/          # Document templates
├── generators/         # Document generators
└── README.md          # This file
```

## Core Utilities

### pdfExport.ts
Functions for outputting PDFs:
- `openPDF()` - Open PDF in new tab
- `savePDF()` - Download PDF file
- `getPDFBase64()` - Get PDF as base64 string
- `getPDFBlob()` - Get PDF as Blob
- `emitPDF()` - Send PDF to callback/server

**Features:**
- ✅ Dynamic import (code-splitting)
- ✅ Async/await API
- ✅ TypeScript support

### svgUtilities.ts
SVG to PNG conversion for embedding graphics in PDFs:
- `SVGasURI()` - Convert SVG element to PNG data URI
- `saveSVGasPNG()` - Save SVG as PNG file

**Process:**
1. Serialize SVG with embedded styles
2. Create off-screen canvas
3. Draw SVG as image on canvas
4. Convert canvas to PNG data URI
5. Embed in PDF

### primitives.ts
Common formatting functions:
- `fullName()` - Format participant names
- `localizeDate()` - Localize dates
- `formatDate()` - Format dates as YYYY-MM-DD
- `getRankingDisplay()` - Get ranking string
- `getSeedingDisplay()` - Get seeding string
- `getEntryDisplay()` - Get entry type (WC/LL/A)
- `nameWithRanking()` - Format "Name [Rank]"
- `nameWithEntry()` - Format "Name [WC]"

## Usage Examples

### Basic PDF Generation

```typescript
import { savePDF } from 'services/pdf/export/pdfExport';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

async function generateSamplePDF() {
  const docDefinition: TDocumentDefinitions = {
    content: [
      { text: 'Tournament Draw', style: 'header' },
      { text: 'Event Name', style: 'subheader' },
      '\n',
      'Draw content here...'
    ],
    styles: {
      header: { fontSize: 18, bold: true },
      subheader: { fontSize: 14, bold: true }
    }
  };

  await savePDF({ 
    docDefinition, 
    filename: 'draw.pdf' 
  });
}
```

### SVG to PNG Conversion

```typescript
import { SVGasURI } from 'services/pdf/utils/svgUtilities';

async function convertDrawToImage() {
  const svgElement = document.querySelector('#draw-container svg');
  
  if (svgElement) {
    const pngDataURI = await SVGasURI(
      svgElement as HTMLElement,
      [], // optional overlay images
      800 // min height in pixels
    );
    
    // Use in PDF docDefinition
    const docDefinition = {
      content: [
        { image: pngDataURI, width: 500 }
      ]
    };
  }
}
```

### Formatting Utilities

```typescript
import { fullName, nameWithRanking, formatDate } from 'services/pdf/utils/primitives';

const participant = {
  person: {
    standardGivenName: 'John',
    standardFamilyName: 'Doe'
  },
  rankings: [{ ranking: 42 }]
};

fullName(participant);           // "John Doe"
nameWithRanking(participant);    // "John Doe [42]"
formatDate(new Date());          // "2026-01-11"
```

## Current Status

### ✅ Completed
- [x] PDF export infrastructure (open/save/base64/blob)
- [x] SVG to PNG conversion utilities
- [x] Formatting primitives (names, dates, rankings)
- [x] TypeScript types and interfaces
- [x] Dynamic import for code-splitting

### 🚧 In Progress
- [ ] Draw sheet template
- [ ] Draw sheet generator
- [ ] Integration with tournament data

### 📋 Planned
- [ ] Match list generator
- [ ] Schedule generator
- [ ] Sign-in sheet generator
- [ ] Round-robin draw support

## Data Model Notes

### Factory vs Legacy Mapping

| Legacy Field | Factory Equivalent | Notes |
|-------------|-------------------|-------|
| `opponent` | `participant` | Renamed |
| `opponent.seed` | `participant.seedings[0].seedNumber` | Array structure |
| `opponent.category_ranking` | `participant.rankings[0].ranking` | Array structure |
| `opponent.entry` | `participant.entries[0].entryStage` | Array structure |
| `opponent.first/last` | `participant.person.standardGivenName/standardFamilyName` | Nested structure |
| `event.draw.opponents` | Derived from `matchUps` | Different structure |

### Participant Structure

**Factory Model:**
```typescript
{
  participantId: string;
  participantName: string;
  person?: {
    standardGivenName: string;
    standardFamilyName: string;
  };
  rankings?: Array<{ ranking: number }>;
  seedings?: Array<{ seedNumber: number }>;
  entries?: Array<{ entryStage: string }>;
}
```

## Dependencies

```json
{
  "pdfmake": "0.3.2"
}
```

**Bundle Size:** ~500KB (loaded dynamically)

## Development

### Adding a New Template

1. Create template file in `templates/[name]/`
2. Export template function that returns docDefinition
3. Create generator in `generators/` that:
   - Accepts factory data model
   - Maps to template format
   - Returns docDefinition

Example structure:
```typescript
// templates/matchList/matchListTemplate.ts
export function matchListTemplate({ matches, event }) {
  return {
    content: [
      // template content
    ],
    styles: {
      // styles
    }
  };
}

// generators/matchListGenerator.ts
export async function generateMatchListPDF({ tournament, event, matchUps }) {
  // Map factory data to template format
  const matches = matchUps.map(m => ({
    // transform matchUp to legacy format
  }));
  
  const docDefinition = matchListTemplate({ matches, event });
  
  await savePDF({ docDefinition, filename: 'match-list.pdf' });
}
```

### Testing

Test PDF generation in development:
1. Create sample tournament/draw data
2. Call generator function
3. Check PDF output

**Note:** SVG conversion requires DOM, so testing must be in browser or with jsdom.

## Performance

### Code Splitting
pdfMake is ~500KB. We use dynamic imports to load only when needed:

```typescript
// Only loaded when PDF is generated
const pdfMake = await import('pdfmake/build/pdfmake');
```

### SVG Conversion
Converting large SVG draws to PNG can be slow:
- Small draws (8-16 players): ~100ms
- Medium draws (32-64 players): ~500ms
- Large draws (128+ players): ~2s

Consider showing loading indicator during generation.

## Future Enhancements

1. **Server-side rendering** - Generate PDFs on server for email/storage
2. **Batch generation** - Generate multiple PDFs at once
3. **Custom templates** - Allow users to customize PDF layouts
4. **Preview mode** - Show PDF preview before download
5. **Print optimization** - Optimize for specific paper sizes/printers

## References

- [pdfMake Documentation](http://pdfmake.org/)
- [pdfMake Playground](http://pdfmake.org/playground.html)
- TMX-Suite-Legacy: `/src/engineFactory/pdfEngine/`

## Questions/Issues

For questions or issues with PDF generation, check:
1. Browser console for errors
2. pdfMake documentation for docDefinition format
3. SVG serialization issues (CORS, external resources)

---

**Author:** Ported by Droid from TMX-Suite-Legacy  
**Last Updated:** 2026-01-11  
**Version:** 0.1.0 (MVP)
