const sizeRegex = /[.\d]+/;
const unitsRegex = /[A-Za-z]+/;

export function scaleFont(el: HTMLElement): void {
  const isOverflowing = (el: HTMLElement) => el.scrollWidth > el.clientWidth;
  let counter = 0;

  while (isOverflowing(el) && counter < 20) {
    const font_size = el.style.fontSize;
    const size = sizeRegex.exec(font_size)?.[0];
    const units = unitsRegex.exec(font_size)?.[0];
    if (size && units) {
      el.style.fontSize = `${parseFloat(size) - 0.1}${units}`;
    }
    counter += 1;
  }
}
