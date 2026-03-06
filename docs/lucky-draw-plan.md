# Lucky Draw UI Plan

## Background

The Lucky Draw is an elimination draw format that supports any number of participants without requiring power-of-2 draw sizes. Instead of filling empty positions with byes, a Lucky Draw allows all participants to play in the first round. When a round produces an odd number of winners, one loser from that round is "lucky" and advances to the next round. The determination of which loser advances can be random or based on the narrowest margin of defeat.

Key properties:
- At most one bye (when participant count is odd)
- Rounds have non-power-of-2 matchUp counts (e.g. 11-6-3-2-1 for 22 participants)
- Rounds are **independent** -- there are no bracket connector lines between rounds
- One loser per "lucky round" is selected to advance
- Supports consolation/playoff structures (back draws simply have one fewer match in lucky rounds)

## Current State

### Factory (`tods-competition-factory`)

The factory fully supports lucky draw generation:

- **Generation**: `luckyDraw.ts` generates matchUps for any draw size via `luckyRoundProfiles()`, which calculates round-by-round participant counts with `feedRound` and `preFeedRound` flags
- **Draw type constant**: `LUCKY_DRAW` in `drawDefinitionConstants.ts`
- **Detection**: `isLucky.ts` and `getRoundMatchUps()` identify lucky structures via `roundsNotPowerOf2` (any round with non-power-of-2 matchUp count)
- **Positioning**: Lucky draws skip standard seed block positioning (`automatedPositioning.ts` line 180)
- **Lucky losers**: Existing `luckyLoserDrawPositionAssignment` handles positioning lucky losers into draw positions, but this is the traditional "lucky loser from qualifying" mechanism, not the lucky-round advancement within a lucky draw

### courthive-components

The rendering layer supports the `isLucky` flag, but had a critical bug preventing detection:

- **`renderStructure.ts`**: Was destructuring `hasOddMatchUpsCount` and `isNotEliminationStructure` from `tournamentEngine.getRoundMatchUps()`, but the factory returns `roundsNotPowerOf2` and `hasNoRoundPositions` instead. **This property name mismatch meant `isLucky` was always `false`.**
- **Fix applied**: Changed to use `roundsNotPowerOf2` and `hasNoRoundPositions` (the actual factory return values) in both `renderStructure.ts` and `renderSchematicStructure.ts`
- **`renderMatchUp.ts`**: When `isLucky=true`, the connector link type becomes `'mr'` (no-link), completely suppressing bracket connector lines between rounds
- **CSS**: `.chc-link--no-link` sets `height: 0; width: 0; border-width: 0` on `::before`/`::after` pseudo-elements
- **Storybook**: `round.stories.ts` has a `Lucky` story demonstrating a round with `isLucky: true` and no connecting lines (this worked because it passed `isLucky` directly, bypassing the broken detection)
- **Structure story**: `structure.stories.ts` does NOT have a Lucky story -- one should be added

### TMX Client

TMX currently:
- Lists "Lucky" as a draw type option in the add-draw form (`getDrawTypeOptions.ts` line 71)
- Generates lucky draws via the standard `generateDraw.ts` -> factory pipeline
- Renders lucky draws through `renderDrawView.ts` -> `renderStructure()`, which auto-detects `isLucky` and removes connector lines

**What's missing**: TMX has no UI for the core lucky draw mechanic -- selecting which loser advances ("is lucky") between rounds. The rounds display without connector lines, but there is no mechanism for:
1. Viewing which losers are eligible to advance
2. Selecting a lucky loser for the next round
3. Indicating the basis for selection (random, narrowest margin, cross-round aggregate)
4. Showing "lucky" status on advanced participants

## Design: Lucky Draw Advancement UI

### Core Interaction Flow

After a lucky round completes (all matchUps in the round have results), the tournament director needs to:

1. **See** which round requires a lucky loser selection
2. **Review** the eligible losers and their match results/margins
3. **Select** (or auto-select) which loser advances
4. **Position** the lucky participant into the next round

### Round-Based Layout

Since lucky draws have no connecting lines, each round is visually independent. This is the right presentation -- rounds are self-contained columns of matchUps. The UI should lean into this by treating each round as a discrete step in the tournament flow.

**Round header enhancement**: Each round column header should display:
- Round name/number
- Round status (in progress, complete, awaiting lucky selection)
- MatchUp count (e.g., "6 matches")
- For lucky rounds: an indicator that one loser will advance

### Lucky Selection Panel

When a lucky round completes and a loser needs to advance, the UI should present a **lucky selection panel** between the completed round and the next round. This could be:

**Option A: Inline panel between round columns**
- A narrow column appears between Round N (completed) and Round N+1 (pending)
- Lists eligible losers ranked by margin of defeat (narrowest first)
- Shows match score for context
- TD clicks to select, or uses "Auto (narrowest margin)" / "Auto (random)" buttons
- Once selected, the participant flows into the next round's empty position

**Option B: Modal/drawer triggered from round header**
- Round header shows a "Select Lucky Loser" button when round is complete
- Opens a drawer/modal with the eligible losers table
- Selection triggers the position assignment

**Recommendation: Option A** -- it preserves the spatial relationship between rounds and makes the flow visible at a glance. The panel occupies the space where connector lines would normally be.

### Lucky Selection Panel Contents

| Element | Description |
|---------|-------------|
| Header | "Lucky Round N" or "Select Advancing Loser" |
| Loser list | Table/list of Round N losers, sorted by margin |
| Margin display | Score + calculated margin for each loser |
| Selection mode | Toggle: "Narrowest Margin" / "Random" / "Manual" |
| Auto-select button | Applies the selected mode automatically |
| Selected indicator | Highlight/badge on the chosen participant |
| Confirm button | Positions the selected loser into Round N+1 |

### Margin Calculation

The "margin" is the key metric for determining luck. Possible approaches:
- **Set-based**: Number of sets won vs lost (e.g., losing 4-6 6-4 5-7 has a narrower margin than 2-6 3-6)
- **Game-based**: Total games won minus games lost across all sets
- **Point-based**: If point-by-point data is available, total points differential
- **Timed format**: If using timed sets, point differential across all sets

The factory should provide a `calculateMatchMargin()` utility that returns a comparable numeric value. For cross-round consideration (as described in the article), the accumulated margin across all matches played could determine advancement.

### Visual Indicators

- **Lucky participant badge**: Participants who advanced via lucky selection should display a small "L" or lucky clover badge in subsequent rounds (similar to how "Q" is shown for qualifiers or "WC" for wildcards)
- **Entry status**: The factory already supports entry statuses like `LUCKY_LOSER`. Lucky draw advancement should set a similar status or extension on the participant's draw position
- **Color coding**: The burst chart already uses yellow-orange for lucky losers -- this color scheme should carry into the draw view

### Factory Changes Needed

1. **Match margin calculation**: Add a `calculateMatchMargin(matchUp)` query that returns a numeric margin value based on the scoring format
2. **Lucky round detection**: Add a query that identifies which rounds in a lucky draw are "lucky rounds" (where one loser must advance) and whether all matchUps in that round are complete
3. **Lucky advancement mutation**: A new mutation (or extension of `luckyLoserDrawPositionAssignment`) that:
   - Accepts the lucky draw's structureId, the source round number, and either a participantId or selection mode (random/narrowest)
   - Validates the round is complete
   - Positions the selected loser into the next round
   - Records the selection basis (margin, random) as an extension
4. **Entry status tracking**: Mark lucky-advanced participants with an appropriate entry status or extension so the UI can display the badge

### TMX Changes Needed

1. **Lucky selection panel component**: New UI component rendered between round columns when a lucky round is complete
2. **Round header enhancement**: Show lucky round status in the round header
3. **Lucky badge rendering**: Display "L" badge on participants who advanced via lucky selection
4. **Draw control bar**: May need a "Lucky Draw Mode" toggle or settings for default selection mode
5. **Mutation integration**: Wire up the lucky selection to `mutationRequest()` with appropriate factory methods

### courthive-components Changes Needed

1. **Structure story**: Add a `Lucky` story to `structure.stories.ts` with `drawType: 'LUCKY_DRAW'` to demonstrate the full lucky draw composition (currently only round-level story exists)
2. **Lucky badge**: Support rendering a "lucky" entry status badge on participant sides (similar to seed display)
3. **Inter-round panel slot**: The `renderStructure` function may need to support inserting custom elements between round columns for the lucky selection panel

### Consolation / Playoff Considerations

Per the article, lucky draws support consolation and playoff structures. When one loser advances as "lucky", the consolation draw for that round has one fewer participant. This is already structurally supported by the factory's `MULTI_STRUCTURE_DRAWS` designation for `LUCKY_DRAW`, but the UI needs to:
- Show the consolation structure alongside the main draw
- Reflect that lucky rounds feed one fewer participant into consolation
- Update consolation positioning when the lucky selection is made

### Configuration Options

The lucky draw system should be configurable per tournament or per draw:
- **Selection mode default**: Random vs narrowest margin vs manual
- **"Once lucky" rule**: Whether a participant can be lucky more than once (per the article)
- **Cross-round margin**: Whether margin calculation considers only the current round's match or accumulates across all matches played
- **Feed-in vs rebalance**: Whether lucky participants feed in to avoid re-matching, or are used to rebalance seeding (per the article)

These could be stored as draw extensions or as part of a `luckyDrawPolicy` in the factory's policy framework.

## Implementation Phases

### Phase 1: Factory Foundation
- Add `calculateMatchMargin()` query
- Add lucky round status query (which rounds need selection, are complete, etc.)
- Add lucky advancement mutation
- Add lucky draw policy support

### Phase 2: Component Layer
- Add `Lucky` structure story to courthive-components
- Add lucky badge to participant rendering
- Add inter-round panel slot to `renderStructure`

### Phase 3: TMX Integration
- Build lucky selection panel component
- Enhance round headers for lucky round status
- Wire mutations for lucky advancement
- Add configuration UI for lucky draw options

### Phase 4: Consolation & Advanced Features
- Consolation structure integration with lucky draws
- Cross-round margin accumulation
- "Once lucky" rule enforcement
- Feed-in vs rebalance positioning options

## File References

| File | Purpose |
|------|---------|
| `factory/src/assemblies/generators/drawDefinitions/drawTypes/luckyDraw.ts` | Lucky draw generation |
| `factory/src/query/drawDefinition/isLucky.ts` | Lucky draw detection |
| `factory/src/query/matchUps/getRoundMatchUps.ts` | Round profile with feedRound/preFeedRound flags |
| `factory/src/mutate/matchUps/drawPositions/positionLuckyLoser.ts` | Current lucky loser positioning (qualifying context) |
| `factory/src/constants/drawDefinitionConstants.ts` | `LUCKY_DRAW` constant |
| `courthive-components/src/components/renderStructure/renderStructure.ts` | Structure rendering, `isLucky` detection |
| `courthive-components/src/components/renderStructure/renderMatchUp.ts` | MatchUp rendering, no-link for lucky |
| `courthive-components/src/stories/round.stories.ts` | Lucky round story |
| `courthive-components/src/stories/structure.stories.ts` | Needs Lucky structure story |
| `TMX/src/components/drawers/addDraw/getDrawTypeOptions.ts` | Lucky draw type option |
| `TMX/src/pages/tournament/tabs/eventsTab/renderDraws/renderDrawView.ts` | Draw rendering entry point |
