import { participantConstants, participantRoles } from 'tods-competition-factory';
import { tournamentEngine } from 'services/factory/engine';

const { COMPETITOR } = participantRoles;
const { INDIVIDUAL } = participantConstants;

/**
 * Personnel worth showing on the overview contact card.
 *
 * BOTH tests are load-bearing. The role test alone — "has a role and it is not COMPETITOR" — let
 * **GROUPs** through: `getParticipants` is called with no `participantFilters`, and every GROUP the UI
 * creates carries a role (the group select offers OTHER / COACH / MEDICAL / PHYSIO / TRAINER). A GROUP
 * has no `person`, so the name fell through to `participantName` and the card rendered a row that read
 * as a person named e.g. "Transport Van A", with a role and no way to reach them.
 *
 * The exact inverse of the entry-gate bug in factory #4684, which tested type and forgot role. Type
 * says WHAT a participant is; role says WHAT THEY DO. Personnel needs both.
 */
export function isContactCardPersonnel(participant: any): boolean {
  if (participant?.participantType !== INDIVIDUAL) return false;
  return !!participant.participantRole && participant.participantRole !== COMPETITOR;
}

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: 'Tournament Director',
  OFFICIAL: 'Official',
  MEDICAL: 'Medical',
  COACH: 'Coach',
  CAPTAIN: 'Captain',
  HOSPITALITY: 'Hospitality',
  TRANSPORT: 'Transportation',
  SECURITY: 'Security',
  VOLUNTEER: 'Volunteer',
  STRINGER: 'Stringer',
  MEDIA: 'Media',
  ADMINISTRATION: 'Administration',
  SUPERVISOR: 'Supervisor',
  OTHER: 'Other',
};

interface ContactInfo {
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

function extractContacts(): ContactInfo[] {
  const { participants } = tournamentEngine.getParticipants({
    withIndividualParticipants: true,
  });

  if (!participants?.length) return [];

  return participants
    .filter(isContactCardPersonnel)
    .map((p: any) => {
      const person = p.person || {};
      const name =
        [person.standardGivenName, person.standardFamilyName].filter(Boolean).join(' ') ||
        p.participantName ||
        'Unknown';
      const role = ROLE_LABELS[p.participantRole] || p.participantRole;
      const contact = person.contacts?.[0] || {};
      return {
        name,
        role,
        email: contact.emailAddress,
        phone: contact.telephone || contact.mobileTelephone,
      };
    })
    .sort((a: ContactInfo, b: ContactInfo) => a.role.localeCompare(b.role, undefined, { numeric: true }));
}

export function buildContactCardHtml(): string {
  const contacts = extractContacts();
  if (!contacts.length) return '<p><em>No tournament personnel found. Add officials via the Participants tab.</em></p>';

  const rows = contacts
    .map((c) => {
      const details = [c.email, c.phone].filter(Boolean).join(' &middot; ');
      return `<tr><td><strong>${c.name}</strong></td><td>${c.role}</td><td>${details}</td></tr>`;
    })
    .join('\n');

  return `<h3>Tournament Contacts</h3>
<table>
<thead><tr><th>Name</th><th>Role</th><th>Contact</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}
