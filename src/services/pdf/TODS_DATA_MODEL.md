# TODS Data Model Reference for PDF Generation

**Status:** 🚧 Work in Progress  
**Purpose:** Document the TODS (Tournament Organization Data Structures) data model for adapting legacy PDF generators

## Overview

The legacy TMX-Suite PDF generators were built for an old JSON structure. The current TMX uses the **TODS Competition Factory** format, which has a different structure. This document maps the old structure to the new one.

## Tournament Engine API

### Getting Tournament Data

**Legacy (TMX-Suite-Legacy):**
```javascript
const tournament = tournamentEngine.getTournament()?.tournament;
// Structure: { tournamentName, startDate, endDate, organizers, ... }
```

**TODS (Current TMX):**
```javascript
const tournamentInfo = tournamentEngine.getTournamentInfo()?.tournamentInfo;
// Structure: { tournamentName, startDate, endDate, ... }
```

**Key Differences:**
- Method changed from `getTournament()` to `getTournamentInfo()`
- Result structure: `tournamentInfo` instead of `tournament`
- Some fields renamed or restructured

### Getting Event Data

**Both Legacy and TODS (similar):**
```javascript
const event = tournamentEngine.getEvent({ eventId })?.event;
```

**Event Structure:**
```typescript
{
  eventId: string;
  eventName: string;
  eventType: 'SINGLES' | 'DOUBLES' | 'TEAM';
  category: {
    categoryName?: string;
    ageCategoryCode?: string;
  };
  gender: 'MALE' | 'FEMALE' | 'MIXED';
  startDate: string;
  endDate: string;
  drawDefinitions: DrawDefinition[];
  entries: Entry[];
}
```

### Getting Draw Data

**TODS:**
```javascript
// From event
const drawDefinition = event.drawDefinitions.find(dd => dd.drawId === drawId);

// Or directly
const drawResult = tournamentEngine.findDrawDefinition({ drawId });
const drawDefinition = drawResult?.drawDefinition;
```

## Data Structure Mapping

### Tournament/Event Info

| Legacy Field | TODS Field | Notes |
|-------------|-----------|-------|
| `tournament.tournamentName` | `tournamentInfo.tournamentName` | Same name |
| `tournament.startDate` | `tournamentInfo.startDate` | ISO date string |
| `tournament.endDate` | `tournamentInfo.endDate` | ISO date string |
| `tournament.organizers` | `tournamentInfo.organizers?` | May not exist |
| `event.format` | `event.eventType` | 'S' → 'SINGLES', 'D' → 'DOUBLES' |

### Participant/Player Data

**Legacy Structure:**
```javascript
{
  first: 'John',
  last: 'Doe',
  seed: 1,
  category_ranking: 42,
  entry: 'WC' // or 'LL', 'A'
}
```

**TODS Structure:**
```javascript
{
  participantId: 'uuid',
  participantName: 'John Doe',
  participantType: 'INDIVIDUAL' | 'PAIR' | 'TEAM',
  person: {
    personId: 'uuid',
    standardGivenName: 'John',
    standardFamilyName: 'Doe'
  },
  rankings: [
    {
      rankingType: 'SINGLES',
      ranking: 42,
      rankDate: '2026-01-11'
    }
  ],
  seedings: [
    {
      seedNumber: 1,
      seedValue: 1
    }
  ],
  entries: [
    {
      entryStage: 'QUALIFYING' | 'MAIN',
      entryStatus: 'DIRECT_ACCEPTANCE' | 'WILDCARD' | 'LUCKY_LOSER' | 'ALTERNATE'
    }
  ]
}
```

**Mapping:**
| Legacy | TODS | Access Method |
|--------|------|---------------|
| `first + ' ' + last` | `participantName` | Direct |
| `first` | `person.standardGivenName` | Nested |
| `last` | `person.standardFamilyName` | Nested |
| `seed` | `seedings[0].seedNumber` | Array |
| `category_ranking` | `rankings[0].ranking` | Array |
| `entry` | `entries[0].entryStatus` | Array, enum |

### Draw Structure

**Legacy:**
```javascript
{
  draw_positions: number[],
  draw_type: 'tree' | 'round-robin',
  max_round: number,
  opponents: Opponent[][],  // Array of pairs/teams
  compass: 'east' | 'west' | ...  // For compass draws
}
```

**TODS:**
```javascript
{
  drawId: string,
  drawName: string,
  drawSize: number,
  structures: [
    {
      structureId: string,
      structureName: string,
      stage: 'QUALIFYING' | 'MAIN' | 'CONSOLATION',
      structureType: 'SINGLE_ELIMINATION' | 'ROUND_ROBIN' | 'COMPASS',
      matchUps: MatchUp[]
    }
  ],
  entries: Entry[]
}
```

**Key Changes:**
- `opponents` array → Derive from `matchUps` with `sides`
- `draw_positions` → `drawSize` (single number)
- `compass` → Multiple `structures` with different `stage`
- No direct `max_round` → Calculate from matchUps

### MatchUp Structure

**TODS MatchUp:**
```javascript
{
  matchUpId: string,
  matchUpType: 'SINGLES' | 'DOUBLES',
  sides: [
    {
      sideNumber: 1,
      participantId: string,
      participant: Participant,
      scoreString: '6-3',
      score: {
        sets: [
          {
            setNumber: 1,
            side1Score: 6,
            side2Score: 3,
            winningSide: 1
          }
        ]
      }
    },
    {
      sideNumber: 2,
      participantId: string,
      participant: Participant,
      scoreString: '3-6',
      score: { ... }
    }
  ],
  winningSide: 1,
  matchUpStatus: 'COMPLETED' | 'IN_PROGRESS' | 'TO_BE_PLAYED',
  roundNumber: 1,
  roundPosition: 1,
  drawPositions: [1, 2]
}
```

## Helper Functions for Migration

### Extracting Participants from Draw

```typescript
function getDrawParticipants(drawDefinition: any): Participant[] {
  // Get all matchUps from all structures
  const allMatchUps = drawDefinition.structures.flatMap(
    (structure: any) => structure.matchUps || []
  );
  
  // Extract unique participants
  const participantMap = new Map();
  allMatchUps.forEach((matchUp: any) => {
    matchUp.sides?.forEach((side: any) => {
      if (side.participant && side.participantId) {
        participantMap.set(side.participantId, side.participant);
      }
    });
  });
  
  return Array.from(participantMap.values());
}
```

### Getting Seeded Participants

```typescript
function getSeededParticipants(drawDefinition: any): Participant[] {
  const participants = getDrawParticipants(drawDefinition);
  
  return participants
    .filter(p => p.seedings && p.seedings.length > 0)
    .sort((a, b) => {
      const seedA = a.seedings[0]?.seedNumber || 999;
      const seedB = b.seedings[0]?.seedNumber || 999;
      return seedA - seedB;
    });
}
```

### Formatting Participant Name

```typescript
function fullName(participant: any): string {
  // Try participantName first (already formatted)
  if (participant.participantName) {
    return participant.participantName;
  }
  
  // Try person structure
  if (participant.person) {
    const given = participant.person.standardGivenName || '';
    const family = participant.person.standardFamilyName || '';
    return `${given} ${family}`.trim();
  }
  
  // Legacy fallback
  if (participant.first || participant.last) {
    return `${participant.first || ''} ${participant.last || ''}`.trim();
  }
  
  return '';
}
```

### Getting Entry Status Display

```typescript
function getEntryStatusCode(participant: any): string {
  if (!participant.entries || participant.entries.length === 0) {
    return '';
  }
  
  const entry = participant.entries[0];
  
  // Map TODS entryStatus to legacy codes
  const statusMap: Record<string, string> = {
    'WILDCARD': 'WC',
    'LUCKY_LOSER': 'LL',
    'ALTERNATE': 'A',
    'DIRECT_ACCEPTANCE': '', // No special code
    'QUALIFIER': 'Q',
  };
  
  return statusMap[entry.entryStatus] || '';
}
```

## Migration Checklist

When adapting a legacy PDF generator:

- [ ] Update `getTournament()` → `getTournamentInfo()`
- [ ] Change `tournament.field` → `tournamentInfo.field`
- [ ] Update participant access:
  - [ ] `opponent` → `participant`
  - [ ] `first/last` → `person.standardGivenName/standardFamilyName`
  - [ ] `seed` → `seedings[0].seedNumber`
  - [ ] `category_ranking` → `rankings[0].ranking`
  - [ ] `entry` → `entries[0].entryStatus` with mapping
- [ ] Update draw structure access:
  - [ ] `draw.opponents` → Extract from `matchUps.sides`
  - [ ] `draw_type` → `structure.structureType`
  - [ ] Calculate rounds from matchUps, not `max_round`
- [ ] Test with:
  - [ ] Different draw sizes (8, 16, 32, 64)
  - [ ] With and without seeding
  - [ ] With special entries (WC, LL, A)
  - [ ] Consolation/qualifying draws
  - [ ] Round-robin formats

## Factory Methods Reference

Useful methods from `tournamentEngine`:

```typescript
// Tournament info
tournamentEngine.getTournamentInfo()
  → { tournamentInfo: { tournamentName, startDate, ... } }

// Event info
tournamentEngine.getEvent({ eventId })
  → { event: { eventName, eventType, drawDefinitions, ... } }

// Draw definition
tournamentEngine.findDrawDefinition({ drawId })
  → { drawDefinition: { structures, entries, ... } }

// All matchUps for a draw
tournamentEngine.allDrawMatchUps({ drawId })
  → { matchUps: MatchUp[] }

// Participants
tournamentEngine.getParticipants({ participantFilters: { participantIds } })
  → { participants: Participant[] }
```

## Example: Updated Draw Sheet Header

**Legacy:**
```javascript
const header = {
  text: tournament.tournamentName,
  style: 'header'
};
```

**TODS:**
```javascript
const tournamentInfo = tournamentEngine.getTournamentInfo()?.tournamentInfo;
const header = {
  text: tournamentInfo?.tournamentName || event.eventName || 'Tournament',
  style: 'header'
};
```

## Resources

- [Competition Factory Documentation](https://github.com/CourtHive/tods-competition-factory)
- [TODS Data Model Spec](https://itftennis.atlassian.net/wiki/spaces/TODS)
- TMX-Suite-Legacy: `/src/engineFactory/pdfEngine/` (reference only)

---

**Last Updated:** 2026-01-11  
**Status:** Living document - update as we discover more mappings
