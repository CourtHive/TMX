# morphdom Draw Rendering

**Status:** Production-ready
**Source:** `src/pages/tournament/tabs/eventsTab/renderDraws/renderDrawView.ts`

## Overview

The draw view uses [morphdom](https://github.com/patrick-steele-idem/morphdom) (v2.7.8) to efficiently patch the DOM when draw structures are re-rendered. Rather than replacing the entire draw HTML on each update, morphdom diffs the old and new DOM trees and applies the minimum set of mutations. This preserves CSS transitions, scroll positions, and interactive state.

morphdom is invoked only for the main draw structure view. Alternative views (rounds table, stats table, bracket table) and the participant assignment mode use direct DOM manipulation instead.

## How It Works

### Rendering Pipeline

```
tournamentEngine.getEventData()
        │
        ▼
  structure.roundMatchUps  ──►  (optional participant filter)
        │
        ▼
  renderStructure()        ──►  courthive-components generates new DOM tree
        │
        ▼
  renderContainer()        ──►  wraps with theme
        │
        ▼
  morphdom(oldTree, newTree, options)
```

1. **`renderStructure()`** from `courthive-components` generates a full DOM element for the draw
2. **`renderContainer()`** wraps it with the active composition theme
3. **`morphdom()`** patches the existing DOM to match the new element

### Element Keying Strategy

morphdom matches elements between the old and new trees using a **node key**. By default it uses the `id` attribute. The draw view provides a custom `getNodeKey` callback to handle participant elements correctly:

```typescript
morphdom(targetNode, content, {
  getNodeKey(node) {
    // Participant elements use positional matching (no key)
    if (isParticipantEl(node)) return undefined;

    const id = node.getAttribute?.('id');
    if (id && id !== 'undefined' && id !== '') return id;
    return undefined;
  },
});
```

**Keyed elements** (matched by ID across the tree):
- Matchup containers (`tmx-m`) — keyed by `matchUpId`
- Round columns, score elements, schedule elements

**Positionally matched elements** (no key):
- Participant wrappers (`tmx-p`) — keyed by draw position, not participant
- Participant info (`tmx-i`) — inner content that changes on assignment

**Excluded from keying** (invalid IDs):
- Elements with `id=""` (empty string) — e.g. TBD/unassigned slots
- Elements with `id="undefined"` (literal string) — artifact of no participant

### Why Participant Elements Are Not Keyed

The `courthive-components` library assigns the **participant UUID** as the `id` attribute on both the outer `tmx-p` wrapper and the inner `tmx-i` info element:

```
c-jndkwo  (participant container, no id)
  └─ tmx-p  id="<participantId>"    ← outer wrapper
       └─ c-PJLV
            └─ tmx-i  id="<participantId>"  ← inner info (SAME id)
```

This creates two problems for morphdom's default ID-based keying:

1. **Duplicate keys** — When `indexTree` builds its lookup, the inner `tmx-i` overwrites the outer `tmx-p` for the same key. This means deferred removal targets the wrong element.

2. **Unstable keys** — Participant IDs change when participants are assigned to or removed from draw positions. The draw *position* is stable; the *participant* occupying it is not. Keying by participant ID causes morphdom to treat assignment changes as element additions/removals rather than in-place updates.

By returning `undefined` for these elements, morphdom falls back to **positional matching** within their parent container. Since each side of a matchup has exactly one participant slot, positional matching is correct and stable.

## Draw DOM Structure

```
draw-container
  └─ round-column
       └─ matchup  (tmx-m, id=matchUpId)      ← KEYED
            ├─ side 1  (tmx-sd, sidenumber=1)
            │    ├─ schedule info  (tmx-sch)
            │    └─ participant container  (c-jndkwo)
            │         └─ tmx-p  (id=participantId)  ← POSITIONAL
            │              └─ tmx-i  (id=participantId)  ← POSITIONAL
            └─ side 2  (tmx-sd, sidenumber=2)
                 └─ participant container  (c-jndkwo)
                      └─ tmx-p  (id=participantId)  ← POSITIONAL
                           └─ tmx-i  (id=participantId)  ← POSITIONAL
```

## When morphdom Is Bypassed

morphdom is only used for incremental updates. A full `removeAllChildNodes` + fresh render happens when:

- **`redraw=true`** — Explicit full redraw requested (e.g. after structural changes)
- **Participant filter changes** — The filter modifies which matchups are shown, so the tree shape changes significantly
- **Initial render** — No existing DOM to diff against; content is appended directly
- **Dual match (team)** — Single-matchup team events render a scorecard instead
- **Assignment mode** — Uses `participantAssignmentMode.ts` with `DrawStateManager`

## Historical Context

### Previous Approach (addChild workaround)

Before the `getNodeKey` fix, the code used a custom `addChild` callback with five conditional branches that attempted to detect and remove stale participant elements during morphdom's child-addition phase. This was necessary because morphdom's default keying caused participant elements to be mismatched.

The `addChild` approach had a gap: when a participant was removed, the new TBD element had `id=""` (empty string). The empty string passed the "has valid ID" check (it is not `null`, `"undefined"`, or `undefined`) but failed the truthiness check in the replacement condition, causing the old element to remain while the new one was appended alongside it. This resulted in:

- Duplicated draw positions (old empty shell + new TBD element)
- Wider-than-expected rows
- TBD text appearing mid-row instead of replacing the participant name

### Current Approach (getNodeKey)

The `getNodeKey` callback addresses the root cause rather than the symptom. By excluding participant elements from ID-based matching entirely, morphdom correctly morphs them in-place regardless of how participant IDs change.

## Related Files

| File | Purpose |
|------|---------|
| `renderDrawView.ts` | morphdom integration, draw rendering orchestration |
| `participantAssignmentMode.ts` | Alternative rendering path for assignment mode (no morphdom) |
| `getEventHandlers.ts` | Click/interaction handlers passed to `renderStructure()` |
| `courthive-components` | External library providing `renderStructure()` and `renderContainer()` |

## Key Dependencies

- **morphdom** `2.7.8` — DOM diffing library
- **courthive-components** `0.9.27` — Draw structure rendering

---

**Last Updated:** 2026-02-22
