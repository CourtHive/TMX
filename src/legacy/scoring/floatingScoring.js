import { openModal } from 'components/modals/baseModal/baseModal';
import { fixtures } from 'tods-competition-factory';
import { lang } from 'services/translator';
import { idObj } from 'services/dom/idObj';

export const floatingScoring = (function () {
  let fx = {};

  fx.display = ({ muid, teams }) => {
    let sb_ids = { scoreboard: 'sbId' };

    let { ids, html } = generateScoreBoard({ muid, teams });

    openModal({ content: html, config: { maxWidth: 450 } });

    Object.assign(ids, sb_ids);
    return idObj(ids);
  };

  function generateScoreBoard({ muid, teams, round_name, match }) {
    let ids = {
      root: 'sb-root',
      actions: 'sb-actions',
      favorite: 'sb-favorite',
      scoring: 'sb-scoring',
      delegate: 'sb-delegate',
      docs: 'sb-docs',
      clear: 'sb-clear',
      cancel: 'sb-cancel',
      accept: 'sb-accept',
      p1action: 'sb-p1action',
      p2action: 'sb-p2action',
      p1scores: 'sb-p1scores',
      p2scores: 'sb-p2score',
      round_name: 'sb-round-name',
      p1scores_e: 'sb-p1scores-e',
      p2scores_e: 'sb-p2scores-e',
      p1selector: 'sb-p1selector',
      p2selector: 'sb-p2selector',
      p1tiebreak: 'sb-p1tiebreak',
      p2tiebreak: 'sb-p2tiebreak',
      details: 'sb-details'
    };

    let config = scoreBoardConfig();
    Object.assign(ids, config.ids);

    let html = `
         <div id="${ids.root}" class="scoreboard noselect muid ${ids.root}" muid='${muid}'>
            <div class='scorebox'>
               <div class='info'>
                  <span class="info-text">
                     <span class="round_name" id='${ids.round_name}'>${round_name || ''}</span>
                  </span>
                  <div id='${ids.favorite}' class='fav favoriteMatch' style='display: none'></div>
                  <div id='${ids.scoring}' class='options' style='display: none'>-</div>
               </div>
               <div class='sbox'>
                  <div class='sbcol flexgrow'> 
                     <div class="opponent opponent0">
                        <div class="opponent-name">
                           <div class="name-detail">
                              ${scoreboardTeam({ team: teams[0], index: 0 })}
                              ${scoreboardTeam({ team: teams[0], index: 1 })}
                           </div>
                        </div>
                     </div>
               
                     <div class="opponent opponent1">
                        <div class="opponent-name">
                           <div class="name-detail">
                              ${scoreboardTeam({ team: teams[1], index: 0 })}
                              ${scoreboardTeam({ team: teams[1], index: 1 })}
                           </div>
                        </div>
                     </div>
                  </div>

                  <div class='sbcol'> 
                     <div class="opponent opponent0">
                        <div id="${ids.p1scores}" class="opponent-scores"></div>
                        <div id="${ids.p1selector}" class="score-selector"></div>
                        <div class="score-selector tbinput"> <input id="${ids.p1tiebreak}"> </div>
                        <div id="${ids.p1scores_e}" class="opponent-scores"></div>
                     </div>
               
                     <div class="opponent opponent1">
                        <div id="${ids.p2scores}" class="opponent-scores"></div>
                        <div id="${ids.p2selector}" class="score-selector"></div>
                        <div class="score-selector tbinput"> <input id="${ids.p2tiebreak}"> </div>
                        <div id="${ids.p2scores_e}" class="opponent-scores"></div>
                     </div>
                  </div>

                  <div class='sbcol'>
                     <div class="opponent opponent0">
                        <div id="${ids.p1action}" class="score-action"></div>
                     </div>
                     <div class="opponent opponent1">
                        <div id="${ids.p2action}" class="score-action"></div>
                     </div>
                  </div>

                  <div class='sbcol'>
                     <div class="opponent opponent0">&nbsp;</div>
                     <div class="opponent opponent1">&nbsp;</div>
                  </div>

               </div>
               <div class="info">
                  <span class="info-text"> <span id="${ids.details}" class="court">${matchStatus(match)}</span> </span>
                  <div id='${ids.delegate}' class='options' style='display: none'>&#x25B7;</div>
               </div>
            </div>

            ${config.html}

            <div id='${ids.actions}' class="scoreboard-action">
               <div class="edit flexcol">
                  <div class="frame">
                     <div class="scoreboard-actions">
                        <button id='${ids.cancel}' class='btn dismiss'>${lang.tr('actions.cancel')}</button>
                        <button id='${ids.clear}' class='btn dismiss'>${lang.tr('clr')}</button>
                        <button id='${ids.accept}' class='btn accept'>${lang.tr('apt')}</button>
                     </div>
                  </div>
               </div>
            </div>

         </div>
      `;

    return { ids, html };
  }

  function scoreBoardConfig() {
    let ids = {
      edit_scoring: 'sbcfg-edit',
      bestof: 'sbcfg-bestof',
      setsto: 'sbcfg-setsto',
      tiebreaksat: 'sbcfg-tiebreasat',
      tiebreaksto: 'sbcfg-tiebreaksto',
      finalset: 'sbcfg-finalset',
      supertiebreakto: 'sbcfg-supertbto',
      stb2: 'sbcfg-stb2'
    };
    let html = `
            <div id='${ids.edit_scoring}' class="scoreboard-config scoreboard-action">
               <div class="edit configure sb_flexrow">
                  <div class='flexcol' style='width: 25%'>
                     <div style='text-align: right'>${lang.tr('scoring_format.bestof')}</div>
                     <div style='text-align: right'>${lang.tr('scoring_format.tbat')}</div>
                     <div style='text-align: right'>${lang.tr('scoring_format.finalset')}</div>
                  </div>
                  <div class='flexcol' style='width: 25%'>
                     <div id="${ids.bestof}" class="score-selector"></div>
                     <div id="${ids.tiebreaksat}" class="score-selector"></div>
                     <div id="${ids.finalset}" class="score-selector"></div>
                  </div>
                  <div class='flexcol' style='width: 25%'>
                     <div style='text-align: right'>${lang.tr('scoring_format.setsto')}</div>
                     <div style='text-align: right'>${lang.tr('scoring_format.tbto')}</div>
                     <div id='${ids.stb2}' style='text-align: right'>${lang.tr('scoring_format.superto')}</div>
                  </div>
                  <div class='flexcol' style='width: 25%'>
                     <div id="${ids.setsto}" class="score-selector"></div>
                     <div id="${ids.tiebreaksto}" class="score-selector"></div>
                     <div id="${ids.supertiebreakto}" class="score-selector"></div>
                  </div>
               </div>
            </div>
      `;

    return { ids, html };
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

  function matchDuration(schedule) {
    if (!schedule.start || !schedule.end) return '';

    let seconds = timeSeconds(schedule.end) - timeSeconds(schedule.start);
    return HHMMSS(seconds, { pad_hours: false, display_seconds: false });
  }

  function scoreboardTeam({ team, index = 0 }) {
    if (index === 1) return '';
    const ioc = team.person?.nationalityCode;
    const iocFlag = ioc ? fixtures.countryToFlag(ioc)?.slice(0, 4) : '';
    return `
         <div class="team_player">
            <span class="pad">${iocFlag}</span>
            <span class="pad">${team.participantName}</span>
            <span class="pad"></span>
         </div>
      `;
  }

  function timeSeconds(time) {
    let split = time.split(':');
    return split[0] * 60 * 60 + split[1] * 60;
  }

  return fx;
})();
