import { matchUpFormatCode } from 'tods-competition-factory';
import { scoreFormat } from './scoreFormat';

export const scoreFx = (function () {
  let fx = {};

  function validInt(value, invalid) {
    let result = parseInt(value);
    return isNaN(result) ? invalid : result;
  }

  // target is an object which *must* have all keys defined.
  // preference is given to the *first* object processed
  function assignKeys({ source = {}, objects = [] }) {
    let target = Object.assign({}, source);
    if (objects && !Array.isArray(objects)) objects = [objects];
    objects = objects.filter((f) => f);
    objects.forEach((o) => {
      if (typeof o !== 'object') return;
      let keys = Object.keys(o);
      keys.forEach((k) => (target[k] = target[k] !== undefined ? target[k] : o[k]));
    });
    return target;
  }

  fx.setsToWin = (best_of) => (best_of && Math.ceil(best_of / 2)) || 1;
  fx.tiebreakTo = (o, isFinalSet) => {
    let setTiebreakTo = o?.setFormat?.tiebreakFormat?.tiebreakTo;
    let finalSetTiebreakTo = o?.finalSetFormat?.tiebreakFormat?.tiebreakTo;
    return isFinalSet ? finalSetTiebreakTo : setTiebreakTo;
  };

  fx.matchFormat = matchFormat;
  function matchFormat(matchFormat) {
    return (matchFormat || 'SET3-S:6/TB7').slice(3);
  }

  fx.getExistingScores = ({ match }) => {
    if (!match?.score) return undefined;
    return convertStringScore({
      string_score: match.score,
      winner_index: match.winner_index,
      matchFormat: match.matchFormat
    });
  };

  fx.generateMatchFormat = ({ cfg_obj }) => {
    let bestof = cfg_obj.bestof.ddlb.getValue();
    let max_sets = validInt(bestof);
    let sets_to_win = scoreFx.setsToWin(max_sets);
    let score_format = {
      max_sets,
      sets_to_win,
      games_for_set: validInt(cfg_obj.setsto.ddlb.getValue()),
      tiebreaks_at: validInt(cfg_obj.tiebreaksat.ddlb.getValue()) || '', // only option that can be 'none'
      tiebreak_to: validInt(cfg_obj.tiebreaksto.ddlb.getValue()),
      supertiebreak_to: validInt(cfg_obj.supertiebreakto.ddlb.getValue()),
      final_set_supertiebreak: cfg_obj.finalset.ddlb.getValue() === 'N' ? false : true
    };

    let matchFormat = matchUpFormatCode.stringify(scoreFormat.jsonTODS(score_format));

    return { matchFormat, score_format };
  };

  fx.getScoringFormat = ({ e, match }) => {
    let format = match?.format || (e?.format === 'D' ? 'doubles' : 'singles');

    let objects = [match?.score_format, match?.match?.score_format, e.scoring_format?.[format], e.score_format];

    return assignKeys({ objects });
  };

  fx.defaultMatchFormat = ({ format, category, env }) => {
    let matchFormats = env.scoreboard.matchFormats;
    let formats = { S: 'singles', D: 'doubles' };
    if (Object.keys(formats).indexOf(format) >= 0) format = formats[format];
    if (format && category && matchFormats.categories[category] && matchFormats.categories[category][format])
      return matchFormats.categories[category][format];
    if (format && matchFormats[format]) return matchFormats[format];
    return matchFormats.singles;
  };

  fx.convertStringScore = convertStringScore;
  function convertStringScore({ string_score, winner_index, split = ' ', matchFormat }) {
    if (!string_score) return [];

    string_score = winner_index ? reverseScore(string_score) : string_score;

    let outcome = null;
    let ss = /(\d+)/;
    let sst = /(\d+)\((\d+)\)/;
    let match_format = matchUpFormatCode.parse(matchFormat);

    let sets = string_score
      .split(split)
      .filter((f) => f)
      .map((set) => {
        if (set.indexOf('/') > 0) {
          // look for supertiebreak scores using #/# format
          let scores = set
            .split('/')
            .map((m) => (ss.exec(m) ? { games: +ss.exec(m)[1] } : undefined))
            .filter((f) => f);
          if (scores.length === 2) return scores;
        }

        // uglifier doesn't work if variable is undefined
        let tbscore = null;
        let scores = set.split('-').map((m) => {
          let score;
          if (sst.test(m)) {
            tbscore = +sst.exec(m)[2];
            score = { games: +sst.exec(m)[1] };
          } else if (ss.test(m)) {
            score = { games: +ss.exec(m)[1] };
          } else {
            outcome = m;
          }
          return score || undefined;
        });

        // filter out undefined scores
        scores = scores.filter((f) => f);

        // add spacer for score without tiebreak score
        if (tbscore !== null) {
          let min_games = Math.min(...scores.map((s) => s.games));
          scores.forEach((sf) => {
            if (+sf.games === +min_games) {
              sf.tiebreak = tbscore;
            } else {
              sf.spacer = tbscore;
            }
          });
        }

        return scores;
      });

    // filter out sets without two scores
    sets = sets.filter((scores) => scores && scores.length === 2);

    // determine if set is supertiebreak
    sets.forEach((st) => {
      let set_format = match_format && (match_format.finalSetFormat || match_format.setFormat);
      let supertiebreak_to = set_format?.tiebreakSet?.tiebreakTo;

      if (st[0].games >= supertiebreak_to || st[1].games >= supertiebreak_to) {
        st[0].supertiebreak = st[0].games;
        st[1].supertiebreak = st[1].games;
        delete st[0].games;
        delete st[1].games;
      }
    });

    if (winner_index !== undefined) {
      sets.winner_index = winner_index;
    }

    if (outcome) {
      if (outcome === 'Cancelled') sets.cancelled = true;
      if (outcome === 'Abandoned') sets.abandoned = true;
      if (outcome === 'INC.') sets.incomplete = true;
      if (outcome === 'INT.') sets.interrupted = true;
      if (outcome === 'LIVE') sets.live = true;
      if (outcome === 'TIME') sets.time = true;
      if (outcome === 'DEF.') sets.default = true;
      if (outcome === 'W.O.') sets.walkover = true;

      if (!sets.length) return sets;

      // passing additional detail from string parse...
      if (winner_index !== undefined) {
        // outcomes are attributed to loser...
        sets[sets.length - 1][1 - winner_index].outcome = outcome;
        // and set as attribute on set
        sets[sets.length - 1].outcome = outcome;
        sets.outome = outcome;
      }
    }

    return sets;
  }

  fx.reverseScore = reverseScore;
  function reverseScore(score, split = ' ') {
    let irreversible = null;
    if (score) {
      let reversed = score.split(split).map(parseSet).join(split);
      return irreversible ? `${irreversible} ${reversed}` : reversed;
    }

    function parseSet(set) {
      let divider = set.indexOf('/') > 0 ? '/' : '-';
      let set_scores = set
        .split(divider)
        .map(parseSetScore)
        .reverse()
        .filter((f) => f);
      let set_games = set_scores.map((s) => s.games);
      let tb_scores = set_scores.map((s) => s.tiebreak).filter((f) => f);
      let tiebreak = tb_scores.length === 1 ? `(${tb_scores[0]})` : '';
      let set_score =
        tb_scores.length < 2 ? set_games.join(divider) : set_games.map((s, i) => `${s}(${tb_scores[i]})`).join(divider);
      return `${set_score}${tiebreak}`;
    }

    function parseSetScore(set) {
      let ss = /(\d+)/;
      let sst = /(\d+)\((\d+)\)/;
      if (sst.test(set)) return { games: sst.exec(set)[1], tiebreak: sst.exec(set)[2] };
      if (ss.test(set)) return { games: ss.exec(set)[1] };
      irreversible = set;
      return undefined;
    }
  }

  return fx;
})();
