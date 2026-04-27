import { tournamentEngine, participantRoles } from 'tods-competition-factory';

const { COMPETITOR } = participantRoles;

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
    .filter((p: any) => p.participantRole && p.participantRole !== COMPETITOR)
    .map((p: any) => {
      const person = p.person || {};
      const name = [person.standardGivenName, person.standardFamilyName].filter(Boolean).join(' ') || p.participantName || 'Unknown';
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
