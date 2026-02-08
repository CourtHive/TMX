# Participant Assignment Mode Restrictions

## Critical Implementation Details

### Stage and StageSequence Restriction

**IMPORTANT**: Participant assignment mode can **ONLY** be used for draw structures with:

```typescript
{ stage: 'MAIN', stageSequence: 1 }
```

#### Reason

Allowing assignment in other structures (qualifying, playoffs, consolation) would cause propagation issues in the tournament structure. The factory's draw advancement logic depends on proper stage sequencing.

#### Implementation

In `getActionOptions.ts`:

```typescript
// Only allow participant assignment for MAIN stage with stageSequence 1
const isMainStage = structure?.stage === MAIN && structure?.stageSequence === 1;

const options = [
  {
    // Only show for MAIN stage with stageSequence 1
    hide: !isMainStage || blockAssignment || eventData.eventInfo.eventType === TEAM,
    onClick: () => enterParticipantAssignmentMode({ drawId, eventId, structureId }),
    label: 'Assign participants',
    close: true,
  },
  // ...
];
```

### Other Restrictions

1. **TEAM Events**: Disabled entirely (different assignment mechanism)
2. **Scores Present**: Only blocked if `scoringPolicy.requireParticipantsForScoring === true`
3. **Qualifying Structures**: Cannot use assignment mode (not MAIN stage 1)
4. **Playoff Structures**: Cannot use assignment mode (stageSequence !== 1)

## Qualifier Assignment Research

### Factory Support

The factory's `assignDrawPosition` function signature includes a `qualifier` parameter:

```typescript
declare function assignDrawPosition({
  tournamentRecord,
  drawDefinition,
  participantId,
  drawPosition,
  structureId,
  qualifier,  // ← This parameter exists!
  event,
  bye,
}: { ... }): any;
```

### Current Status

- The `qualifier` parameter exists in the factory method
- Need to investigate if it's fully implemented or marked as `NOT_IMPLEMENTED`
- Would allow assigning qualifier placeholders to draw positions in MAIN stage
- Qualifiers would be resolved when qualifying structure completes

### Potential Enhancement

If qualifier assignment is implemented in the factory:

1. Check if draw has qualifying structure feeding into current structure
2. Add "— QUALIFIER —" option to typeahead (similar to "— BYE —")
3. Use `tournamentEngine.assignDrawPosition({ drawPosition, qualifier: true })`
4. Display qualifier placeholder in draw until qualifying finishes

**NOTE**: This enhancement can only work for MAIN stage structures that have qualifying feeds.
