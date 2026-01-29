# TMX

Tournament Management exTreme, or, because it works with data standards (**[TODS](https://itftennis.atlassian.net/wiki/spaces/TODS/overview)**) and an ethos of collaborative development: **eXtensible Tournament Manager**.

## Overview

TMX is a Progressive Web App for tennis tournament management built on the TODS data standard and powered by the Competition Factory.

### Key Features

- ✅ TODS-compliant tournament data management
- ✅ Draw generation and management
- ✅ Real-time score entry with multiple input approaches
- ✅ Entry management with Singles/Doubles support
- ✅ PDF generation for draws, schedules, and sign-in sheets
- ✅ Google Sheets integration for player imports
- ✅ Offline-capable PWA

## [Online Demo](https://courthive.github.io/TMX)

Try TMX in your browser - import players from Google Sheets or TODS tournament files.

## Getting Started

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build
```

## Technology Stack

- **Data Standard:** TODS (Tennis Open Data Standards)
- **Business Logic:** tods-competition-factory (npm package)
- **UI Components:** courthive-components (shared library)
- **PDF Generation:** pdfMake
- **Build:** Vite
- **Framework:** Vanilla TypeScript

## Related Projects

- **[Competition Factory](https://github.com/CourtHive/tods-competition-factory)** - Business rules and data validation
- **[courthive-components](https://github.com/CourtHive/courthive-components)** - Shared UI components
- **[TODS Specification](https://itftennis.atlassian.net/wiki/spaces/TODS/overview)** - Tennis data standard

## License

See LICENSE file for details.

## Archive

Historical documentation has been moved to `docs/archive/` for reference.
