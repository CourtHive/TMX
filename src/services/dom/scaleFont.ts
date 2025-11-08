export function scaleFont(el: HTMLElement): void {
  const isOverflowing = (el: HTMLElement) => el.scrollWidth > el.clientWidth;
  let counter = 0;

  while (isOverflowing(el) && counter < 20) {
    const font_size = el.style.fontSize;
    const size = font_size.match(/[.\d]+/)?.[0];
    const units = font_size.match(/[A-Za-z]+/)?.[0];
    if (size && units) {
      el.style.fontSize = `${parseFloat(size) - 0.1}${units}`;
    }
    counter += 1;
  }
}
