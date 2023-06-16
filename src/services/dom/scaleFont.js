export function scaleFont(el) {
  const isOverflowing = (el) => el.scrollWidth > el.clientWidth;
  let counter = 0;

  while (isOverflowing(el) && counter < 20) {
    const font_size = el.style.fontSize;
    const size = font_size.match(/[.\d]+/)[0];
    const units = font_size.match(/[A-Za-z]+/)[0];
    el.style.fontSize = `${size - 0.1}${units}`;
    counter += 1;
  }
}
