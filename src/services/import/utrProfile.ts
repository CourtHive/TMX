/**
 * The identifiers a participant import derives from a UTR profile cell.
 *
 * A cell holds either a profile URL (`https://.../profiles/123`) or a bare id (`123`). Both give a
 * `person.personOtherIds` entry; a URL also gives a participant-level CODES `OnlineResource`.
 *
 * The resource names its type with `resourceType`, the CODES attribute, whose value is one of
 * `OnlineResourceTypeEnum`. Imports before this module wrote the type under a `resource` key, which
 * is not a CODES attribute; records that hold it are not rewritten here.
 */

import { OnlineResourceTypeEnum } from 'tods-competition-factory';

export const UTR_ORGANISATION_NAME = 'UTR';
export const UTR_PROFILE_RESOURCE_NAME = 'UTR Profile';
export const PROFILE_RESOURCE_SUBTYPE = 'PROFILE';

export type UtrProfileItems = {
  otherId?: { uniqueOrganisationName: string; personId: string };
  onlineResource?: { resourceType: string; resourceSubType: string; identifier: string; name: string };
};

export function utrProfileItems(utrProfile: string): UtrProfileItems {
  const value = utrProfile.trim();
  const personId = value.split('profiles/').at(-1);
  if (!personId) return {};

  const items: UtrProfileItems = { otherId: { uniqueOrganisationName: UTR_ORGANISATION_NAME, personId } };
  if (value.startsWith('http')) {
    items.onlineResource = {
      resourceType: OnlineResourceTypeEnum.URL,
      resourceSubType: PROFILE_RESOURCE_SUBTYPE,
      name: UTR_PROFILE_RESOURCE_NAME,
      identifier: value,
    };
  }
  return items;
}

/** Adds the items to a participant draft. A list is created only when an item is added to it. */
export function applyUtrProfile(participant: any, utrProfile: string): void {
  const { otherId, onlineResource } = utrProfileItems(utrProfile);
  if (otherId) {
    participant.person ??= {};
    participant.person.personOtherIds ??= [];
    participant.person.personOtherIds.push(otherId);
  }
  if (onlineResource) {
    participant.onlineResources ??= [];
    participant.onlineResources.push(onlineResource);
  }
}
