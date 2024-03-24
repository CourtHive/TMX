import { lang } from 'services/translator';

export const tmxNotes = (() => {
  let fx = {};

  fx.notes = () => {
    return `<div class="bp3-running-text bp3-ui-text">
            <p>
               <b>CourtHive/TMX</b> is an Extensible platform for Tournament Management which uses the ITF's Tennis Open Data Standards (TODS) to integrate and exchange data with other applications.
            </p>
         </div>`;
  };

  fx.support = () => {
    return `<div>
            <H3>Email</H3>
            <div>
               ${lang.tr('phrases.feedback')}:
               <p><b>support @ courthive.com</b></p>
            </div>
         </div>`;
  };

  fx.version = () => '';

  return fx;
})();
