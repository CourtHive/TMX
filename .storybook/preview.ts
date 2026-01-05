import type { Preview } from '@storybook/html-vite';

// Import all application styles
import 'vanillajs-datepicker/css/datepicker-bulma.css';
import '@event-calendar/core/index.css';
import 'timepicker-ui/main.css';
import '../src/styles/legacy/scoreboard.css';
import '../src/styles/legacy/ddScoring.css';

import 'bulma-checkradio/dist/css/bulma-checkradio.min.css';
import 'bulma-switch/dist/css/bulma-switch.min.css';
import 'awesomplete/awesomplete.css';
import 'animate.css/animate.min.css';
import 'quill/dist/quill.snow.css';
import 'pikaday/css/pikaday.css';

import 'tippy.js/themes/light-border.css';
import 'tippy.js/themes/light.css';
import 'tippy.js/dist/tippy.css';

import '../src/styles/tabulator.css';

import 'bulma/css/versions/bulma-no-dark-mode.min.css';

import '../src/styles/tournamentContainer.css';
import '../src/styles/tournamentSchedule.css';
import '../src/styles/overlay.css';
import '../src/styles/leaflet.css';
import '../src/styles/fa.min.css';
import '../src/styles/icons.css';
import '../src/styles/tmx.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
