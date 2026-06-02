# PDF Generation Services

Thin TMX-side wrapper around [`pdf-factory`](https://github.com/CourtHive/pdf-factory). pdf-factory owns the heavy lifting (draw sheets, schedules, fact sheets, parsing) — this directory configures it for TMX and exposes a few app-level helpers.

## What lives here

```
src/services/pdf/
├── pdfFont.ts           # Resolve the active PDF font, install it as pdf-factory's default
├── pdfFont.test.ts      # Vitest specs for font resolution
├── export/
│   └── pdfExport.ts     # Open / save / download / emit helpers around pdf-factory output
├── generators/
│   └── drawGenerator.ts # Draw-sheet generator (wraps pdf-factory's draw generator)
└── README.md            # This file
```

## Adding a generator

If pdf-factory already ships the generator (draw sheets, schedules, fact sheets, sign-in sheets, court cards), wire it up in `generators/` — don't reimplement. New canonical generators belong in pdf-factory itself so other consumers (pdf-factory's own consumers, future server-side rendering) inherit them automatically.

This dir is for TMX-specific composition: font choice, export semantics (open vs save vs emit-to-server), and any TMX data-shape adaptation that doesn't belong upstream.

## Related

- [`pdf-factory`](https://github.com/CourtHive/pdf-factory) — the underlying generator + parser library
- [`TODS_DATA_MODEL.md`](./TODS_DATA_MODEL.md) — TODS field-name reference used when mapping tournament data into generator inputs
