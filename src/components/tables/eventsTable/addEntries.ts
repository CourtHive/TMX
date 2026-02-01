/**
 * Add entries action for events table.
 * Opens participant selection modal and adds selected entries to event.
 */
import { positionActionConstants, tournamentEngine } from 'tods-competition-factory';
import { selectParticipant } from 'components/modals/selectParticipant';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { mapEntry } from 'pages/tournament/tabs/eventsTab/mapEntry';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { invalidParticipantsModal } from 'components/modals/invalidParticipantsModal';

const { ASSIGN_PARTICIPANT } = positionActionConstants;

import { ADD_EVENT_ENTRIES } from 'constants/mutationConstants';
import { QUALIFYING, RIGHT } from 'constants/tmxConstants';

export const addEntries =
  (event: any, group: string) =>
  (table: any): any => {
    const onClick = () => {
      const { entries = [], eventId, eventType } = event;
      const enteredParticipantIds = new Set((entries || []).map(({ participantId }: any) => participantId));
      const participantType =
        (event.eventType === 'TEAM' && 'TEAM') || (event.eventType === 'DOUBLES' && 'PAIR') || 'INDIVIDUAL';
      const participantsAvailable = tournamentEngine
        .getParticipants({
          inContext: true,
          participantFilters: { participantTypes: [participantType] },
          withISO2: true,
        })
        .participants.filter((participant: any) => !enteredParticipantIds.has(participant.participantId));

      const onSelection = ({ selected }: any) => {
        if (!selected?.length) return;

        const participantIds = selected.map(({ participantId }: any) => participantId);
        const entryStage = group === QUALIFYING ? 'QUALIFYING' : 'MAIN';
        const entryStatus = 'DIRECT_ACCEPTANCE';

        const methods = [
          {
            params: { eventId, participantIds, entryStatus, entryStage, enforceGender: true, enforceCategory: true },
            method: ADD_EVENT_ENTRIES,
          },
        ];

        const postMutation = (result: any) => {
          if (result.success) {
            const { participants, derivedDrawInfo } = tournamentEngine.getParticipants({
              participantFilters: { participantIds },
              withIndividualParticipants: true,
              withScaleValues: true,
              withDraws: true,
            });

            const newEntries = participantIds.map((participantId: string) =>
              (mapEntry as any)({
                entry: { participantId, entryStage, entryStatus },
                derivedDrawInfo,
                participants,
                eventType,
                eventId,
              }),
            );

            table.addRow(newEntries);
          } else {
            // Transform error context into invalidParticipants format
            const context = result.context;
            let invalidParticipants: any[] = [];

            if (context) {
              // Handle categoryRejections (includes participantName and rejectionReasons)
              if (context.categoryRejections?.length) {
                invalidParticipants.push(
                  ...context.categoryRejections.map((p: any) => ({
                    participantId: p.participantId,
                    participantName: p.participantName,
                    errors: [
                      {
                        error: p.rejectionReasons[0]?.type || 'categoryRejection',
                        reason: p.rejectionReasons[0]?.reason,
                      },
                    ],
                  })),
                );
              }

              // Handle mismatchedGender
              if (context.mismatchedGender?.length) {
                const expectedGender = context.gender;
                invalidParticipants.push(
                  ...context.mismatchedGender.map((p: any) => ({
                    participantId: p.participantId,
                    errors: [
                      {
                        error: 'mismatchedGender',
                        sex: p.sex,
                        expectedGender,
                      },
                    ],
                  })),
                );
              }

              // Handle invalidAge
              if (context.invalidAge?.length) {
                invalidParticipants.push(
                  ...context.invalidAge.map((p: any) => ({
                    participantId: p.participantId,
                    errors: [{ error: 'invalidAge', ...p }],
                  })),
                );
              }

              // Handle invalidRating
              if (context.invalidRating?.length) {
                invalidParticipants.push(
                  ...context.invalidRating.map((p: any) => ({
                    participantId: p.participantId,
                    errors: [{ error: 'invalidRating', ...p }],
                  })),
                );
              }
            }

            if (invalidParticipants.length) {
              // Close the participant selection modal before opening invalid participants modal
              closeModal();
              // Small delay to allow the first modal to fully close
              setTimeout(() => {
                invalidParticipantsModal({ invalidParticipants });
              }, 100);
            }
          }
        };
        mutationRequest({ methods, callback: postMutation });
      };

      const action = {
        type: ASSIGN_PARTICIPANT,
        participantsAvailable,
      };

      (selectParticipant as any)({
        title: 'Select participants to add',
        activeOnEnter: true,
        selectionLimit: 99,
        onSelection,
        action,
      });
    };

    return {
      label: 'Add entries',
      class: 'addEntries',
      location: RIGHT,
      onClick,
    };
  };
