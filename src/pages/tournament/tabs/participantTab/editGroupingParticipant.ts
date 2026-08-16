/**
 * Editor for group participants (teams).
 * Allows creating or editing team/group participants.
 */
import { participantConstants, participantRoles } from 'tods-competition-factory';
import { validators, renderButtons, renderForm } from 'courthive-components';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

import { ADD_PARTICIPANTS, CREATE_GROUP_PARTICIPANT, MODIFY_PARTICIPANT } from 'constants/mutationConstants';
import { RIGHT, SUCCESS } from 'constants/tmxConstants';
import { t } from 'i18n';

const { COACH, COMPETITOR, MEDICAL, OTHER, PHYSIO, TRAINER } = participantRoles;
const { GROUP, TEAM } = participantConstants;

/**
 * Roles a GROUP can carry. A GROUP expresses a relationship between its members, and that relationship is
 * what `SHARED_GROUPING` conflict-of-interest checks escalate on: the factory's bundled policies map
 * COACH / MEDICAL / PHYSIO / TRAINER to BLOCK via `ConflictRule.roleSeverity`, while anything else — OTHER
 * included — falls through to the rule's base severity (WARN).
 *
 * OTHER stays the default so an ordinary grouping behaves exactly as it did before this select existed.
 * CAPTAIN is deliberately absent from the blocking roles in factory policy (CA, 2026-08-15); it is offered
 * here only if it is added there, to avoid implying an escalation that would not happen.
 *
 * TEAM is NOT offered a role select: it is pinned to COMPETITOR because `teamProfileModal` filters rosters
 * on `participantRole === COMPETITOR`, and `createTeamsFromAttributes` builds TEAMs the same way.
 */
const GROUP_ROLE_OPTIONS = [OTHER, COACH, MEDICAL, PHYSIO, TRAINER];

export function editGroupingParticipant({
  individualParticipantIds,
  participantType = TEAM,
  title = 'Edit team',
  participant,
  refresh,
  table,
}: {
  individualParticipantIds?: string[];
  participantType?: string;
  title?: string;
  participant?: any;
  refresh?: () => void;
  table?: any;
}): any {
  const PARTICIPANT_NAME = 'participantName';
  const isGroup = participantType === GROUP;
  const values = {
    [PARTICIPANT_NAME]: participant?.[PARTICIPANT_NAME],
    nickname: participant?.participantOtherName || '',
    useOtherName: participant?.useOtherName ?? false,
    participantRole: participant?.participantRole || OTHER,
  };
  let inputs: any;

  const content = (elem: HTMLElement) => {
    inputs = renderForm(elem, [
      {
        error: t('pages.participants.grouping.nameTooShort'),
        placeholder: t('pages.participants.grouping.namePlaceholder'),
        value: values[PARTICIPANT_NAME] || '',
        validator: validators.nameValidator(3),
        field: PARTICIPANT_NAME,
        label: t('teams.name'),
      },
      {
        placeholder: t('pages.participants.grouping.nicknamePlaceholder'),
        value: values.nickname,
        field: 'nickname',
        label: t('pages.participants.editParticipant.nickname'),
      },
      {
        checked: values.useOtherName,
        id: 'useOtherName',
        field: 'useOtherName',
        label: t('pages.participants.grouping.preferNickname'),
        checkbox: true,
      },
      // GROUP only — see GROUP_ROLE_OPTIONS. Hidden entirely for TEAM rather than disabled, so there is
      // no impression that a TEAM's role is configurable.
      ...(isGroup
        ? [
            {
              options: GROUP_ROLE_OPTIONS.map((role) => ({
                label: t(`participantRoles.${role}`, { defaultValue: role }),
                selected: role === values.participantRole,
                value: role,
              })),
              value: values.participantRole,
              label: t('pages.participants.groupRole'),
              field: 'participantRole',
            },
          ]
        : []),
    ]);
  };

  const footer = (elem: HTMLElement, close: () => void) =>
    renderButtons(
      elem,
      [
        { label: t('common.cancel'), onClick: () => table?.deselectRow(), close: true },
        { label: t('common.save'), onClick: saveParticipant, close: true, intent: 'is-info' },
      ],
      close,
    );

  context.drawer.open({
    title: `<b style='larger'>${title}</b>`,
    callback: () => {},
    width: '300px',
    side: RIGHT,
    content,
    footer,
  });

  const postMutation = (result: any) => {
    if (result.success) {
      isFunction(refresh) && refresh?.();
    } else {
      console.log({ result });
    }
  };

  function saveParticipant(): void {
    table?.deselectRow();
    if (participant?.participantId) {
      updateParticipant();
    } else {
      addParticipant();
    }
  }

  function updateParticipant(): void {
    const participantName = inputs[PARTICIPANT_NAME]?.value;
    if (!participantName || participantName.length < 3) return;

    const participantOtherName = inputs.nickname?.value || undefined;
    const useOtherName = inputs.useOtherName?.checked ?? false;

    // A TD discovers a relationship at least as often AFTER creating the group as before, so the role
    // must be editable, not create-only.
    const roleUpdate = isGroup ? { participantRole: inputs.participantRole?.value || values.participantRole } : {};

    const methods = [
      {
        method: MODIFY_PARTICIPANT,
        params: {
          participant: {
            participantId: participant.participantId,
            participantOtherName,
            participantName,
            useOtherName,
            ...roleUpdate,
          },
        },
      },
    ];
    mutationRequest({ methods, callback: postMutation });
  }

  function addParticipant(): void {
    // TEAM is pinned to COMPETITOR; a GROUP takes the selected role, defaulting to OTHER.
    const participantRole = participantType === TEAM ? COMPETITOR : inputs.participantRole?.value || OTHER;
    const memberIds = individualParticipantIds || participant?.individualParticipantIds || [];
    const participantName = inputs[PARTICIPANT_NAME]?.value;

    // GROUPs go through the factory's purpose-built creator, which validates that every member is an
    // INDIVIDUAL in the tournament (INVALID_PARTICIPANT_TYPE otherwise). The hand-built ADD_PARTICIPANTS
    // path skips that check, so it is kept only for TEAM where the existing behaviour is relied upon.
    const methods = isGroup
      ? [
          {
            method: CREATE_GROUP_PARTICIPANT,
            params: {
              individualParticipantIds: memberIds,
              groupName: participantName,
              participantRole,
            },
          },
        ]
      : [
          {
            params: {
              participants: [
                {
                  individualParticipantIds: memberIds,
                  participantName,
                  participantRole,
                  participantType,
                },
              ],
            },
            method: ADD_PARTICIPANTS,
          },
        ];
    mutationRequest({ methods, callback: postMutation });
  }

  return { ...SUCCESS };
}
