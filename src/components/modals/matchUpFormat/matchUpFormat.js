import { downCaret as clickable } from 'assets/specialCharacters/openClose';
import { scoreGovernor } from 'tods-competition-factory';
import { tipster } from 'components/popovers/tipster';
import { openModal } from '../baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

import { NONE } from 'constants/tmxConstants';

const TIMED_SETS = 'Timed set';
const TIEBREAKS = 'Tiebreak';
const NOAD = 'No-Ad';
const SETS = 'Set';
const AD = 'Ad';

const format = {
  setFormat: {
    descriptor: 'Best of',
    bestOf: 3,
    advantage: AD,
    what: SETS,
    setTo: 6,
    tiebreakAt: 6,
    tiebreakTo: 7,
    winBy: 2,
    minutes: 10
  },
  finalSetFormat: {
    descriptor: 'Final set',
    bestOf: 3,
    advantage: AD,
    what: SETS,
    setTo: 6,
    tiebreakAt: 6,
    tiebreakTo: 7,
    winBy: 2,
    minutes: 10
  }
};

function getSetFormat(index) {
  const which = index ? 'finalSetFormat' : 'setFormat';
  const what = format[which].what;
  const setFormat = {
    setTo: format[which].setTo
  };
  if (what === SETS && format[which].advantage === NOAD) setFormat.NoAD = true;

  const hasTiebreak = what === SETS && document.getElementById(index ? 'finalSetTiebreak' : 'setTiebreak').checked;
  if (hasTiebreak) {
    setFormat.tiebreakAt = format[which].tiebreakAt;
    setFormat.tiebreakFormat = {
      tiebreakTo: format[which].tiebreakTo
    };
    if (what === SETS && format[which].winBy === 1) {
      setFormat.tiebreakFormat.NoAD = true;
    }
  }
  if (what === TIMED_SETS) {
    setFormat.minutes = format[which].minutes;
    setFormat.timed = true;
  }

  if (what === TIEBREAKS) {
    setFormat.tiebreakSet = {
      tiebreakTo: format[which].tiebreakTo
    };
    if (format[which].winBy === 1) {
      setFormat.tiebreakSet.NoAD = true;
    }
  }

  return setFormat;
}

function generateMatchUpFormat() {
  const setFormat = getSetFormat();
  const matchUpFormatObject = {
    bestOf: format.setFormat.bestOf,
    setFormat
  };

  const hasFinalSet = document.getElementById('finalSetOption')?.checked;
  if (hasFinalSet) matchUpFormatObject.finalSetFormat = getSetFormat(1);

  return scoreGovernor.stringifyMatchUpFormat(matchUpFormatObject);
}

function setMatchUpFormatString() {
  const matchUpFormat = generateMatchUpFormat();
  const matchUpFormatString = document.getElementById('matchUpFormatString');
  matchUpFormatString.innerHTML = matchUpFormat;
}

const setComponents = [
  { label: `Best of${clickable}`, finalSet: false, id: 'descriptor', options: ['Best of', 'Exactly'] },
  { label: `3${clickable}`, finalSet: false, id: 'bestOf', options: [1, 3, 5], onChange: 'pluralize' },
  { label: `Ad${clickable}`, whats: [SETS], id: 'advantage', options: [AD, NOAD] },
  {
    options: [SETS, TIEBREAKS, TIMED_SETS],
    finalSetLabel: `Set${clickable}`,
    onChange: 'changeWhat',
    label: `Sets${clickable}`,
    pluralize: true,
    id: 'what'
  },
  {
    options: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    label: `to 6${clickable}`,
    onChange: 'changeCount',
    whats: [SETS],
    prefix: 'to ',
    id: 'setTo'
  },
  {
    whats: [SETS, TIEBREAKS],
    label: `TB to 6${clickable}`,
    options: [5, 7, 9, 10, 12],
    id: 'tiebreakTo',
    prefix: 'TB to ',
    tbSet: true,
    tb: true
  },
  {
    options: (index) => {
      const setTo = format[index ? 'finalSetFormat' : 'setFormat'].setTo;
      return setTo > 1 ? [setTo - 1, setTo] : [];
    },
    label: `@6${clickable}`,
    id: 'tiebreakAt',
    whats: [SETS],
    prefix: '@',
    tb: true
  },
  {
    whats: [SETS, TIEBREAKS],
    label: `Win by 2${clickable}`,
    prefix: 'Win by ',
    options: [1, 2],
    tbSet: true,
    tb: true,
    id: 'winBy'
  },
  {
    options: [10, 15, 20, 25, 30, 45, 60, 90],
    label: `10 Minutes${clickable}`,
    initiallyHidden: true,
    whats: [TIMED_SETS],
    suffix: ' Minutes',
    id: 'minutes',
    timed: true
  }
];

const onClicks = {
  changeWhat: (e, index, opt) => {
    const tiebreakOptionVisible = opt === SETS;
    const elementId = index ? 'finalSetTiebreakToggle' : 'setTiebreakToggle';
    const elem = document.getElementById(elementId);
    elem.style.display = tiebreakOptionVisible ? '' : NONE;

    setComponents.forEach((component) => {
      if (component.whats) {
        const visible = component.whats.includes(opt);
        const id = index ? `${component.id}-${index}` : component.id;
        const elem = document.getElementById(id);
        elem.style.display = visible ? '' : NONE;
      }
    });
  },
  changeCount: (e, index, opt) => {
    const elementId = index ? `tiebreakAt-${index}` : 'tiebreakAt';
    format[index ? 'finalSetFormat' : 'setFormat'].tiebreakAt = opt;
    const elem = document.getElementById(elementId);
    elem.innerHTML = `@${opt}${clickable}`;
  },
  pluralize: (e, index, opt) => {
    const what = format[index ? 'finalSetFormat' : 'setFormat'].what;
    const elementId = index ? `what-${index}` : 'what';
    const elem = document.getElementById(elementId);
    const plural = opt > 1 ? 's' : '';
    elem.innerHTML = `${what}${plural}${clickable}`;
  }
};

export function getMatchUpFormat({ callback } = {}) {
  const onSelect = () => {
    const matchUpFormat = generateMatchUpFormat();
    isFunction(callback) && callback(matchUpFormat);
  };

  const buttons = [
    {
      label: 'Cancel',
      intent: 'none',
      close: true,
      onClick: callback
    },
    { label: 'Select', intent: 'is-info', close: true, onClick: onSelect }
  ];

  const tiebreakSwitch = 'switch is-rounded is-danger';
  const content = document.createElement('div');

  const matchUpFormatString = document.createElement('div');
  matchUpFormatString.id = 'matchUpFormatString';
  matchUpFormatString.innerHTML = 'SET3-S:6/TB7';
  matchUpFormatString.style.fontSize = '1.5em';
  matchUpFormatString.style.color = 'blue';
  matchUpFormatString.style.marginBottom = '1em';
  content.appendChild(matchUpFormatString);

  const setFormat = document.createElement('div');
  setComponents.map(createButton).forEach((button) => setFormat.appendChild(button));
  setFormat.id = 'setFormat';
  content.appendChild(setFormat);

  const setConfig = document.createElement('div');
  setConfig.className = 'field';
  setConfig.style.fontSize = '1em';

  const setTiebreak = document.createElement('input');
  setTiebreak.className = tiebreakSwitch;
  setTiebreak.name = 'setTiebreak';
  setTiebreak.id = 'setTiebreak';
  setTiebreak.type = 'checkbox';
  setTiebreak.checked = true;
  setTiebreak.onchange = (e) => {
    const active = e.target.checked;
    setComponents
      .filter(({ tb }) => tb)
      .forEach((component) => {
        const elem = document.getElementById(component.id);
        elem.style.display = active ? '' : NONE;
      });
    setMatchUpFormatString();
  };
  setConfig.appendChild(setTiebreak);

  const tiebreakLabel = document.createElement('label');
  tiebreakLabel.setAttribute('for', 'setTiebreak');
  tiebreakLabel.id = 'setTiebreakToggle';
  tiebreakLabel.innerHTML = 'Tiebreak';
  tiebreakLabel.style.marginRight = '1em';
  setConfig.appendChild(tiebreakLabel);

  let finalSetFormat, finalSetConfig;
  const finalSetOption = document.createElement('input');
  finalSetOption.className = 'switch is-rounded is-info';
  finalSetOption.type = 'checkbox';
  finalSetOption.name = 'finalSetOption';
  finalSetOption.checked = false;
  finalSetOption.id = 'finalSetOption';
  finalSetOption.onchange = (e) => {
    const active = e.target.checked;
    finalSetFormat.style.display = active ? '' : NONE;
    finalSetConfig.style.display = active ? '' : NONE;
    setMatchUpFormatString();
  };
  setConfig.appendChild(finalSetOption);

  const finalSetLabel = document.createElement('label');
  finalSetLabel.setAttribute('for', 'finalSetOption');
  finalSetLabel.innerHTML = 'Final set';
  setConfig.appendChild(finalSetLabel);

  content.appendChild(setConfig);

  finalSetFormat = document.createElement('div');
  finalSetFormat.style.display = NONE;
  finalSetFormat.id = 'finalSetFormat';
  [{ label: `<div style='font-weight: bold'>Final set</div>`, options: [] }]
    .concat(setComponents)
    .filter((def) => def.finalSet !== false)
    .map((def) => createButton({ ...def, index: 1 }))
    .forEach((button) => finalSetFormat.appendChild(button));
  content.appendChild(finalSetFormat);

  finalSetConfig = document.createElement('div');
  finalSetConfig.style.display = NONE;
  finalSetConfig.className = 'field';
  finalSetConfig.style.fontSize = '1em';

  const finalSetTiebreak = document.createElement('input');
  finalSetTiebreak.className = tiebreakSwitch;
  finalSetTiebreak.name = 'finalSetTiebreak';
  finalSetTiebreak.id = 'finalSetTiebreak';
  finalSetTiebreak.type = 'checkbox';
  finalSetTiebreak.checked = true;
  finalSetConfig.onchange = (e) => {
    const active = e.target.checked;
    setComponents
      .filter(({ tb }) => tb)
      .forEach((component) => {
        const elem = document.getElementById(`${component.id}-1`);
        elem.style.display = active ? '' : NONE;
      });
    setMatchUpFormatString();
  };
  finalSetConfig.appendChild(finalSetTiebreak);

  const finalSetTiebreakLabel = document.createElement('label');
  finalSetTiebreakLabel.setAttribute('for', 'finalSetTiebreak');
  finalSetTiebreakLabel.id = 'finalSetTiebreakToggle';
  finalSetTiebreakLabel.innerHTML = 'Tiebreak';
  finalSetTiebreakLabel.style.marginRight = '1em';
  finalSetConfig.appendChild(finalSetTiebreakLabel);

  content.appendChild(finalSetConfig);

  openModal({ title: 'Score format', content, buttons });
}

function createButton(params) {
  const { id, initiallyHidden, index, finalSetLabel, label } = params;
  const button = document.createElement('button');
  button.className = 'mfcButton';
  button.id = index ? `${id}-${index}` : id;
  if (initiallyHidden) button.style.display = NONE;
  button.innerHTML = finalSetLabel || label;
  button.onclick = (e) => getButtonClick({ e, button, ...params });
  return button;
}

function getButtonClick({ e, id, button, pluralize, options, prefix = '', suffix = '', onChange, index }) {
  const bestOf = index ? format.finalSetFormat.bestOf : format.setFormat.bestOf;
  const plural = !index && pluralize && bestOf > 1 ? 's' : '';

  const itemConfig = isFunction(options) ? options(index) : options;
  const items = itemConfig.map((opt) => ({
    text: `${opt}${plural}`,
    onClick: () => {
      button.innerHTML = `${prefix}${opt}${plural}${suffix}${clickable}`;
      if (onChange && isFunction(onClicks[onChange])) {
        onClicks[onChange](e, index, opt);
      }
      format[index ? 'finalSetFormat' : 'setFormat'][id] = opt;
      setMatchUpFormatString();
    }
  }));

  tipster({ items, target: e.target, config: { arrow: false, offset: [0, 0] } });
}
