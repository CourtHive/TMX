//import { baseApi } from 'services/authentication/baseApi';
//import { performTask } from 'functions/tasks';
//import { tmxStore } from 'stores/tmxStore';
//import { db } from 'services/storage/db';

//import { getJwtTokenStorageKey } from 'config/localStorage';
//import { validateToken } from 'services/authentication/actions';
//import { isDev } from 'functions/isDev';

//const JWT_TOKEN_STORAGE_NAME = getJwtTokenStorageKey();

/*
export async function getMyTournamentsReq() {
  return baseApi.get(`/officiating/tournament-calendar/my-tournaments`);
}

function addMissing(trnys) {
  performTask(db.addTournament, trnys, false).then(
    () => {
      console.log('success');
    },
    () => {
      console.log('failure');
    }
  );
}

// DEPRECATED: ??
export async function saveMyTournaments() {
  const token = localStorage.getItem(JWT_TOKEN_STORAGE_NAME);
  const decodedToken = validateToken(token);
  if (decodedToken) {
    try {
      const response = await getMyTournamentsReq();
      const myTournaments = response.data || [];
      tmxStore.dispatch({ type: 'set myTournaments', payload: myTournaments });
      db.findAllTournaments().then((tournaments) => {
        const tournamentIds = tournaments.map((tournament) => tournament.tuid);
        const myTournamentIds = myTournaments.map((t) => {
          const tournamentId = t.unifiedTournamentId?.tournamentId || t.tournamentId;
          return tournamentId;
        });
        const missingTournamentIds = myTournamentIds.filter((tournamentId) => !tournamentIds.includes(tournamentId));
        const missingTournaments = myTournaments.filter((tournament) => {
          const tournamentId = tournament.unifiedTournamentId?.tournamentId || tournament.tournamentId;
          return missingTournamentIds.includes(tournamentId);
        });
        const convertedMissingTournaments = missingTournaments.map((tournament) => {
          const tournamentId = tournament.unifiedTournamentId?.tournamentId || tournament.tournamentId;
          const converted = Object.assign({}, tournament, {
            tuid: tournamentId,
            start: new Date(tournament.start).getTime(),
            end: new Date(tournament.end).getTime(),
            cagtegories: [tournament.category]
          });
          return converted;
        });
        addMissing(convertedMissingTournaments);
      });
    } catch (err) {
      console.log({ err });
    }
  } else {
    if (isDev()) console.log('%c not logged in', 'color: pink');
  }
}
*/
