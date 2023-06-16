import { save } from '../../services/storage/save';
import { context } from '../../services/context';

import { utilities } from 'tods-competition-factory';

export const drawMatic = (function () {
  let fx = {
    DEFAULT_RATING: 0
  };

  const CANDIDATE_GOAL = 2000;
  const ENCOUNTER_VALUE = 50;
  const SAME_TEAM_VALUE = 60;
  const ACTOR_DIVISOR = 100;
  // const ALTERNATE_SITES = 50;
  // const AVOID_OPPONENTS = 50;

  function generateCandidate({ ranked_matchups, matchup_values, delta_objects, env }) {
    let candidate_goal = env.draws.drawMatic.candidate_goal || CANDIDATE_GOAL;
    let actor_divisor = env.draws.drawMatic.actor_divisor || ACTOR_DIVISOR;

    let ranked_matchup_values = Object.assign({}, ...ranked_matchups.map((rm) => ({ [rm.matchup]: rm.value })));

    let candidate = roundCandidate({
      ranked_matchups,
      ranked_matchup_values,
      delta_objects
    });
    let delta_candidate = candidate;

    // for each actor generate a roundCandidate using all of their matchup values
    let actors = Object.keys(matchup_values);
    let divisor = candidate_goal / (actors.length / actor_divisor);
    let iterations = Math.floor(divisor / actors.length);
    if (iterations > candidate_goal) iterations = candidate_goal;

    actors.forEach((actor) => {
      let matchups = matchup_values[actor];
      matchups.slice(0, iterations).forEach((m) => {
        let proposed = roundCandidate({
          ranked_matchups,
          ranked_matchup_values,
          stipulated: [m.opponents],
          delta_objects
        });
        if (proposed.max_delta < delta_candidate.max_delta) delta_candidate = proposed;
        if (proposed.value < candidate.value) candidate = proposed;
      });
    });

    return candidate;
  }

  // roundCandidate() runs through the ranked array of matchups adding
  // matches whenever the two opponents are not already part of the candidate.
  // stipulated matchups can be fed into roundCandidate() to force a pairing of opponents.
  function roundCandidate({ ranked_matchups, ranked_matchup_values, stipulated = [], delta_objects }) {
    let candidate_value = 0;
    let matchups = [];
    let round_players = [].concat(...stipulated);
    stipulated.forEach((opponents) => {
      let matchup = matchupHash(...opponents);
      let value = ranked_matchup_values[matchup];
      matchups.push({ opponents, value });
      candidate_value += ranked_matchup_values[matchup];
    });
    ranked_matchups.forEach((rm) => {
      let opponents = rm.matchup.split('|');
      let opponent_exists = opponents.reduce((p, c) => round_players.indexOf(c) >= 0 || p, false);
      if (!opponent_exists) {
        round_players = round_players.concat(...opponents);
        let value = rm.value;
        candidate_value += value;
        matchups.push({ opponents, value });
      }
    });
    matchups.sort(valueSort);
    let max_delta = matchups.reduce((p, c) => {
      let mu = c.opponents.sort().join('|');
      let delta = delta_objects[mu];
      return delta > p ? delta : p;
    }, 0);

    return { value: candidate_value, matchups, max_delta };
  }

  function matchupValues({ matchups, value_objects }) {
    let actors = Object.keys(matchups);
    let matchup_values = {};
    actors.forEach((actor) => {
      let mv = matchups[actor].map((opponent) => matchupValue(actor, opponent));
      matchup_values[actor] = mv.sort(valueSort);
    });

    function matchupValue(actor, opponent) {
      let key = matchupHash(actor, opponent);
      return { opponents: [actor, opponent], value: value_objects[key] };
    }
    return matchup_values;
  }

  function uniqueMatchups({ players, pids }) {
    if (!players && pids && Array.isArray(pids)) players = pids.map((p) => ({ id: p }));
    if (!Array.isArray(players)) return [];

    let player_matchups = {};

    let unique_matchups = [];
    players.map(playerMatchups).forEach(attemptPush);
    function attemptPush(pm) {
      pm.forEach((m) => {
        if (unique_matchups.indexOf(m) < 0) unique_matchups.push(m);
      });
    }

    let value_objects = Object.assign({}, ...unique_matchups.map((mu) => ({ [mu]: 0 })));
    let delta_objects = Object.assign({}, ...unique_matchups.map((mu) => ({ [mu]: 0 })));
    return { unique_matchups, player_matchups, value_objects, delta_objects };

    function playerMatchups(player) {
      let opponents = players.filter((p) => p.id !== player.id);
      player_matchups[player.id] = opponents.map((o) => o.id);
      return opponents.map((o) => matchupHash(o.id, player.id));
    }
  }

  function eventEncounters(evt) {
    let encounters = [];
    let matches = evt?.draw?.matches || [];

    matches.forEach((match) => {
      let teams = match.teams || [];
      teams.forEach((team, i) => {
        team.forEach((player) => {
          let opponent_ids = (teams[1 - i] && teams[1 - i].filter((p) => p).map((p) => p.id)) || [];
          opponent_ids.forEach((opponent_id) => {
            let matchup_hash = player && matchupHash(player.id, opponent_id);
            if (encounters.indexOf(matchup_hash) < 0) encounters.push(matchup_hash);
          });
        });
      });
    });

    return encounters;
  }

  function valueSort(a, b) {
    return a.value - b.value;
  }
  function matchupHash(id1, id2) {
    return [id1, id2].sort().join('|');
  }

  fx.genRound = ({ tournament, env, callback }) => {
    let evt = context.displayed.draw_event;

    let approved = (evt?.approved && [].concat(...evt.approved)) || [];
    if (approved.length < 4 && callback && typeof callback === 'function') callback();
    let event_players = (tournament.players || []).filter((p) => p && approved.indexOf(p.id) >= 0);
    let teams = tournament.teams || [];
    let teams_ids = teams.map((t) => t?.players && Object.keys(t.players)).filter((f) => f);

    let { player_matchups, value_objects, delta_objects } = uniqueMatchups({
      players: event_players
    });
    let encounters = eventEncounters(evt);

    // increment matchup values for prior encounters
    encounters.forEach((matchup) => incrementValue(value_objects, matchup, ENCOUNTER_VALUE));

    // increment matchup values for members of the same team
    teams_ids.forEach((pids) => {
      let { unique_matchups } = uniqueMatchups({ pids });
      unique_matchups.forEach((matchup) => incrementValue(value_objects, matchup, SAME_TEAM_VALUE));
    });

    if (!evt.draw) evt.draw = {};
    if (!evt.draw.matches) evt.draw.matches = [];
    evt.draw.matches = evt.draw.matches.filter((m) => m.teams);
    if (!evt.rounds || !evt.draw.matches.length) {
      evt.rounds = 0;
    }

    // increment matchup values for members of the same team
    let matches = evt.format === 'D' ? doublesRound() : singlesRound();
    matches = matches.sort(ratingsSort);

    evt.draw.matches = evt.draw.matches.concat(...matches);

    context.ee.emit('displayAdhocMatches', { e: evt });

    save.local();
    if (callback && typeof callback === 'function') callback();

    function ratingsSort(a, b) {
      return b.combined_rating - a.combined_rating;
    }

    function doublesRound() {
      let team_ids = evt.approved.map((team) => team.sort().join('~'));
      let { team_matchups, team_value_objects } = uniqueDoublesMatchups({
        team_ids
      });

      // increment matchup values based on ratings differentials
      Object.keys(team_value_objects).forEach((matchup) => {
        let matchup_hashes = [];
        let sides = matchup.split('|');
        let ratings = sides.map((side) =>
          side
            .split('~')
            .map(playerRating)
            .reduce((a, b) => a + b)
        );

        let differential = Math.abs(ratings[0] - ratings[1]) + 1;
        delta_objects[matchup] = Math.abs(ratings[0] - ratings[1]);
        team_value_objects[matchup] += Math.pow(differential, 2);

        // for each matchup between players on both sides, increment the
        // team_value_object by the individual value_objects
        sides.forEach((side, i) => {
          let player_ids = side.split('~');
          player_ids.forEach((player_id) => {
            let opponent_ids = sides[1 - i].split('~');
            opponent_ids.forEach((opponent_id) => {
              let matchup_hash = matchupHash(player_id, opponent_id);
              if (matchup_hashes.indexOf(matchup_hash) < 0) matchup_hashes.push(matchup_hash);
            });
          });
        });

        matchup_hashes.forEach((matchup_hash) => {
          team_value_objects[matchup] += value_objects[matchup_hash] || 0;
        });
      });

      let ranked_matchups = Object.keys(team_value_objects)
        .map((matchup) => ({ matchup, value: team_value_objects[matchup] }))
        .sort(valueSort);
      let team_matchup_values = matchupValues({
        matchups: team_matchups,
        value_objects: team_value_objects
      });

      evt.rounds += 1;
      let candidate = generateCandidate({
        ranked_matchups,
        matchup_values: team_matchup_values,
        delta_objects,
        env
      });
      let doubles_matches = candidate.matchups.map((matchup) =>
        teamMatch({
          tournament,
          evt,
          opponents: matchup.opponents,
          round: evt.rounds
        })
      );

      return doubles_matches;

      function playerRating(pid) {
        return evt.adhoc_ratings[pid] ? parseFloat(evt.adhoc_ratings[pid]) : fx.DEFAULT_RATING;
      }
    }

    function singlesRound() {
      // increment matchup values based on ratings differentials
      Object.keys(value_objects).forEach((matchup) => {
        let ratings = matchup.split('|').map((pid) => evt.adhoc_ratings[pid] || fx.DEFAULT_RATING);
        let differential = Math.abs(ratings[0] - ratings[1]) + 1;
        delta_objects[matchup] = Math.abs(ratings[0] - ratings[1]);
        value_objects[matchup] += Math.pow(differential, 2);
      });

      let ranked_matchups = Object.keys(value_objects)
        .map((matchup) => ({ matchup, value: value_objects[matchup] }))
        .sort(valueSort);
      let player_matchup_values = matchupValues({
        matchups: player_matchups,
        value_objects
      });

      evt.rounds += 1;
      let candidate = generateCandidate({
        ranked_matchups,
        matchup_values: player_matchup_values,
        delta_objects,
        env
      });
      return candidate.matchups.map((matchup) =>
        teamMatch({
          tournament,
          evt,
          opponents: matchup.opponents,
          round: evt.rounds
        })
      );
    }

    function incrementValue(value_objects, encounter, value) {
      if (value_objects[encounter] !== undefined) value_objects[encounter] += value;
    }
  };

  function uniqueDoublesMatchups({ teams, team_ids }) {
    if (!teams && team_ids && Array.isArray(team_ids)) teams = team_ids.map((t) => ({ id: t }));
    if (!Array.isArray(teams)) return [];

    let team_matchups = {};

    let unique_matchups = [];
    teams.map(teamMatchups).forEach(attemptPush);
    function attemptPush(pm) {
      pm.forEach((m) => {
        if (unique_matchups.indexOf(m) < 0) unique_matchups.push(m);
      });
    }

    let team_value_objects = Object.assign({}, ...unique_matchups.map((mu) => ({ [mu]: 0 })));

    return { unique_matchups, team_matchups, team_value_objects };

    function teamMatchups(team) {
      let opponents = teams.filter((p) => p.id !== team.id);
      team_matchups[team.id] = opponents.map((o) => o.id);
      return opponents.map((o) => matchupHash(o.id, team.id));
    }
  }

  function teamMatch({ tournament, evt, opponents, round }) {
    let combined_rating = 0;
    let teams = opponents?.map(matchTeam);
    /*
    teamsFx.assignOpponentTeams({
      teams: tournament.teams,
      opponents: [].concat(...teams)
    });
    */
    teams.forEach((team) => {
      team.forEach((player) => {
        let adhoc_rating = evt?.adhoc_ratings?.[player.id];
        let dynamic_rating = evt?.dynamic_ratings?.[player.id][round];
        if (adhoc_rating && !dynamic_rating && evt.dynamic_ratings && evt.dynamic_ratings[player.id]) {
          let max_round = Math.max(...Object.keys(evt.dynamic_ratings[player.id]));
          if (max_round) evt.dynamic_ratings[player.id][round] = evt.dynamic_ratings[player.id][max_round];
        }

        player.adhoc_rating = adhoc_rating;
        player.dynamic_rating = dynamic_rating || adhoc_rating;
        if (player.dynamic_rating) combined_rating += parseFloat(player.dynamic_rating);
      });
    });
    let player_count = [].concat(...teams).length;
    let format = player_count === 4 ? 'doubles' : 'singles';
    let match = {
      teams,
      round,
      format,
      combined_rating,
      round_name: `R${round}`,
      match: { euid: evt.euid, muid: utilities.UUID() }
    };
    return match;

    function matchTeam(team) {
      return team.split('~').map(findTournamentPlayer);
    }
    function findTournamentPlayer(id) {
      return tournament.players.reduce((p, c) => (c.id === id ? c : p), undefined);
    }
  }

  return fx;
})();
