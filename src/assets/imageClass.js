import locationIcon from './icons/geoloc.png';
import penaltyIcon from './icons/penalty.png';
import completedMatch from './icons/completed.png';
import tmxLogo from 'assets/images/orgLogo.png';

import keysBlack from './icons/keys.png';
import keysGreen from './icons/keys_green.png';
import keysBlue from './icons/keys_blue.png';

import dragMatch from './icons/dragmatch.png';

export const imageClass = (() => {
  let fx = {};

  let oneEm = { width: '1em' };
  fx.tmxLogo = () => <img src={tmxLogo} alt="tmx" />;
  fx.locationIcon = () => <img src={locationIcon} alt="location" />;
  fx.dragMatch = () => <img src={dragMatch} alt="match" />;
  fx.completedMatchIcon = () => <img class="completed_icon" src={completedMatch} alt="completed" />;
  fx.penaltyIcon = () => <img style={oneEm} src={penaltyIcon} alt="penalty" />;

  fx.keysIcon = () => <img src={keysBlack} alt="Keys" />;
  fx.authKeys = (authorized) => {
    if (authorized) return <img src={keysGreen} alt="Authorized" />;
    return <img src={keysBlue} alt="Authorized" />;
  };

  return fx;
})();
