export function footerBlock() {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.style.wicth = '100%';
  footer.innerHTML = `
    <nav class="level">
      <div class="level-left"></div>
      <div class="level-right" style="margin-right: 1em">
        <div class="level-item">
          <img class="tmxLogo" src={tmxLogo} />
        </div>
      </div>
    </nav>
  `;
  return footer;
}
