export const avoidanceRules = {
  city: [{ key: 'person.addresses.city' }, { key: 'individualParticipants.person.addresses.city' }],
  state: [{ key: 'person.addresses.state' }, { key: 'individualParticipants.person.addresses.state' }],
  postal: [
    { key: 'person.addresses.postalCode', significantCharacters: 5 },
    { key: 'individualParticipants.person.addresses.postalCode', significantCharacters: 5 }
  ],
  iso: [{ key: 'person.addresses.country' }, { key: 'individualParticipants.person.addresses.country' }],
  groups: [{ directive: 'groupParticipants' }],
  pairs: [{ directive: 'pairParticipants' }],
  teams: [{ directive: 'teamParticipants' }]
};
