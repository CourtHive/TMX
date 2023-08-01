import tmxLogo from 'assets/images/orgLogo.png';

export function TMXlogo() {
  const img = document.createElement('img');
  img.style.maxWidth = '800px';
  img.style.width = '100%';
  img.alt = 'tmxLogo';
  img.src = tmxLogo;

  return img;
}
