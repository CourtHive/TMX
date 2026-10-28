/**
 * Changing a pre-#4683 group's contact person sends two methods in one rolled-back batch: write the first-class
 * `contactParticipantIds`, and remove the old `contactPerson` extension. The removal went out as
 * `{ extensionName }`, the factory reads `name` and refused it with MISSING_VALUE, and the rollback took the
 * contact change down with it. These run the batch the modal builds through the real engine.
 */
import { mocksEngine, participantConstants, participantRoles, tournamentEngine } from 'tods-competition-factory';
import { CONTACT_PERSON_EXTENSION, removeContactPersonExtensionMethod } from './groupContactPerson';
import { MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import { describe, expect, it } from 'vitest';

const { GROUP } = participantConstants;

function preMigrationGroup() {
  mocksEngine.generateTournamentRecord({ participantsProfile: { participantsCount: 4 }, setState: true });
  const { participants = [] } = tournamentEngine.getParticipants();
  const individualParticipantIds = participants.slice(0, 2).map(({ participantId }) => participantId);

  const participantId = 'group-1';
  const result: any = tournamentEngine.addParticipant({
    participant: {
      extensions: [{ name: CONTACT_PERSON_EXTENSION, value: individualParticipantIds[0] }],
      participantRole: participantRoles.COMPETITOR,
      participantName: 'Pre-migration group',
      participantType: GROUP,
      individualParticipantIds,
      participantId,
    },
  });
  expect(result.success).toEqual(true);

  return { participantId, newContactId: individualParticipantIds[1] };
}

const contactChange = (participantId: string, contactId: string) => ({
  method: MODIFY_PARTICIPANT,
  params: { participant: { participantId, contactParticipantIds: [contactId] } },
});

const storedGroup = (participantId: string) => tournamentEngine.findParticipant({ participantId }).participant;

describe('removing the contact person extension', () => {
  it('names the extension the way removeParticipantExtension reads it', () => {
    expect(removeContactPersonExtensionMethod('group-1')).toEqual({
      method: 'removeParticipantExtension',
      params: { participantId: 'group-1', name: CONTACT_PERSON_EXTENSION },
    });
  });

  it('the batch the modal sends now succeeds and keeps the contact change', () => {
    const { participantId, newContactId } = preMigrationGroup();

    const result: any = tournamentEngine.executionQueue(
      [contactChange(participantId, newContactId), removeContactPersonExtensionMethod(participantId)],
      true,
    );
    expect(result.success).toEqual(true);
    expect(storedGroup(participantId)?.contactParticipantIds).toEqual([newContactId]);
  });

  it('the old `extensionName` shape was refused, and the rollback lost the contact change', () => {
    // The control: proves the engine refuses the shape the modal used to send, so the test above is not
    // passing merely because removal is lenient
    const { participantId, newContactId } = preMigrationGroup();

    const result: any = tournamentEngine.executionQueue(
      [
        contactChange(participantId, newContactId),
        {
          method: 'removeParticipantExtension',
          params: { participantId, extensionName: CONTACT_PERSON_EXTENSION },
        },
      ],
      true,
    );
    expect(result.success).not.toEqual(true);
    expect(storedGroup(participantId)?.contactParticipantIds ?? []).not.toContain(newContactId);
  });
});
