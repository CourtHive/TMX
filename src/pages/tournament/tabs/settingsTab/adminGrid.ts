export function renderAdminGrid(container: HTMLElement): void {
  const grid = document.createElement('div');
  grid.className = 'settings-grid';

  // --- Policy Definitions panel (red, cols 1-3) ---
  const policyPanel = document.createElement('div');
  policyPanel.className = 'settings-panel panel-red';
  policyPanel.style.gridColumn = '1 / 3';
  policyPanel.innerHTML = `
    <h3><i class="fa-solid fa-shield-halved"></i> Policy Definitions</h3>
    <p style="color: #666; font-size: 0.9rem;">Policy editor coming soon.</p>
  `;
  grid.appendChild(policyPanel);

  // --- Provider Settings panel (purple, cols 4-5) ---
  const providerPanel = document.createElement('div');
  providerPanel.className = 'settings-panel panel-purple';
  providerPanel.style.gridColumn = '3 / 5';
  providerPanel.innerHTML = `
    <h3><i class="fa-solid fa-building"></i> Provider Settings</h3>
    <p style="color: #666; font-size: 0.9rem;">Provider-specific options coming soon.</p>
  `;
  grid.appendChild(providerPanel);

  container.appendChild(grid);
}
