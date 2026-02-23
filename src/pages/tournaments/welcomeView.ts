const STYLE_ID = 'welcome-view-styles';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .welcome-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      padding: 32px;
      max-width: 840px;
      margin: 0 auto;
    }
    .welcome-hero {
      grid-column: 1 / -1;
    }
    .welcome-panel {
      border-radius: 8px;
      padding: 24px;
      border-top: 4px solid;
      background: var(--tmx-bg-primary);
    }
    .welcome-panel-hero {
      border-color: var(--tmx-accent-green);
      background: var(--tmx-panel-green-bg);
      text-align: center;
      padding: 32px 24px;
    }
    .welcome-panel-feature {
      border-color: var(--tmx-accent-blue);
      background: var(--tmx-panel-blue-bg);
    }
    .welcome-panel i.welcome-icon {
      font-size: 2rem;
      margin-bottom: 12px;
      display: block;
      color: var(--tmx-text-secondary);
    }
    .welcome-panel-hero i.welcome-icon {
      font-size: 2.5rem;
      color: var(--tmx-accent-green);
    }
    .welcome-panel h3 {
      margin: 0 0 8px 0;
      font-size: 1.1rem;
    }
    .welcome-panel p {
      margin: 0;
      font-size: 0.9rem;
      color: var(--tmx-text-secondary);
      line-height: 1.4;
    }
    .welcome-btn-group {
      margin-top: 16px;
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    .welcome-generate-btn {
      padding: 10px 28px;
      border: 2px solid var(--tmx-accent-green);
      border-radius: 6px;
      background: var(--tmx-accent-green);
      color: var(--tmx-text-inverse);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .welcome-generate-btn:hover {
      opacity: 0.85;
    }
    .welcome-create-btn {
      padding: 10px 28px;
      border: 2px solid var(--tmx-accent-green);
      border-radius: 6px;
      background: var(--tmx-bg-primary);
      color: var(--tmx-accent-green);
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .welcome-create-btn:hover {
      background: var(--tmx-panel-green-bg);
      opacity: 0.85;
    }
    .welcome-back-link {
      margin-top: 12px;
      display: inline-block;
      color: var(--tmx-text-secondary);
      font-size: 0.9rem;
      cursor: pointer;
      text-decoration: underline;
      transition: color 0.15s;
    }
    .welcome-back-link:hover {
      color: var(--tmx-text-primary);
    }

    @media (max-width: 600px) {
      .welcome-grid {
        grid-template-columns: 1fr;
        padding: 16px;
      }
    }
  `;
  document.head.appendChild(style);
}

interface PanelConfig {
  icon: string;
  heading: string;
  text: string;
}

const featurePanels: PanelConfig[] = [
  {
    icon: 'fa-trophy',
    heading: 'Tournament Management',
    text: 'Create events, manage draws, and run tournaments from start to finish.',
  },
  {
    icon: 'fa-calendar',
    heading: 'Smart Scheduling',
    text: 'Assign courts, manage time slots, and handle schedule conflicts.',
  },
  {
    icon: 'fa-users',
    heading: 'Participant Tracking',
    text: 'Register players, manage ratings, and seed draws automatically.',
  },
  {
    icon: 'fa-table-tennis',
    heading: 'Live Scoring',
    text: 'Score matches in real time with automatic draw progression.',
  },
];

function createPanel(config: PanelConfig, className: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = `welcome-panel ${className}`;

  const icon = document.createElement('i');
  icon.className = `fa ${config.icon} welcome-icon`;
  panel.appendChild(icon);

  const heading = document.createElement('h3');
  heading.textContent = config.heading;
  panel.appendChild(heading);

  const text = document.createElement('p');
  text.textContent = config.text;
  panel.appendChild(text);

  return panel;
}

export function renderWelcomeView(
  container: HTMLElement,
  callbacks: { onGenerate: () => void; onCreate: () => void; onBack?: () => void },
): void {
  ensureStyles();
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'welcome-grid';

  // Hero panel
  const hero = createPanel(
    {
      icon: 'fa-rocket',
      heading: 'Welcome to TMX',
      text: 'Get started by generating example tournaments to explore TMX features, or create your own.',
    },
    'welcome-panel-hero welcome-hero',
  );

  const btnGroup = document.createElement('div');
  btnGroup.className = 'welcome-btn-group';

  const generateBtn = document.createElement('button');
  generateBtn.className = 'welcome-generate-btn';
  generateBtn.textContent = 'Generate Demo Tournaments';
  generateBtn.addEventListener('click', callbacks.onGenerate);
  btnGroup.appendChild(generateBtn);

  const createBtn = document.createElement('button');
  createBtn.className = 'welcome-create-btn';
  createBtn.textContent = 'Create New Tournament';
  createBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    callbacks.onCreate();
  });
  btnGroup.appendChild(createBtn);

  hero.appendChild(btnGroup);

  if (callbacks.onBack) {
    const backLink = document.createElement('span');
    backLink.className = 'welcome-back-link';
    backLink.textContent = '\u2190 Back to Tournaments';
    backLink.addEventListener('click', callbacks.onBack);
    hero.appendChild(backLink);
  }

  grid.appendChild(hero);

  // Feature panels
  for (const config of featurePanels) {
    grid.appendChild(createPanel(config, 'welcome-panel-feature'));
  }

  container.appendChild(grid);
}
