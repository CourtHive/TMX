export function renderAdminGrid(container: HTMLElement): void {
  const grid = document.createElement('div');
  grid.className = 'settings-grid';

  // --- Policy Definitions panel (half width) ---
  const policyPanel = document.createElement('div');
  policyPanel.className = 'settings-panel';
  policyPanel.style.gridColumn = 'span 6';
  policyPanel.innerHTML = `
    <h3><i class="fa-solid fa-shield-halved"></i> Policy Definitions</h3>
    <p style="color: var(--tmx-text-secondary); font-size: 0.9rem;">Policy editor coming soon.</p>
  `;
  grid.appendChild(policyPanel);

  // --- Provider Settings panel (half width) ---
  const providerPanel = document.createElement('div');
  providerPanel.className = 'settings-panel';
  providerPanel.style.gridColumn = 'span 6';
  providerPanel.innerHTML = `
    <h3><i class="fa-solid fa-building"></i> Provider Settings</h3>
    <p style="color: var(--tmx-text-secondary); font-size: 0.9rem;">Provider-specific options coming soon.</p>
  `;
  grid.appendChild(providerPanel);

  container.appendChild(grid);
}
