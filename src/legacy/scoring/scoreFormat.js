/*
   Convert legacy TMX score_format into JSON representation of TODS MatchFormatCode
*/
export const scoreFormat = (function () {
  let fx = {};

  fx.jsonTODS = (score_format) => {
    let tods = { bestOf: getNumber(score_format.max_sets) };

    if (score_format.max_sets && parseInt(score_format.max_sets) === 1 && score_format.final_set_supertiebreak) {
      tods.setFormat = {
        tiebreakSet: { tiebreakTo: score_format.supertiebreak_to }
      };
    } else {
      const setTo = getNumber(score_format.games_for_set);
      const tiebreaks_at = getNumber(score_format.tiereaks_at);
      const tiebreakAt = tiebreaks_at > setTo ? setTo : tiebreaks_at;
      tods.setFormat = {
        setTo,
        tiebreakAt,
        tiebreakFormat: { tiebreakTo: getNumber(score_format.tiebreak_to) }
      };
      if (score_format.final_set_supertiebreak) {
        tods.finalSetFormat = {
          tiebreakSet: { tiebreakTo: score_format.supertiebreak_to }
        };
      }
    }

    return tods;
  };

  function getNumber(formatstring) {
    return !isNaN(Number(formatstring)) && Number(formatstring);
  }

  return fx;
})();
