import { downloadURI } from './export/download';
import { lang } from './translator';
import { context } from './context';
import George from 'qrious';

/*
export function genQUR(value) {
  new George({
    element: document.getElementById('qr'),
    level: 'H',
    size: 200,
    value: value
  });
}
*/

export function getQRuri({ value, qr_dim, x_offset = 0, y_offset = 0 }) {
  let xx = new George({
    level: 'H',
    size: qr_dim,
    value: value
  });
  let qdu = xx.toDataURL();

  return { src: qdu, x: qr_dim * x_offset, y: qr_dim * y_offset };
}

export function displayQRdialogue(value, downloadName) {
  if (!value) return;
  let qruri = getQRuri({ value, qr_dim: 500 });
  let content = `<div style='padding: 1em'>
            <div className='flexcenter flexrow' style='width: '100%'; margin-top: .5em; margin-bottom: .5em'}}>
               <img src='${qruri.src}' alt='qrcode' />
            </div>
         </div>`;

  let buttons = [
    {
      label: lang.tr('dl'),
      intent: 'is-success',
      onClick: downloadQRcode,
      close: true
    },
    { label: lang.tr('tournaments.close') }
  ];
  context.modal.open({ content, buttons });

  function downloadQRcode() {
    let filename = `${downloadName || 'tournamentQR'}.png`;
    downloadURI(qruri.src, filename);
  }
}
