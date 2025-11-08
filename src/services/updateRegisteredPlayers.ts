import { tournamentEngine, extensionConstants } from 'tods-competition-factory';
import { mockParticipants } from 'components/modals/mockParticipants';
import { isFunction } from 'functions/typeOf';
import { context } from 'services/context';

export function updateRegisteredPlayers({ callback }: { callback?: () => void }): void {
  const done = (result: any) => {
    const registeredPlayers = result?.players;

    if (registeredPlayers?.length) {
      addRegistered(registeredPlayers);
    } else if (registeredPlayers && !registeredPlayers.length) {
      const message = 'Sheet Empty: No Player Rows';
      context.modal.inform({ message });
    }

    if (isFunction(callback) && callback) callback();
  };

  const { extension } = tournamentEngine.findExtension({ discover: true, name: extensionConstants.REGISTRATION });
  const registration = extension?.value;
  if (!registration) mockParticipants({ callback: done });
}

function addRegistered(registeredPlayers: any[]): void {
  console.log({ registeredPlayers });
}
