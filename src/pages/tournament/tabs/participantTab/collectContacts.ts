/**
 * Turning a drawer full of contact rows into the `person.contacts` array to persist.
 *
 * `modifyParticipant` **replaces** `person.contacts` rather than merging it (deliberately, so a
 * contact can be removed), which makes this the most dangerous function in the participant drawer: a
 * mistake here does not render wrong, it deletes a number nobody can recover from the UI.
 *
 * Three rules carry over verbatim from the single-contact version and are the reason this is a pure
 * function with its own tests rather than logic inline in the drawer:
 *
 * 1. **`undefined` means "leave the stored list alone"; `[]` means "clear it".** A participant who
 *    simply has no phone number must not carry an instruction to wipe a list.
 * 2. **Emptiness is decided by the REACHABLE fields alone.** A relationship or a name with no number
 *    and no address is not a contact; keeping it alive would persist a shell that renders as a blank
 *    row and would make "remove this contact" inexpressible.
 * 3. **An absent input and an emptied one are different instructions.** Emptied means clear; absent
 *    means the drawer never offered the field and must not speak for it. This is what generalises
 *    safely to N rows: a row the form did not render is preserved untouched, so a reduced form can
 *    never delete the contacts it did not show.
 */
import { isReachable } from 'services/contact/contactLinks';

import type { ContactLike } from 'services/contact/contactLinks';

/**
 * One row of the contact editor, already read out of the DOM.
 *
 * `relationshipOffered` / `nameOffered` record whether the form rendered those inputs at all — rule 3
 * above. They are separate from the values because `undefined` on the value means "the user cleared
 * it", which is a real instruction the field must be able to express.
 */
export interface ContactRowInput {
  relationshipOffered?: boolean;
  telephoneOffered?: boolean;
  mobileTelephone?: string;
  relationship?: string;
  emailAddress?: string;
  nameOffered?: boolean;
  isPublic?: boolean;
  telephone?: string;
  name?: string;
}

export interface CollectContactsParams {
  /** One entry per row the form rendered. `undefined` at an index means "this row was not offered". */
  rows: (ContactRowInput | undefined)[];
  /** `person.contacts` as stored. Index i corresponds to row i. */
  existing: ContactLike[];
  /** Index of the row the user marked primary, if the form offered the choice. */
  primaryIndex?: number;
}

/** An entry plus where it came from, so the primary selection can be resolved after filtering. */
interface CollectedEntry {
  contact: ContactLike;
  originIndex: number;
}

/** Apply one row's edits over the contact it was rendered from, preserving fields the form omits. */
function applyRowEdits(row: ContactRowInput, stored: ContactLike | undefined): ContactLike {
  // Spread the stored entry FIRST so `fax`, `notes` and any extension survive an edit made through a
  // form that never showed them.
  const edits: ContactLike = {
    mobileTelephone: row.mobileTelephone,
    emailAddress: row.emailAddress,
    isPublic: !!row.isPublic,
  };
  if (row.relationshipOffered) edits.relationship = row.relationship;
  if (row.telephoneOffered) edits.telephone = row.telephone;
  if (row.nameOffered) edits.name = row.name;
  return { ...stored, ...edits };
}

export function collectContacts({ rows, existing, primaryIndex }: CollectContactsParams): ContactLike[] | undefined {
  const stored = Array.isArray(existing) ? existing : [];
  const rowCount = Math.max(rows.length, stored.length);
  const collected: CollectedEntry[] = [];

  for (let index = 0; index < rowCount; index++) {
    const row = rows[index];

    // Rule 3. The form did not render this row, so it has no opinion about it. Keep the stored entry
    // exactly as it is — same object, so a caller comparing by value sees nothing changed.
    if (!row) {
      const untouched = stored[index];
      if (untouched) collected.push({ contact: untouched, originIndex: index });
      continue;
    }

    // Rule 2. Cleared of everything reachable, so the entry is being removed. Reachability is judged
    // on the MERGED entry, so a landline the form preserved rather than offered still counts — the
    // alternative silently discards a stored number because two unrelated fields were emptied.
    const edited = applyRowEdits(row, stored[index]);
    if (isReachable(edited)) collected.push({ contact: edited, originIndex: index });
  }

  // The primary is positional — `contacts[0]`. Storing an explicit "isPrimary" marker instead would
  // be a second source of truth for a fact the array order already carries, and every existing reader
  // (`getTournamentInfo`, the participants table columns, the group contact-person row) reads index 0.
  const promoted = collected.findIndex((entry) => entry.originIndex === primaryIndex);
  if (promoted > 0) {
    const [entry] = collected.splice(promoted, 1);
    collected.unshift(entry);
  }

  const contacts = collected.map((entry) => entry.contact);

  // Rule 1. Nothing entered and nothing stored — send no `contacts` key at all.
  if (!contacts.length && !stored.length) return undefined;
  return contacts;
}
