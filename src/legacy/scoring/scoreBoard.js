import { matchUpFormatCode, tools } from 'tods-competition-factory';
import { closeModal } from 'components/modals/baseModal/baseModal';
import { eventManager } from 'services/dom/events/eventManager';
import { getParent } from 'services/dom/parentAndChild';
import completedMatch from 'assets/icons/completed.png';
import { floatingScoring } from './floatingScoring';
import { keyWalk } from 'functions/keyWalk';
import { lang } from 'services/translator';
import { select as d3Select } from 'd3';
import { scoreFx } from './scoreFx';
import { dd } from './dropdown';

const numParseInt = (value, invalid) => {
  let result = parseInt(value);
  return isNaN(result) ? invalid : result;
};

export const AUTORETURN = 1500;

function visibilityToggle({ elem, type, duration = 800, height = 80, visible }) {
  let toggle_div = d3Select(elem);
  transition();

  function transition() {
    let target = toggle_div.select('.' + type);
    let display_state = target.style('display');
    let target_state = display_state === 'none' ? 'flex' : 'none';
    if ((visible === true && display_state === 'none') || (visible === undefined && target_state === 'flex')) {
      target.style('height', '0px');
      target.style('display', target_state).transition().duration(duration).style('height', `${height}px`);
    } else if ((visible === false && display_state === 'flex') || (visible === undefined && target_state === 'none')) {
      target.transition().duration(duration).style('height', '0px').transition().duration(0).style('display', 'none');
    }
  }
}

export const scoreBoard = (function () {
  let fx = {
    numericFx: undefined,
    enterFx: undefined,
  };

  document.addEventListener('keyup', (evt) => {
    // capture key up/left/down/right events and pass to subscribed function
    if (evt.key && evt.key === 'Enter' && fx.enterFx && typeof fx.enterFx === 'function') {
      fx.enterFx();
    }
    if (evt.key && fx.numericFx && typeof fx.numericFx == 'function') {
      let topline = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].indexOf(evt.key);
      let bottomline = [')', '!', '@', '#', '$', '%', '^', '&', '*', ')'].indexOf(evt.key);
      if (topline >= 0) {
        fx.numericFx(topline);
      } else if (bottomline >= 0) {
        fx.numericFx(bottomline, 1);
      }
    }
  });

  let setClicks = {};

  eventManager.register('setClick', 'tap', setClick);

  function setClick(elem) {
    let set_number_element = getParent(elem, 'set_number');
    if (!set_number_element) return;
    let set = set_number_element.getAttribute('setnum');
    let muid = getParent(elem, 'muid').getAttribute('muid');
    if (setClicks[muid] && typeof setClicks[muid] === 'function') setClicks[muid](set);
  }

  let settings = { auto_score: true };

  let options = {
    bestof: [1, 3, 5],
    setsto: [4, 6, 8],
    tiebreaksto: [5, 7, 12],
    supertiebreakto: [7, 10, 21],
  };

  fx.options = (values) => {
    if (!values) return options;
    keyWalk(values, options);
  };

  fx.setMatchScore = ({
    auto_score = true,
    existing_scores,
    matchFormat,
    round_name,
    callback,
    grouped,
    match,
    teams,
    muid,
    lock,
  }) => {
    settings.auto_score = auto_score;

    let current_state = { ...settings };
    let match_format = matchUpFormatCode.parse(matchFormat || 'SET3-S:6/TB7');
    if (!match_format) return;
    let tiebreaks_at = match_format?.setFormat?.tiebreakAt;
    let games_for_set = match_format?.setFormat?.setTo;
    let max_sets = match_format.bestOf;
    let sets_to_win = scoreFx.setsToWin(max_sets);

    let set_format = match_format.finalSetFormat || match_format.setFormat;
    let supertiebreak_to = set_format?.tiebreakSet?.tiebreakTo;
    let tiebreak_to = match_format?.setFormat?.tiebreakFormat?.tiebreakTo;
    let final_set_supertiebreak = match_format?.finalSetFormat?.tiebreakSet;

    // scoped variables need to be defined before configuration
    let set_number;
    let supertiebreak;
    let ddlb_lock;
    let set_scores;
    let action_drawer;

    let sobj = floatingScoring.display({ muid, teams });
    sobj.details.element.style.display = 'none';

    if (round_name) sobj.round_name.element.innerHTML = round_name;
    sobj.details.element.innerHTML = matchStatus(match);
    sobj.scoring.element.style.display = lock ? 'none' : 'inline';
    sobj.favorite.element.style.display = lock ? 'inline' : 'none';

    if (muid) {
      setClicks[muid] = (set) => {
        if (lock) return;
        if (set_scores.length - set > 1) {
          set_scores = set_scores.slice(0, set_scores.length - 1);
          set = set_scores.length - 1;
          resetActions();
        }
        setScoreDisplay({ selected_set: set });
        displayActions(true);
        removeWinner();

        // must override settings of displayActions() so that format can be edited
        sobj.scoring.element.style.display = 'inline';
        sobj.edit_scoring.element.style.display = 'inline';
      };
    }

    let displayActions = (bool) => {
      let visible = bool && !lock;
      action_drawer = visible;
      visibilityToggle({
        elem: sobj.actions.element,
        type: 'edit',
        height: 50,
        visible,
      });
      sobj.scoring.element.style.display = action_drawer || lock ? 'none' : 'inline';
      sobj.edit_scoring.element.style.display = action_drawer ? 'none' : 'inline';
    };

    configureScoring({ sobj, changeFx: clearScores });
    configureOutcomeSelectors();
    configureActionButtons();
    configureTiebreakEntry();
    initialState();

    function convertExisting() {
      return [];
    }

    // SUPPORTING FUNCTIONS
    function initialState() {
      set_scores = existing_scores ? convertExisting() : [];
      action_drawer = false;
      ddlb_lock = false;

      fx.enterFx = () => {
        // check whether drawer is open
        if (action_drawer) acceptScores();
      };

      removeWinner();
      configureScoreSelectors();

      let winner = determineWinner(!grouped);
      set_number = winner !== undefined ? set_scores.length : Math.max(0, set_scores.length - 1);

      if (
        existing_scores &&
        (Object.keys(existing_scores).length ||
          existing_scores.length ||
          existing_scores.walkover ||
          existing_scores.default)
      ) {
        let last_set = set_scores.length ? set_scores[set_scores.length - 1] : undefined;
        if (set_scores.interrupted) {
          sobj.p1action.ddlb.setValue(' ');
          sobj.p2action.ddlb.setValue('interrupted');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(true);
          if (last_set && scoreGoal(last_set[0].games, last_set[1].games)) {
            set_number += 1;
          }
        } else if (set_scores.abandoned) {
          sobj.p1action.ddlb.setValue(' ');
          sobj.p2action.ddlb.setValue('abandoned');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(true);
        } else if (set_scores.cancelled) {
          sobj.p1action.ddlb.setValue(' ');
          sobj.p2action.ddlb.setValue('cancelled');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(true);
        } else if (set_scores.incomplete) {
          sobj.p1action.ddlb.setValue(' ');
          sobj.p2action.ddlb.setValue('incomplete');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(true);
          if (last_set && scoreGoal(last_set[0].games, last_set[1].games)) {
            set_number += 1;
          }
        } else if (set_scores.live) {
          sobj.p1action.ddlb.setValue(' ');
          sobj.p2action.ddlb.setValue('live');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(true);
          if (last_set && scoreGoal(last_set[0].games, last_set[1].games)) {
            set_number += 1;
          }
          current_state.auto_score = false;
        } else if (set_scores.retired) {
          let retired = existing_scores.winner_index !== undefined ? 1 - existing_scores.winner_index : undefined;
          sobj.p1action.ddlb.setValue(retired === 0 ? 'retired' : 'winner');
          sobj.p2action.ddlb.setValue(retired === 1 ? 'retired' : 'winner');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(false);
          setWinner(1 - retired);
        } else if (set_scores.time) {
          let time = existing_scores.winner_index !== undefined ? 1 - existing_scores.winner_index : undefined;
          sobj.p1action.ddlb.setValue(time === 0 ? 'time' : 'winner');
          sobj.p2action.ddlb.setValue(time === 1 ? 'time' : 'winner');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(false);
          setWinner(1 - time);
        } else if (set_scores.default) {
          let defaulted = existing_scores.winner_index !== undefined ? 1 - existing_scores.winner_index : undefined;
          sobj.p1action.ddlb.setValue(defaulted === 0 ? 'defaulted' : 'winner');
          sobj.p2action.ddlb.setValue(defaulted === 1 ? 'defaulted' : 'winner');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(false);
          setWinner(1 - defaulted);
        } else if (set_scores.walkover) {
          let walkedover = existing_scores.winner_index !== undefined ? 1 - existing_scores.winner_index : undefined;
          sobj.p1action.ddlb.setValue(walkedover === 0 ? 'walkover' : 'winner');
          sobj.p2action.ddlb.setValue(walkedover === 1 ? 'walkover' : 'winner');
          sobj.p1action.ddlb.lock();
          sobj.p2action.ddlb.lock();
          displayActions(true);
          setWinner(1 - walkedover);
        } else {
          displayActions(false);
        }
      } else {
        sobj.p1action.ddlb.setValue(' ');
        sobj.p2action.ddlb.setValue(' ');
      }

      // now populate with any existing score
      if (set_scores.time || set_scores.retired || set_scores.default || set_scores.walkover) {
        set_number = undefined;
      }
      setScoreDisplay({ selected_set: set_number, actions: !grouped });
    }

    function removeWinner() {
      let elements = Array.from(sobj.root.element.querySelectorAll(`.victor`));
      elements.forEach((el) => el.classList.remove('victor'));
      if (!lock) resetActions();
    }

    function setWinner(index) {
      let elements = Array.from(sobj.root.element.querySelectorAll(`.opponent${index}`));
      elements.forEach((el) => el.classList.add('victor'));
      let checkmarks = Array.from(sobj.root.element.querySelectorAll(`.opponent${index} .hasvalue`));
      checkmarks.forEach((el) => el.classList.add('victor'));
    }

    function clearScores() {
      removeWinner();
      set_number = 0;
      set_scores = [];
      resetTiebreak();
      unlockScoreboard();
      configureScoreSelectors();
      fx.enterFx = undefined;
      sobj.p2action.ddlb.setValue(' ');
      sobj.p1action.ddlb.setValue(' ');
      current_state.auto_score = settings.auto_score;
      setScoreDisplay({ selected_set: set_number });
    }

    function scoringComplete(outcome) {
      let match_format_object = {
        bestOf: max_sets,
        setFormat: {
          setTo: games_for_set,
          tiebreakAt: tiebreaks_at,
          tiebreakFormat: { tiebreakTo: tiebreak_to },
        },
      };
      if (final_set_supertiebreak) {
        match_format_object.finalSetFormat = {
          tiebreakSet: { tiebreakTo: supertiebreak_to },
        };
      }
      const matchUpFormat = matchUpFormatCode.stringify(match_format_object);
      if (outcome) {
        const sets = set_scores.map((ss, i) =>
          tools.definedAttributes({
            side1TiebreakScore: ss[0].supertiebreak,
            side2TiebreakScore: ss[1].supertiebreak,
            side1score: ss[0].games,
            side2score: ss[1].games,
            setNumber: i + 1,
          }),
        );
        outcome.sets = sets;
        outcome.set_scores = set_scores;
        outcome.matchUpFormat = matchUpFormat;
      }

      if (outcome && typeof callback === 'function') {
        callback(outcome);
      }

      fx.numericFx = undefined;
      fx.enterFx = undefined;
      document.body.style.overflow = null;
      closeModal();
    }

    function acceptScores() {
      fx.numericFx = undefined;
      fx.enterFx = undefined;
      determineWinner();
      scoringComplete(getScore());
    }

    function configureActionButtons() {
      sobj.cancel.element.addEventListener('click', () => scoringComplete(), false);
      sobj.accept.element.addEventListener('click', acceptScores, false);
      sobj.clear.element.addEventListener('click', clearScores, false);
      sobj.scoring.element.addEventListener('click', toggleScoring, false);

      function toggleScoring() {
        // if (lock) return;
        // if (action_drawer) return;
        let visible = sobj.scoring.element.innerHTML === '-';

        // hide overflow before toggle transition starts
        if (!visible) sobj.edit_scoring.element.style.overflow = 'hidden';

        // set toggle icon
        sobj.scoring.element.innerHTML = visible ? '&#x25A2;' : '-';

        toggleVisible(sobj.edit_scoring.element, visible);
      }
      function toggleVisible(element, visible) {
        let duration = 800;
        visibilityToggle({
          elem: element,
          type: 'edit',
          height: 100,
          visible,
          duration,
        });
        if (visible) {
          // make overflow visible after toggle transition has completed
          setTimeout(function () {
            element.style.overflow = 'visible';
          }, duration);
        }
      }
    }

    function configureScoreSelectors() {
      let options = [{ key: '-', value: '' }];
      let upper_range = games_for_set === tiebreaks_at ? games_for_set + 2 : games_for_set + 1;
      tools.generateRange(0, upper_range).forEach((n) => options.push({ key: n, value: n }));

      let scoreChange1 = (value) => scoreChange(0, value);
      let scoreChange2 = (value) => scoreChange(1, value);
      dd.attachDropDown({ id: sobj.p1selector.id, options, border: false });
      dd.attachDropDown({ id: sobj.p2selector.id, options, border: false });
      sobj.p1selector.ddlb = new dd.DropDown({
        element: sobj.p1selector.element,
        onChange: scoreChange1,
        id: sobj.p1selector.id,
        value_attribute: false,
      });
      sobj.p2selector.ddlb = new dd.DropDown({
        element: sobj.p2selector.element,
        onChange: scoreChange2,
        id: sobj.p2selector.id,
        value_attribute: false,
      });
      if (lock) {
        sobj.p1selector.ddlb.lock();
        sobj.p2selector.ddlb.lock();
      }
      sobj.p1selector.ddlb.selectionBackground();
      sobj.p2selector.ddlb.selectionBackground();

      let keypresstime;
      fx.numericFx = (key, position = 0) => {
        keypresstime = new Date().getTime();
        if (sobj.p1tiebreak.element.style.display === 'none' && key < upper_range) {
          if (position) {
            sobj.p1selector.ddlb.setValue(key);
          } else {
            sobj.p2selector.ddlb.setValue(key);
          }
          scoreChange(1 - position, key);
        } else {
          setTimeout(function () {
            hitReturn();
          }, AUTORETURN);
        }
      };

      function hitReturn() {
        let elapsed = new Date().getTime() - keypresstime;
        if (elapsed > AUTORETURN) {
          let t1 = +sobj.p1tiebreak.element.value;
          let t2 = +sobj.p2tiebreak.element.value;

          if (t1 != '' || t2 != '') {
            if (supertiebreak) {
              superTiebreakSet(t1, t2, true);
            } else {
              normalSetTiebreak(t1, t2, true);
            }
          }
        }
      }
    }

    function configureOutcomeSelectors() {
      let actions = [
        { key: ' ', value: '' },
        { key: '-', value: ' ' },
        { key: 'RET.', value: 'retired' },
        { key: 'TIME', value: 'time' },
        { key: 'W.O.', value: 'walkover' },
        { key: 'DEF.', value: 'defaulted' },
        { key: 'INT.', value: 'interrupted' },
        { key: 'INC.', value: 'incomplete' },
        { key: 'CCL', value: 'cancelled' },
        { key: 'ABD', value: 'abandoned' },
        { key: 'LIVE', value: 'live' },
        {
          key: `<div class='link'><img src='${completedMatch}' class='completed_icon'></div>`,
          value: 'winner',
        },
      ];
      let outcomeChange1 = (value) => outcomeChange(0, value);
      let outcomeChange2 = (value) => outcomeChange(1, value);
      dd.attachDropDown({
        id: sobj.p1action.id,
        options: actions,
        border: false,
        floatleft: true,
      });
      dd.attachDropDown({
        id: sobj.p2action.id,
        options: actions,
        border: false,
        floatleft: true,
      });
      sobj.p1action.ddlb = new dd.DropDown({
        element: sobj.p1action.element,
        onChange: outcomeChange1,
        id: sobj.p1action.id,
      });
      sobj.p2action.ddlb = new dd.DropDown({
        element: sobj.p2action.element,
        onChange: outcomeChange2,
        id: sobj.p2action.id,
      });
      if (lock) {
        sobj.p1action.ddlb.lock();
        sobj.p2action.ddlb.lock();
      }
      sobj.p1action.ddlb.selectionBackground();
      sobj.p2action.ddlb.selectionBackground();
    }

    function configureTiebreakEntry() {
      let tiebreakEntry1 = (event) => tiebreakEntry(event, 0);
      let tiebreakEntry2 = (event) => tiebreakEntry(event, 1);
      sobj.p1tiebreak.element.addEventListener('keyup', tiebreakEntry1, false);
      sobj.p2tiebreak.element.addEventListener('keyup', tiebreakEntry2, false);
    }

    function tiebreakEntry(event, which, force) {
      let t1 = +sobj.p1tiebreak.element.value;
      let t2 = +sobj.p2tiebreak.element.value;

      if ((event.which === 13 || force) && (t1 != '' || t2 != '')) {
        if (supertiebreak) {
          superTiebreakSet(t1, t2, true);
        } else {
          normalSetTiebreak(t1, t2, true);
        }
      }

      let value = sobj[which ? 'p2tiebreak' : 'p1tiebreak'].element.value.match(/-?\d+\.?\d*/);

      // don't allow numbers with more than 2 digits
      let numeric = value && !isNaN(value[0]) ? parseInt(value[0].toString().slice(-2)) : undefined;

      let tbgoal = supertiebreak ? supertiebreak_to : tiebreak_to;
      let complement = numeric === undefined || numeric == '' || numeric + 2 < tbgoal ? tbgoal : numeric + 2;

      sobj[which ? 'p2tiebreak' : 'p1tiebreak'].element.value = numeric !== undefined ? numeric : '';

      // if irregularWinner then don't set complement
      if (current_state.auto_score && !irregularWinner())
        sobj[which ? 'p1tiebreak' : 'p2tiebreak'].element.value = complement;
    }

    function normalSetTiebreak(t1, t2, submit) {
      let total_sets = set_scores.length;
      let which_set = total_sets > set_number ? total_sets - 1 : set_number - 1;
      if (!set_scores?.[which_set]) return;
      set_scores[which_set][0][t1 < t2 ? 'tiebreak' : 'spacer'] = t1 < t2 ? t1 : t2;
      set_scores[which_set][1][t2 < t1 ? 'tiebreak' : 'spacer'] = t2 < t1 ? t2 : t1;
      if (submit) submitTiebreak();
    }

    function superTiebreakSet(t1, t2, submit) {
      if (t1 < supertiebreak_to && t2 < supertiebreak_to) {
        return;
      }
      let set = [{ supertiebreak: t1 }, { supertiebreak: t2 }];
      let which_set = set_scores.length;

      if (which_set && set_scores[which_set - 1][0].supertiebreak !== undefined) {
        // if the last set was a supertiebreak, replace previous supertiebreak
        set_scores[which_set - 1] = set;
      } else {
        // otherwise add supertiebreak score
        set_scores.push(set);
      }
      if (submit) submitTiebreak();
    }

    function submitTiebreak() {
      resetTiebreak();
      if (determineWinner() !== undefined) displayActions(true);
      setScoreDisplay({ selected_set: set_number });
    }

    function scoreGoal(s1, s2) {
      let score_diff = Math.abs(s1 - s2);

      // if there is no tiebreaks_at value and one of the players reaches games_for_set
      if (!tiebreaks_at && (+s1 === games_for_set || +s2 === games_for_set)) return true;

      // any valid winning score that does not indicate a tiebreak
      return score_diff >= 2 && (+s1 >= games_for_set || +s2 >= games_for_set);
    }

    function tbScore(s1, s2) {
      if (!tiebreaks_at) return false;
      return (+s1 === tiebreaks_at + 1 && +s2 === tiebreaks_at) || (+s1 === tiebreaks_at && +s2 === tiebreaks_at + 1);
    }

    function scoreChange(which, value) {
      if (value === '') {
        sobj.p1selector.ddlb.setValue('');
        sobj.p2selector.ddlb.setValue('');
        set_scores[set_number] = [{ games: 0 }, { games: 0 }];
        return;
      }
      if (interrupted()) resetActions();
      let tiebreak = false;
      resetTiebreak();

      // if a final set score is being modified
      // for instance to change to an interrupted score...
      // only possible to change the final set...
      if (declaredWinner()) {
        set_number = set_scores.length - 1;
        sobj.p1action.ddlb.setValue(' ');
        sobj.p2action.ddlb.setValue(' ');
        unlockScoreboard();
      }

      let p1 = sobj.p1selector.ddlb.getValue();
      let p2 = sobj.p2selector.ddlb.getValue();

      if (current_state.auto_score) {
        if (which === 0 && p2 === '') {
          p2 = getComplement(value);
          sobj.p2selector.ddlb.setValue(p2);
        } else if (which === 1 && p1 === '') {
          p1 = getComplement(value);
          sobj.p1selector.ddlb.setValue(p1);
        } else if (!tiebreaks_at) {
          if (+p1 === games_for_set && +p2 === games_for_set) replaceValue(games_for_set - 1);
        } else {
          if (+p1 === tiebreaks_at + 1 && +p2 === tiebreaks_at + 1) replaceValue(tiebreaks_at);
          if (+p1 === tiebreaks_at + 1 && +p2 < tiebreaks_at - 1) {
            replaceValue(tiebreaks_at);
          }
          if (+p2 === tiebreaks_at + 1 && +p1 < tiebreaks_at - 1) {
            replaceValue(tiebreaks_at);
          }
        }
      } else if (which === 0 && !p2) {
        p2 = 0;
        sobj.p2selector.ddlb.setValue(p2);
      } else if (which === 1 && !p1) {
        p1 = 0;
        sobj.p1selector.ddlb.setValue(p1);
      }

      // set_scores[set_number] = [{ games: p1 }, { games: p2 }];
      set_scores[set_number] = [{ games: numParseInt(p1) || 0 }, { games: numParseInt(p2) || 0 }];

      if (!scoreGoal(p1, p2) && !tbScore(p1, p2)) {
        set_scores = set_scores.slice(0, set_number + 1);
        setScoreDisplay({ selected_set: set_number });
        // let w = determineWinner();
        // if (!w) displayActions(false);
      } else {
        if (tbScore(p1, p2)) tiebreak = true;
        determineWinner();
        nextSet(p1, p2, tiebreak);
      }

      function replaceValue(new_value) {
        if (which) {
          p1 = new_value;
          sobj.p1selector.ddlb.setValue(p1);
        } else {
          p2 = new_value;
          sobj.p2selector.ddlb.setValue(p2);
        }
      }

      function getComplement(value) {
        if (value === '') return '';
        if (!tiebreaks_at) {
          if (+value === games_for_set) return games_for_set - 1;
          if (+value === games_for_set - 1) return games_for_set;
          return games_for_set;
        } else {
          if (+value === tiebreaks_at || +value === tiebreaks_at + 1) tiebreak = true;
          if (+value === tiebreaks_at - 1 || +value === tiebreaks_at) return parseInt(tiebreaks_at || 0) + 1;
          if (+value < tiebreaks_at) return games_for_set;
          return tiebreaks_at;
        }
      }
    }

    function nextSet(p1, p2, tiebreak) {
      if (tiebreak && !lock) {
        sobj.p1tiebreak.element.style.display = 'inline';
        sobj.p2tiebreak.element.style.display = 'inline';
        sobj[p1 > p2 ? 'p1tiebreak' : 'p2tiebreak'].element.disabled = true;
        sobj[p1 > p2 ? 'p2tiebreak' : 'p1tiebreak'].element.disabled = false;
        sobj[p1 > p2 ? 'p2tiebreak' : 'p1tiebreak'].element.focus();
        displayActions(false);
      }
      // check that both values are numeric
      let numbers = p1 !== '' && p2 !== '';

      // check if there is a winner
      let no_winner = determineWinner() === undefined && irregularWinner() === undefined;

      // only advance to the next set if match and prior set meets all criteria
      if (numbers && no_winner && set_number + 1 < max_sets) set_number += 1;

      setScoreDisplay({ selected_set: set_number, tiebreak });
    }

    function declaredWinner() {
      let s1 = sobj.p1action.ddlb.getValue();
      let s2 = sobj.p2action.ddlb.getValue();
      return s1 === 'winner' || s2 === 'winner';
    }

    function irregularEnding() {
      let s1 = sobj.p1action.ddlb.getValue();
      let s2 = sobj.p2action.ddlb.getValue();

      if (
        ['cancelled', 'incomplete', 'abandoned'].indexOf(s1) >= 0 ||
        ['cancelled', 'incomplete', 'abandoned'].indexOf(s2) >= 0
      )
        return false;
    }

    function irregularWinner() {
      let s1 = sobj.p1action.ddlb.getValue();
      let s2 = sobj.p2action.ddlb.getValue();

      if (['time', 'retired', 'defaulted', 'walkover'].indexOf(s1) >= 0) return 0;
      if (['time', 'retired', 'defaulted', 'walkover'].indexOf(s2) >= 0) return 1;
      return undefined;
    }

    function interrupted() {
      let s1 = sobj.p1action.ddlb.getValue();
      let s2 = sobj.p2action.ddlb.getValue();

      return ['interrupted'].indexOf(s1) >= 0 || ['interrupted'].indexOf(s2) >= 0;
    }

    function live() {
      let s1 = sobj.p1action.ddlb.getValue();
      let s2 = sobj.p2action.ddlb.getValue();

      return ['live'].indexOf(s1) >= 0 || ['live'].indexOf(s2) >= 0;
    }

    function resetActions() {
      if (!live()) {
        sobj.p1action.ddlb.setValue(' ');
        sobj.p2action.ddlb.setValue(' ');
      }
      sobj.p1action.ddlb.unlock();
      sobj.p2action.ddlb.unlock();
    }

    function setsWon() {
      if (!set_scores.length) return [0, 0];
      let totals = set_scores.map((sc) => {
        let g0 = isNaN(sc[0].games) ? sc[0].games : +sc[0].games;
        let g1 = isNaN(sc[1].games) ? sc[1].games : +sc[1].games;
        if (g0 !== undefined && g1 !== undefined && g0 !== '' && g1 !== '') {
          // if .games attribute present, then normal set
          // if tiebreak score, check that there is a tiebreak value
          if (tbScore(g0, g1) && sc[0].tiebreak === undefined && sc[1].tiebreak === undefined) return [0, 0];

          // if minimum score difference not met (or games_for_set exceeded) there is no winner
          // if there is no tiebreaks_at value then the first player to games_for_set value is the winner
          const side1tbWin = +g0 === games_for_set && +g0 === +g1 + 1;
          const side2tbWin = +g1 === games_for_set && +g1 === +g0 + 1;
          if (!tiebreaks_at) {
            if (+g0 === games_for_set && +g0 === +g1 + 1) return [1, 0];
            if (+g1 === games_for_set && +g1 === +g0 + 1) return [0, 1];
          } else if (!tiebreaks_at || games_for_set === tiebreaks_at) {
            if (side1tbWin) return [0, 0];
            if (+g1 === games_for_set && +g1 === +g0 + 1) return [0, 0];
          } else {
            if (side1tbWin) return [1, 0];
            if (side2tbWin) return [0, 1];
          }

          // otherwise set winner determined by greater score at least games_for_set
          if (g0 > g1 && g0 >= games_for_set) return [1, 0];
          if (g1 > g0 && g1 >= games_for_set) return [0, 1];
        } else if (sc[0].supertiebreak !== undefined && sc[1].supertiebreak !== undefined) {
          if (sc[0].supertiebreak > sc[1].supertiebreak + 1 && sc[0].supertiebreak >= supertiebreak_to) return [1, 0];
          if (sc[1].supertiebreak > sc[0].supertiebreak + 1 && sc[1].supertiebreak >= supertiebreak_to) return [0, 1];
        }
        return [0, 0];
      });
      return totals.reduce((a, b) => [a[0] + b[0], a[1] + b[1]]);
    }

    function determineWinner(actions = true) {
      if (!set_scores.length) return undefined;

      let sets_won = setsWon();

      // if an equivalent # of sets have been won, no winner
      if (
        +sets_won[0] === +sets_won[1] &&
        !live() &&
        !interrupted() &&
        !irregularEnding() &&
        irregularWinner() === undefined
      ) {
        // displayActions(false);
        return;
      }

      let max_sets_won = Math.max(...sets_won);
      let needed_to_win = Math.max(sets_to_win, Math.floor(set_scores.length / 2) + 1);

      // if # of sets won is less than or equal to half the number of sets, then no winner;
      if (max_sets_won < needed_to_win) return;

      const winningSide = (sets_won[0] >= needed_to_win && 1) || (sets_won[1] >= needed_to_win ? 2 : undefined);
      if (
        winningSide === undefined &&
        !live() &&
        !interrupted() &&
        !irregularEnding() &&
        irregularWinner() === undefined
      ) {
        displayActions(false);
        return;
      }

      if (sobj.p1tiebreak.element.style.display !== 'inline' && actions) {
        displayActions(true);
      }
      sobj[winningSide === 1 ? 'p1action' : 'p2action'].ddlb.setValue('winner');
      sobj[winningSide === 2 ? 'p1action' : 'p2action'].ddlb.setValue('');
      sobj[winningSide === 2 ? 'p1action' : 'p2action'].ddlb.lock();

      setWinner(winningSide - 1);

      // insure entire score is displayed
      set_number = set_scores.length;

      // because winner is 0/1 whereas winningSide is 1/2
      return winningSide - 1;
    }

    function existingSuperTiebreak(selected_set) {
      let total_sets = set_scores.length;
      let last_set = +selected_set === set_scores.length - 1;
      let existing_supertiebreak = last_set && total_sets && set_scores[total_sets - 1][0].supertiebreak !== undefined;
      return existing_supertiebreak ? set_scores[total_sets - 1] : false;
    }

    function setIsSuperTiebreak(selected_set, actions) {
      if (!final_set_supertiebreak) return false;

      let winner = determineWinner(actions);
      if (winner !== undefined && existingSuperTiebreak(selected_set)) return true;
      return isFinalSet(selected_set);
    }

    function isFinalSet(selected_set) {
      let sets_won = setsWon();
      let tied_sets = +sets_won[0] === +sets_won[1] && +sets_won[0] + 1 === sets_to_win;
      if (tied_sets && +selected_set === +set_scores.length) return true;
    }

    function gameEdit(selected_set, tiebreak, actions) {
      if (tiebreak) return false;
      if (ddlb_lock) return false;
      if (selected_set === undefined) return false;
      if (set_scores.length === 0) return true;

      let winner = determineWinner(actions) !== undefined || irregularWinner() !== undefined;
      return !(winner && (selected_set === undefined || +selected_set === set_scores.length));
    }

    function setScoreDisplay({ selected_set, tiebreak, actions }) {
      supertiebreak = setIsSuperTiebreak(selected_set, actions);

      let game_edit = gameEdit(selected_set, tiebreak || supertiebreak, actions);

      // insure that the value is numeric
      if (!game_edit && !supertiebreak) selected_set = set_scores.length;
      set_number = Math.min(max_sets - 1, +selected_set);

      if (game_edit) resetTiebreak();

      if (supertiebreak && !lock) {
        let final = isFinalSet(selected_set);

        sobj.p1tiebreak.element.style.display = 'inline';
        sobj.p2tiebreak.element.style.display = 'inline';
        sobj.p1tiebreak.element.disabled = false;
        sobj.p2tiebreak.element.disabled = false;

        if (!final) {
          sobj.p1action.ddlb.setValue(' ');
          sobj.p2action.ddlb.setValue(' ');
          displayActions(false);
        }

        let existing_supertiebreak = existingSuperTiebreak(selected_set);
        if (existing_supertiebreak) {
          sobj.p1tiebreak.element.value = existing_supertiebreak[0].supertiebreak;
          sobj.p2tiebreak.element.value = existing_supertiebreak[1].supertiebreak;
        }
      }

      let this_set = set_scores[selected_set];
      // before is all sets before current entry, or all sets if scoreboard locked
      let before = lock ? set_scores : set_scores.slice(0, +selected_set);
      let after = set_scores.slice(+selected_set + 1);

      if (lock && !set_scores.length) {
        before = [[{ games: 0 }, { games: 0 }]];
      }

      let p1scores = before.map((s, i) => setScore({ setnum: i, score: s[0] })).join('');
      let p2scores = before.map((s, i) => setScore({ setnum: i, score: s[1] })).join('');
      sobj.p1scores.element.innerHTML = p1scores;
      sobj.p2scores.element.innerHTML = p2scores;

      // .games value must be coerced into a string
      sobj.p1selector.ddlb.setValue(this_set ? this_set[0].games + '' : '');
      sobj.p2selector.ddlb.setValue(this_set ? this_set[1].games + '' : '');
      // selectors won't be shown if scoreboard is loacked or ddlb is locked or editing tiebreak (!game_edit)
      sobj.p1selector.element.style.display = game_edit && !ddlb_lock && !lock ? 'flex' : 'none';
      sobj.p2selector.element.style.display = game_edit && !ddlb_lock && !lock ? 'flex' : 'none';

      p1scores = after.map((s, i) => setScore({ setnum: +selected_set + 1 + i, score: s[0] })).join('');
      p2scores = after.map((s, i) => setScore({ setnum: +selected_set + 1 + i, score: s[1] })).join('');
      sobj.p1scores_e.element.innerHTML = p1scores;
      sobj.p2scores_e.element.innerHTML = p2scores;
    }

    function getScore() {
      const s1 = sobj.p1action.ddlb.getValue();
      const s2 = sobj.p2action.ddlb.getValue();

      const winningSide = (s1 === 'winner' && 1) || (s2 === 'winner' && 2) || undefined;
      let complete = [1, 2].includes(winningSide);

      let score = set_scores
        .map((s) => {
          if (s[0].supertiebreak) {
            return `[${s[0].supertiebreak}-${s[1].supertiebreak}]`;
          }
          let t1 = s[0].tiebreak;
          let t2 = s[1].tiebreak;
          // TODO: copy how reverseScore works in case of unfinished tiebreak
          let tiebreak = t1 !== undefined || t2 !== undefined ? `(${[t1, t2].filter((f) => f >= 0).join('-')})` : '';
          return `${s[0].games}-${s[1].games}${tiebreak}`;
        })
        .join(' ');

      let matchUpStatus;
      if ([1, 2].includes(winningSide)) {
        matchUpStatus = 'COMPLETED';
      }
      if (s1 === 'retired' || s2 === 'retired') {
        matchUpStatus = 'RETIRED';
      }
      if (s1 === 'time' || s2 === 'time') score += ' TIME';
      if (s1 === 'walkover' || s2 === 'walkover') {
        matchUpStatus = 'WALKOVER';
        complete = true;
      }
      if (s1 === 'defaulted' || s2 === 'defaulted') {
        matchUpStatus = 'DEFAULTED';
        complete = true;
      }
      if (s1 === 'abandoned' || s2 === 'abandoned') {
        matchUpStatus = 'ABANDONED';
        complete = true;
        score = '';
      }
      if (s1 === 'interrupted' || s2 === 'interrupted') {
        matchUpStatus = 'SUSPENDED';
        complete = false;
      }
      if (s1 === 'live' || s2 === 'live') {
        matchUpStatus = 'IN_PROGRESS';
        complete = false;
      }
      if (s1 === 'cancelled' || s2 === 'cancelled') {
        matchUpStatus = 'CANCELLED';
        complete = false;
      }
      if (s1 === 'incomplete' || s2 === 'incomplete') {
        matchUpStatus = 'ABANDONED';
        complete = false;
      }

      return {
        matchUpStatus,
        winningSide,
        complete,
        score,
      };
    }

    function unlockScoreboard() {
      ddlb_lock = false;
      sobj.p1selector.ddlb.unlock();
      sobj.p2selector.ddlb.unlock();
      sobj.p1action.ddlb.unlock();
      sobj.p2action.ddlb.unlock();
    }

    function resetTiebreak() {
      sobj.p1tiebreak.element.value = '';
      sobj.p2tiebreak.element.value = '';
      sobj.p1tiebreak.element.style.display = 'none';
      sobj.p2tiebreak.element.style.display = 'none';
    }

    function outcomeChange(which, value) {
      let p1 = sobj.p1action.ddlb.getValue();
      let p2 = sobj.p2action.ddlb.getValue();
      let winner = determineWinner();
      let other = which ? p1 : p2;

      current_state.auto_score = settings.auto_score;
      if (value === '') {
        // unselecting winner clears the scoreboard
        if (winner !== undefined) {
          set_scores = [];
          set_number = 0;
          sobj[which ? 'p2action' : 'p1action'].ddlb.setValue(' ');
        }
        sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(' ');
        // displayActions(false);
        unlockScoreboard();

        let sets = set_scores.length;
        if (sets) {
          let ls = set_scores[sets - 1];
          if (!tbScore(ls[0].games, ls[1].games) && !scoreGoal(ls[0].games, ls[1].games)) {
            set_number = sets - 1;
          }
        }

        setScoreDisplay({ selected_set: set_number });
      } else if (['interrupted', 'cancelled', 'incomplete', 'abandoned'].indexOf(value) >= 0) {
        sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(' ');
        setScoreDisplay({ selected_set: set_number });
        displayActions(true);
      } else if (value === 'live') {
        current_state.auto_score = false;
        sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(' ');
        setScoreDisplay({ selected_set: set_number });
        // ddlb_lock = true;
        // sobj.p1selector.ddlb.lock();
        // sobj.p2selector.ddlb.lock();
        displayActions(true);
      } else if (value === 'winner' && other === 'winner') {
        if (winner === undefined) {
          sobj[which ? 'p1action' : 'p2action'].ddlb.setValue('retired');
        }
        setScoreDisplay({ selected_set: set_number });
        displayActions(true);
      } else if (['time', 'retired', 'walkover', 'defaulted'].indexOf(value) >= 0) {
        displayActions(true);
        if (winner !== undefined) {
          // score-based winner, so disallow setting opponent as ret, def, w.o.
          sobj[winner ? 'p2action' : 'p1action'].ddlb.setValue('winner');
          sobj[winner ? 'p1action' : 'p2action'].ddlb.setValue(' ');
          sobj[winner ? 'p2action' : 'p1action'].ddlb.unlock();
          sobj[winner ? 'p1action' : 'p2action'].ddlb.lock();
        } else {
          // if tiebreak enable both entry fields
          sobj.p1tiebreak.element.disabled = false;
          sobj.p2tiebreak.element.disabled = false;

          sobj[which ? 'p1action' : 'p2action'].ddlb.setValue('winner');
          sobj[which ? 'p1action' : 'p2action'].ddlb.unlock();
          sobj[which ? 'p2action' : 'p1action'].ddlb.lock();

          // ddlb_lock = true;
          // sobj.p1selector.ddlb.lock();
          // sobj.p2selector.ddlb.lock();

          if (value === 'time' || value === 'retired' || value === 'defaulted') {
            if (winner !== undefined) sobj[which ? 'p2action' : 'p1action'].ddlb.setValue(' ');
            set_number = set_scores.length;
          }
          if ((value === 'time' || value === 'retired') && !set_scores.length)
            sobj[which ? 'p2action' : 'p1action'].ddlb.setValue('walkover');
          if (value === 'walkover') {
            set_scores = [];
            set_number = 0;
          }
          setScoreDisplay({ selected_set: set_number });
        }
      } else if (value === 'winner') {
        if (winner === undefined) {
          sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(set_scores.length ? 'retired' : 'walkover');
        } else {
          sobj[which ? 'p1action' : 'p2action'].ddlb.setValue(' ');
        }
        sobj[which ? 'p1action' : 'p2action'].ddlb.lock();

        ddlb_lock = true;
        sobj.p1selector.ddlb.lock();
        sobj.p2selector.ddlb.lock();
        setScoreDisplay({ selected_set: set_number });
      }
    }

    // TODO: replace with configureScoring module?
    function configureScoring({ sobj, changeFx }) {
      dd.attachDropDown({
        id: sobj.bestof.id,
        options: numericOptions(options.bestof),
      });
      sobj.bestof.ddlb = new dd.DropDown({
        element: sobj.bestof.element,
        id: sobj.bestof.id,
        onChange: setBestOf,
      });
      sobj.bestof.ddlb.setValue(max_sets, 'white');

      dd.attachDropDown({
        id: sobj.setsto.id,
        options: numericOptions(options.setsto),
      });
      sobj.setsto.ddlb = new dd.DropDown({
        element: sobj.setsto.element,
        id: sobj.setsto.id,
        onChange: setsTo,
      });
      sobj.setsto.ddlb.setValue(games_for_set, 'white');

      let gfs = games_for_set;
      let tbat_options = tiebreakAtOptions(gfs);
      dd.attachDropDown({
        id: sobj.tiebreaksat.id,
        options: tbat_options,
      });
      sobj.tiebreaksat.ddlb = new dd.DropDown({
        element: sobj.tiebreaksat.element,
        id: sobj.tiebreaksat.id,
        onChange: setTiebreakAt,
      });
      sobj.tiebreaksat.ddlb.setValue(tiebreaks_at && tiebreaks_at < gfs ? tiebreaks_at : gfs, 'white');
      sobj.tiebreaksat.ddlb.setValue(tiebreaks_at || '', 'white');

      dd.attachDropDown({
        id: sobj.tiebreaksto.id,
        options: numericOptions(options.tiebreaksto),
      });
      sobj.tiebreaksto.ddlb = new dd.DropDown({
        element: sobj.tiebreaksto.element,
        id: sobj.tiebreaksto.id,
        onChange: setTiebreakTo,
      });
      sobj.tiebreaksto.ddlb.setValue(tiebreak_to, 'white');

      dd.attachDropDown({
        id: sobj.finalset.id,
        options: [
          { key: lang.tr('scoring.normal'), value: 'N' },
          { key: lang.tr('scoring.supertiebreak'), value: 'S' },
        ],
      });
      sobj.finalset.ddlb = new dd.DropDown({
        element: sobj.finalset.element,
        id: sobj.finalset.id,
        onChange: finalSet,
      });
      sobj.finalset.ddlb.selectionBackground();
      sobj.finalset.ddlb.setValue(final_set_supertiebreak ? 'S' : 'N', 'white');

      dd.attachDropDown({
        id: sobj.supertiebreakto.id,
        options: numericOptions(options.supertiebreakto),
      });
      sobj.supertiebreakto.ddlb = new dd.DropDown({
        element: sobj.supertiebreakto.element,
        id: sobj.supertiebreakto.id,
        onChange: superTiebreakTo,
      });
      sobj.supertiebreakto.ddlb.selectionBackground();
      sobj.supertiebreakto.ddlb.setValue(supertiebreak_to || 10, 'white');
      superTiebreakToOpacity(final_set_supertiebreak);

      function numericOptions(arr) {
        if (!arr || !Array.isArray(arr)) return {};
        return arr.map((a) => ({ key: a, value: a }));
      }

      function setBestOf(value) {
        max_sets = parseInt(value);
        sets_to_win = Math.ceil(value / 2);
        final_set_supertiebreak = false;
        sobj.finalset.ddlb.setValue('N', 'white');
        superTiebreakToOpacity(final_set_supertiebreak);
        if (typeof changeFx === 'function') changeFx();
      }

      function superTiebreakToOpacity(bool) {
        sobj.stb2.element.style.opacity = bool ? 1 : 0;
        sobj.supertiebreakto.element.style.opacity = bool ? 1 : 0;
      }

      function tiebreakAtOptions(gfs) {
        return [
          { key: lang.tr('none'), value: '' },
          { key: `${gfs - 1}-${gfs - 1}`, value: gfs - 1 },
          { key: `${gfs}-${gfs}`, value: gfs },
        ];
      }

      function setsTo(value) {
        games_for_set = parseInt(value);
        tiebreaks_at = parseInt(value);
        let tbat_options = tiebreakAtOptions(value);
        sobj.tiebreaksat.ddlb.setOptions(tbat_options);
        sobj.tiebreaksat.ddlb.setValue(value, 'white');
        if (typeof changeFx === 'function') changeFx();
      }

      function setTiebreakAt(value) {
        tiebreaks_at = parseInt(value);
        if (typeof changeFx === 'function') changeFx();
      }

      function setTiebreakTo(value) {
        tiebreak_to = parseInt(value);
        if (typeof changeFx === 'function') changeFx();
      }

      function finalSet(value) {
        supertiebreak_to = sobj.supertiebreakto.ddlb.getValue() || 10;
        final_set_supertiebreak = value === 'S' ? { tiebreakTo: supertiebreak_to } : false;
        superTiebreakToOpacity(final_set_supertiebreak);
        if (typeof changeFx === 'function') changeFx();
      }

      function superTiebreakTo(value) {
        supertiebreak_to = parseInt(value);
        if (typeof changeFx === 'function') changeFx();
      }
    }
  };

  return fx;
})();

function setScore({ setnum, score = { games: 0 } }) {
  let tiebreak = (score.tiebreak !== undefined && score.tiebreak) || (score.spacer !== undefined && score.spacer) || '';
  let setscore = score.supertiebreak !== undefined ? score.supertiebreak : score.games;

  return `
      <div class="set score set_number setClick" setnum="${setnum !== undefined ? setnum : ''}">
         <div class="setscore setClick">${setscore}</div>
         <div class="tbscore" ${score.spacer !== undefined ? 'style="opacity: 0"' : ''}>${tiebreak}</div>
      </div>
   `;
}

function matchStatus(match) {
  if (!match) return '';
  if (match.status) return match.status;
  if (!match.schedule) return '';

  // let today = new Date();
  // let mday = new Date(match.schedule.day);
  // let match_is_today = mday.getDay() === today.getDay() && mday.getMonth() === today.getMonth() && mday.getYear() === today.getYear();

  let duration = matchDuration(match.schedule);
  if (duration) return `Duration ${duration}`;

  let time = `${match.schedule.time_prefix || ''}${match.schedule.time || ''}`;
  let notice = `${match.schedule.court || ''}${time ? ' / ' + time : ''}`;

  return match.winner_index === undefined ? notice : '';
}

const HHMMSS = (s, format) => {
  let sec_num = parseInt(s, 10); // don't forget the second param
  let hours = Math.floor(sec_num / 3600);
  let minutes = Math.floor((sec_num - hours * 3600) / 60);
  let seconds = sec_num - hours * 3600 - minutes * 60;

  let display_seconds = !format || format?.display_seconds;
  let pad_hours = !format || format?.pad_hours;
  if (hours < 10 && pad_hours) {
    hours = '0' + hours;
  }
  if (minutes < 10) {
    minutes = '0' + minutes;
  }
  if (seconds < 10) {
    seconds = '0' + seconds;
  }
  return display_seconds ? hours + ':' + minutes + ':' + seconds : hours + ':' + minutes;
};

function matchDuration(schedule) {
  if (!schedule.start || !schedule.end) return '';

  let seconds = timeSeconds(schedule.end) - timeSeconds(schedule.start);
  return HHMMSS(seconds, { pad_hours: false, display_seconds: false });
}

function timeSeconds(time) {
  let split = time.split(':');
  return split[0] * 60 * 60 + split[1] * 60;
}
