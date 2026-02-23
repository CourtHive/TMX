const STYLE_ID = 'system-tab-styles';

export function ensureSystemStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .system-tab-container {
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
      height: 100%;
    }

    .system-providers-layout {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 16px;
      flex: 1;
      min-height: 0;
    }

    .system-provider-list,
    .system-provider-detail {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px;
      overflow: auto;
    }

    .system-no-selection {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #999;
      font-style: italic;
      height: 100%;
    }

    .system-detail-header {
      margin: 0 0 12px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid #e0e0e0;
    }

    .system-detail-header h3 {
      margin: 0 0 4px 0;
      font-size: 1rem;
      font-weight: 600;
    }

    .system-detail-header .detail-meta {
      color: #666;
      font-size: 0.85rem;
    }

    .system-detail-actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .system-associated-users {
      margin-top: 12px;
    }

    .system-associated-users h4 {
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .btn-impersonate,
    .btn-edit,
    .btn-invite,
    .btn-remove {
      padding: 6px 14px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .btn-impersonate:hover,
    .btn-edit:hover,
    .btn-invite:hover,
    .btn-remove:hover {
      opacity: 0.85;
    }

    .btn-impersonate {
      background: #4a90d9;
      color: #fff;
    }

    .btn-edit {
      background: #48c774;
      color: #fff;
    }

    .btn-invite {
      background: #b86bff;
      color: #fff;
    }

    .btn-remove {
      background: #ff6b6b;
      color: #fff;
    }

    .system-users-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .system-users-toolbar .toolbar-actions {
      display: flex;
      gap: 8px;
    }

    @media (max-width: 900px) {
      .system-providers-layout {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}
