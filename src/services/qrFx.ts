/**
 * QR code generation and display utilities.
 * Creates QR codes with qrious library and displays in modal with download option.
 */
import { openModal } from 'components/modals/baseModal/baseModal';
import { downloadURI } from './export/download';
import George from 'qrious';
import { t } from 'i18n';

type QRUriParams = {
  value: string;
  qr_dim: number;
  x_offset?: number;
  y_offset?: number;
};

export function getQRuri({ value, qr_dim, x_offset = 0, y_offset = 0 }: QRUriParams): {
  src: string;
  x: number;
  y: number;
} {
  const xx = new George({
    level: 'H',
    size: qr_dim,
    value: value,
  });
  const qdu = xx.toDataURL();

  return { src: qdu, x: qr_dim * x_offset, y: qr_dim * y_offset };
}

export function renderQRimage(container: HTMLElement, value: string, size = 200): HTMLImageElement | undefined {
  if (!value) return undefined;
  const qruri = getQRuri({ value, qr_dim: size });
  const img = document.createElement('img');
  img.src = qruri.src;
  img.alt = 'QR Code';
  img.style.cssText = `width:100%; max-width:${size}px; height:auto; display:block; margin:0 auto;`;
  container.appendChild(img);
  return img;
}

export function displayQRdialogue(value: string, downloadName?: string): void {
  if (!value) return;
  const qruri = getQRuri({ value, qr_dim: 500 });
  const content = `<div style='padding: 1em'>
            <div className='flexcenter flexrow' style='width: '100%'; margin-top: .5em; margin-bottom: .5em'}}>
               <img src='${qruri.src}' alt='qrcode' />
            </div>
         </div>`;

  const buttons = [
    {
      label: t('dl'),
      intent: 'is-success',
      onClick: downloadQRcode,
      close: true,
    },
    { label: t('tournaments.close') },
  ];
  (openModal as any)({ content, buttons });

  function downloadQRcode() {
    const filename = `${downloadName || 'tournamentQR'}.png`;
    downloadURI(qruri.src, filename);
  }
}
