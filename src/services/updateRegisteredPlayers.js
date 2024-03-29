import { tournamentEngine, extensionConstants } from 'tods-competition-factory';
import { mockParticipants } from 'components/modals/mockParticipants';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

export function updateRegisteredPlayers({ callback }) {
  let done = (result) => {
    let registeredPlayers = result?.players;

    if (registeredPlayers?.length) {
      addRegistered(registeredPlayers);
    } else if (registeredPlayers && !registeredPlayers.length) {
      let message = 'Sheet Empty: No Player Rows';
      context.modal.inform({ message });
    }

    if (isFunction(callback)) callback();
  };

  const { extension } = tournamentEngine.findExtension({ discover: true, name: extensionConstants.REGISTRATION });
  const registration = extension?.value;
  if (!registration) mockParticipants({ callback: done });
}

function addRegistered(registeredPlayers) {
  console.log({ registeredPlayers });
}
