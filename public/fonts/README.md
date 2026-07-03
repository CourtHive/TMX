# PDF fonts (`/fonts/`)

TrueType fonts embedded in generated tournament PDFs. jsPDF's built-in Helvetica
is Latin-1 only, so these cover Central-European (Latin-2) glyphs.

Vite serves everything in `public/` at the site root, so these are available at
`/fonts/…` in dev and in the production build — no server config required.
`src/services/pdf/pdfFont.ts` fetches `/fonts/catalog.json`, then the per-style
`/fonts/<file>.ttf` URLs it lists, base64-encodes them, and caches in IndexedDB.

Fetches go to the **web origin** (never the API/CFS server) — static assets must
not touch the mutation server. In production a CDN/NGINX layer may front `/fonts/`;
these bundled copies are the self-contained fallback and the dev source of truth.

## Contents

- `DejaVuSans.ttf`, `DejaVuSans-Bold.ttf` — DejaVu Sans
- `LiberationSans-Regular.ttf`, `LiberationSans-Bold.ttf` — Liberation Sans
- `catalog.json` — the catalog TMX fetches (`id`, `label`, `languages`, `files`)

## Adding a font

1. Drop `MyFont-Regular.ttf` / `MyFont-Bold.ttf` here.
2. Add an entry to `catalog.json` (`id`, `label`, `languages`, `files`).
3. The id becomes selectable in Settings → Font and as a provider `defaults.defaultPdfFont`.

## Licenses

- **DejaVu Sans** — Bitstream Vera / DejaVu license (permissive, redistributable).
  <https://dejavu-fonts.github.io/License.html>
- **Liberation Sans** — SIL Open Font License 1.1.
  <https://github.com/liberationfonts/liberation-fonts/blob/main/LICENSE>
