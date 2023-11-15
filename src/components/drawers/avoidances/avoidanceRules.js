export const avoidanceRules = {
  city: [{ key: 'person.addresses.city' }, { key: 'individualParticipants.person.addresses.city' }],
  state: [{ key: 'person.addresses.state' }, { key: 'individualParticipants.person.addresses.state' }],
  postal: [
    { key: 'person.addresses.postalCode', significantCharacters: 5 },
    { key: 'individualParticipants.person.addresses.postalCode', significantCharacters: 5 }
  ],
  country: [{ key: 'person.addresses.country' }, { key: 'individualParticipants.person.addresses.country' }],
  pair: { directive: 'pairParticipants' },
  team: { directive: 'groupParticipants' }
};
