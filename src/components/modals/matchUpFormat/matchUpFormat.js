import { governors, matchUpFormatCode } from 'tods-competition-factory';
import { downCaret as clickable } from 'assets/specialCharacters/openClose';
import { renderField } from 'components/renderers/renderField';
import { tipster } from 'components/popovers/tipster';
import { openModal } from '../baseModal/baseModal';
import { isFunction } from 'functions/typeOf';

import matchUpFormats from './matchUpFormats.json';

import { NONE } from 'constants/tmxConstants';

let selectedMatchUpFormat, parsedMatchUpFormat;

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
    minutes: 10,
  },
  finalSetFormat: {
    descriptor: 'Final set',
    advantage: AD,
    what: SETS,
    setTo: 6,
    tiebreakAt: 6,
    tiebreakTo: 7,
    winBy: 2,
    minutes: 10,
  },
};

function getSetFormat(index) {
  const which = index ? 'finalSetFormat' : 'setFormat';
  const what = format[which].what;
  const setFormat = {
    setTo: format[which].setTo,
  };
  if (what === SETS && format[which].advantage === NOAD) setFormat.NoAD = true;

  const hasTiebreak = what === SETS && document.getElementById(index ? 'finalSetTiebreak' : 'setTiebreak')?.checked;
  if (hasTiebreak) {
    setFormat.tiebreakAt = format[which].tiebreakAt;
    setFormat.tiebreakFormat = {
      tiebreakTo: format[which].tiebreakTo,
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
      tiebreakTo: format[which].tiebreakTo,
    };
    if (format[which].winBy === 1) {
      setFormat.tiebreakSet.NoAD = true;
    }
  }

  return setFormat;
}

function generateMatchUpFormat() {
  const setFormat = getSetFormat();

  parsedMatchUpFormat = {
    bestOf: format.setFormat.bestOf,
    setFormat,
  };

  const hasFinalSet = document.getElementById('finalSetOption')?.checked;
  if (hasFinalSet) parsedMatchUpFormat.finalSetFormat = getSetFormat(1);

  const matchUpFormat = governors.scoreGovernor.stringifyMatchUpFormat(parsedMatchUpFormat);
  const predefined = !!matchUpFormats.find((format) => format.format === matchUpFormat);
  const elem = document.getElementById('matchUpFormatSelector');
  const options = elem?.querySelectorAll('option');
  Array.from(options).forEach((option) => {
    option.selected = (!predefined && option.value === 'Custom') || option.value === matchUpFormat;
  });

  return matchUpFormat;
}

function setMatchUpFormatString(value) {
  const matchUpFormat = value || generateMatchUpFormat();
  const matchUpFormatString = document.getElementById('matchUpFormatString');
  matchUpFormatString.innerHTML = matchUpFormat;
}

const whichSetFormat = (pmf, isFinal) => {
  if (isFinal) return pmf.finalSetFormat || pmf.setFormat;
  return pmf.setFormat;
};

const setComponents = [
  {
    getValue: (pmf) => (pmf.bestOf > 1 ? 'Best of' : 'Exactly'),
    options: ['Best of', 'Exactly'],
    id: 'descriptor',
    value: 'Best of',
    finalSet: false,
  },
  { getValue: (pmf) => pmf.bestOf, finalSet: false, id: 'bestOf', options: [1, 3, 5], onChange: 'pluralize', value: 3 },
  {
    getValue: (pmf, isFinal) => {
      const setFormat = whichSetFormat(pmf, isFinal);
      const adType = setFormat?.NoAD ? NOAD : AD;
      return setFormat?.timed || setFormat?.tiebreakSet ? undefined : adType;
    },
    options: [AD, NOAD],
    defaultValue: AD,
    id: 'advantage',
    whats: [SETS],
  },
  {
    getValue: (pmf, isFinal) => {
      const setFormat = whichSetFormat(pmf, isFinal);
      if (!setFormat) console.log({ pmf });
      if (setFormat?.timed) return TIMED_SETS;
      if (setFormat?.tiebreakSet) return TIEBREAKS;
      return SETS;
    },
    options: [SETS, TIEBREAKS, TIMED_SETS],
    finalSetLabel: `${SETS}${clickable}`,
    onChange: 'changeWhat',
    pluralize: true,
    id: 'what',
  },
  {
    getValue: (pmf, isFinal) => {
      const setFormat = whichSetFormat(pmf, isFinal);
      return setFormat.setTo;
    },
    options: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    onChange: 'changeCount',
    defaultValue: 6,
    whats: [SETS],
    prefix: 'to ',
    id: 'setTo',
  },
  {
    getValue: (pmf, isFinal) => {
      const setFormat = whichSetFormat(pmf, isFinal);
      return setFormat.tiebreakFormat?.tiebreakTo || setFormat.tiebreakSet?.tiebreakTo;
    },
    options: [5, 7, 9, 10, 12],
    whats: [SETS, TIEBREAKS],
    id: 'tiebreakTo',
    defaultValue: 7,
    prefix: 'TB to ',
    tbSet: true,
    value: 7,
    tb: true,
  },
  {
    getValue: (pmf, isFinal) => {
      const setFormat = whichSetFormat(pmf, isFinal);
      return setFormat.tiebreakAt;
    },
    options: (index) => {
      const setTo = format[index ? 'finalSetFormat' : 'setFormat'].setTo;
      return setTo > 1 ? [setTo - 1, setTo] : [];
    },
    id: 'tiebreakAt',
    defaultValue: 6,
    whats: [SETS],
    prefix: '@',
    value: 6,
    tb: true,
  },
  {
    getValue: (pmf, isFinal) => {
      const setFormat = whichSetFormat(pmf, isFinal);
      if (!setFormat.tiebreakFormat) return undefined;
      return setFormat.tiebreakFormat?.NoAD ? 1 : 2;
    },
    whats: [SETS, TIEBREAKS],
    prefix: 'Win by ',
    options: [1, 2],
    defaultValue: 2,
    tbSet: true,
    id: 'winBy',
    tb: true,
  },
  {
    getValue: (pmf, isFinal) => {
      const setFormat = whichSetFormat(pmf, isFinal);
      return (setFormat.timed && setFormat.minutes) || undefined;
    },
    options: [10, 15, 20, 25, 30, 45, 60, 90],
    whats: [TIMED_SETS],
    suffix: ' Minutes',
    defaultValue: 10,
    id: 'minutes',
    timed: true,
  },
];

const onClicks = {
  changeWhat: (e, index, opt) => {
    const tiebreakOptionVisible = opt === SETS;
    const elementId = index ? 'finalSetTiebreakToggle' : 'setTiebreakToggle';
    const elem = document.getElementById(elementId);
    elem.style.display = tiebreakOptionVisible ? '' : NONE;

    setComponents.forEach((component) => {
      if (component.whats) {
        const { prefix = '', suffix = '', pluralize } = component;
        const visible = component.whats.includes(opt);
        const id = index ? `${component.id}-${index}` : component.id;
        const elem = document.getElementById(id);

        if (elem.style.display === NONE && visible) {
          const bestOf = parsedMatchUpFormat.bestOf;
          const plural = !index && pluralize && bestOf > 1 ? 's' : '';
          const value = component.defaultValue;
          elem.innerHTML = `${prefix}${value}${plural}${suffix}${clickable}`;
        }

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
  },
};

export function getMatchUpFormat({ existingMatchUpFormat = 'SET3-S:6/TB7', callback } = {}) {
  selectedMatchUpFormat = existingMatchUpFormat;
  parsedMatchUpFormat = matchUpFormatCode.parse(selectedMatchUpFormat);
  const onSelect = () => {
    const specifiedFormat = generateMatchUpFormat();
    isFunction(callback) && callback(specifiedFormat);
  };

  let finalSetFormat, finalSetConfig, finalSetOption;
  let setTiebreak, finalSetTiebreak;

  const buttons = [
    {
      onClick: () => callback(),
      label: 'Cancel',
      intent: 'none',
      close: true,
    },
    { label: 'Select', intent: 'is-info', close: true, onClick: onSelect },
  ];

  const tiebreakSwitch = 'switch is-rounded is-danger';
  const content = document.createElement('div');

  const matchUpFormatString = document.createElement('div');
  matchUpFormatString.id = 'matchUpFormatString';
  matchUpFormatString.innerHTML = selectedMatchUpFormat;
  matchUpFormatString.style.fontSize = '1.5em';
  matchUpFormatString.style.color = 'blue';
  matchUpFormatString.style.marginBottom = '1em';
  content.appendChild(matchUpFormatString);

  const standardFormatSelector = document.createElement('div');
  standardFormatSelector.style.marginBlockEnd = '1em';
  const formatSelector = {
    id: 'matchUpFormatSelector',
    options: matchUpFormats.map((format) => ({
      selected: format.format === selectedMatchUpFormat,
      value: format.format,
      label: format.name,
    })),
  };
  const { field, inputElement } = renderField(formatSelector);
  inputElement.onchange = (e) => {
    selectedMatchUpFormat = e.target.value;
    setMatchUpFormatString(selectedMatchUpFormat);
    parsedMatchUpFormat = matchUpFormatCode.parse(selectedMatchUpFormat);

    format.setFormat = parsedMatchUpFormat.setFormat;
    format.setFormat.bestOf = parsedMatchUpFormat.bestOf;
    if (parsedMatchUpFormat.finalSetFormat) format.finalSetFormat = parsedMatchUpFormat.finalSetFormat;

    const finalSet = parsedMatchUpFormat.finalSetFormat;
    finalSetFormat.style.display = finalSet ? '' : NONE;
    finalSetConfig.style.display = finalSet ? '' : NONE;
    finalSetOption.checked = finalSet;
    finalSetTiebreak.checked = !!finalSet?.tiebreakFormat;

    setTiebreak.checked = parsedMatchUpFormat.setFormat.tiebreakFormat;

    setComponents.forEach((component) => {
      if (component.getValue) {
        const setComponentValue = component.getValue(parsedMatchUpFormat);
        const elem = document.getElementById(component.id);

        if (elem && setComponentValue) {
          const { prefix = '', suffix = '', pluralize } = component;
          const bestOf = parsedMatchUpFormat.bestOf;
          const plural = pluralize && bestOf > 1 ? 's' : '';
          elem.innerHTML = `${prefix}${setComponentValue}${plural}${suffix}${clickable}`;
          elem.style.display = '';
        } else if (elem) {
          elem.style.display = NONE;
        }

        if (finalSet) {
          const finalComponentValue = component.getValue(parsedMatchUpFormat, true);
          const elem = document.getElementById(`${component.id}-1`);

          if (elem && finalComponentValue) {
            const { prefix = '', suffix = '', pluralize } = component;
            const bestOf = parsedMatchUpFormat.bestOf;
            const plural = pluralize && bestOf > 1 ? 's' : '';
            elem.innerHTML = `${prefix}${finalComponentValue}${plural}${suffix}${clickable}`;
            elem.style.display = '';
          } else if (elem) {
            elem.style.display = NONE;
          }
        }
      }
    });
  };
  standardFormatSelector.appendChild(field);
  content.appendChild(standardFormatSelector);

  const setFormat = document.createElement('div');
  setComponents
    .map((component) => {
      const value = component.getValue(parsedMatchUpFormat);
      return createButton({ ...component, value });
    })
    .forEach((button) => setFormat.appendChild(button));
  setFormat.id = 'setFormat';
  content.appendChild(setFormat);

  const setConfig = document.createElement('div');
  setConfig.className = 'field';
  setConfig.style.fontSize = '1em';

  setTiebreak = document.createElement('input');
  setTiebreak.className = tiebreakSwitch;
  setTiebreak.name = 'setTiebreak';
  setTiebreak.id = 'setTiebreak';
  setTiebreak.type = 'checkbox';
  setTiebreak.checked = parsedMatchUpFormat.tiebreakFormat;
  setTiebreak.onchange = (e) => {
    const active = e.target.checked;
    setComponents
      .filter(({ tb }) => tb)
      .forEach((component) => {
        const elem = document.getElementById(component.id);

        if (elem.style.display === NONE && active) {
          const { prefix = '', suffix = '', pluralize, defaultValue: value } = component;
          const bestOf = parsedMatchUpFormat.bestOf;
          const plural = pluralize && bestOf > 1 ? 's' : '';
          elem.innerHTML = `${prefix}${value}${plural}${suffix}${clickable}`;
        }

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

  finalSetOption = document.createElement('input');
  finalSetOption.className = 'switch is-rounded is-info';
  finalSetOption.type = 'checkbox';
  finalSetOption.name = 'finalSetOption';
  finalSetOption.checked = !!parsedMatchUpFormat.finalSetFormat;
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
  finalSetFormat.style.display = parsedMatchUpFormat.finalSetFormat ? '' : NONE;
  finalSetFormat.id = 'finalSetFormat';
  [{ label: `<div style='font-weight: bold'>Final set</div>`, options: [] }]
    .concat(
      setComponents.map((component) => {
        const value = component.getValue(parsedMatchUpFormat, true);
        return { ...component, value };
      }),
    )
    .filter((def) => def.finalSet !== false)
    .map((def) => createButton({ ...def, index: 1 }))
    .forEach((button) => finalSetFormat.appendChild(button));
  content.appendChild(finalSetFormat);

  finalSetConfig = document.createElement('div');
  finalSetConfig.style.display = parsedMatchUpFormat.finalSetFormat ? '' : NONE;
  finalSetConfig.className = 'field';
  finalSetConfig.style.fontSize = '1em';

  finalSetTiebreak = document.createElement('input');
  finalSetTiebreak.className = tiebreakSwitch;
  finalSetTiebreak.name = 'finalSetTiebreak';
  finalSetTiebreak.id = 'finalSetTiebreak';
  finalSetTiebreak.type = 'checkbox';
  finalSetTiebreak.checked = parsedMatchUpFormat.finalSetFormat?.tiebreakFormat;
  finalSetConfig.onchange = (e) => {
    const active = e.target.checked;
    setComponents
      .filter(({ tb }) => tb)
      .forEach((component) => {
        const elem = document.getElementById(`${component.id}-1`);

        if (elem.style.display === NONE && active) {
          const { prefix = '', suffix = '', pluralize, defaultValue: value } = component;
          const bestOf = parsedMatchUpFormat.bestOf;
          const plural = pluralize && bestOf > 1 ? 's' : '';
          elem.innerHTML = `${prefix}${value}${plural}${suffix}${clickable}`;
        }

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

function generateLabel({ index, finalSetLabel, label, prefix = '', suffix = '', value, pluralize }) {
  const plural = !index && pluralize && format.setFormat.bestOf > 1 ? 's' : '';
  return label || (index && finalSetLabel) || `${prefix}${value}${plural}${suffix}${clickable}`;
}

function createButton(params) {
  const { id, initiallyHidden, index, value } = params;
  const button = document.createElement('button');
  button.className = 'mfcButton';
  button.id = index ? `${id}-${index}` : id;
  button.innerHTML = generateLabel(params);
  button.onclick = (e) => getButtonClick({ e, button, ...params });
  button.style.display = value || params.label ? '' : NONE;
  if (initiallyHidden) button.style.display = NONE;
  return button;
}

function getButtonClick(params) {
  const { e, id, button, pluralize, options, onChange, index, prefix = '', suffix = '' } = params;
  const bestOf = format.setFormat.bestOf;
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
    },
  }));

  tipster({ items, target: e.target, config: { arrow: false, offset: [0, 0] } });
}
