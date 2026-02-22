import { getProviders, getUsers } from 'services/apis/servicesApi';
import { editProviderModal } from 'components/modals/editProvider';
import { removeAllChildNodes } from 'services/dom/transformers';
import { ensureSystemStyles } from './systemTabStyles';
import { renderProvidersPanel } from './providersPanel';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderUsersPanel } from './usersPanel';
import { controlBar } from 'courthive-components';
import { t } from 'i18n';

import { LEFT, RIGHT } from 'constants/tmxConstants';

type SubTab = 'providers' | 'users';
let currentSubTab: SubTab = 'providers';

export function renderSystemTab(container: HTMLElement): void {
  ensureSystemStyles();
  removeAllChildNodes(container);

  const wrapper = document.createElement('div');
  wrapper.className = 'system-tab-container';

  // Sub-tab control bar
  const controlBarEl = document.createElement('div');
  wrapper.appendChild(controlBarEl);

  // Content area
  const contentEl = document.createElement('div');
  contentEl.style.flex = '1';
  contentEl.style.minHeight = '0';
  wrapper.appendChild(contentEl);

  container.appendChild(wrapper);

  const renderContent = (providers: any[], users: any[]) => {
    const switchSubTab = (tab: SubTab) => {
      if (tab === currentSubTab) return;
      currentSubTab = tab;
      buildControlBar();
      renderCurrentPanel();
    };

    const onRefresh = () => {
      fetchAndRender();
    };

    const buildControlBar = () => {
      removeAllChildNodes(controlBarEl);
      const tabs = [
        {
          active: currentSubTab === 'providers',
          onClick: () => switchSubTab('providers'),
          label: t('system.providers'),
          close: true,
        },
        {
          active: currentSubTab === 'users',
          onClick: () => switchSubTab('users'),
          label: t('system.users'),
          close: true,
        },
      ];

      const items: any[] = [{ id: 'systemSubTabs', location: LEFT, tabs }];

      // Add "Create Provider" button on the right when in providers sub-tab
      if (currentSubTab === 'providers') {
        items.push({
          onClick: () => editProviderModal({ callback: () => onRefresh() }),
          label: t('system.createProvider'),
          intent: 'is-info',
          location: RIGHT,
        });
      }

      controlBar({ target: controlBarEl, items });
    };

    const renderCurrentPanel = () => {
      removeAllChildNodes(contentEl);
      if (currentSubTab === 'providers') {
        renderProvidersPanel({ container: contentEl, providers, users, onRefresh });
      } else {
        renderUsersPanel({ container: contentEl, providers, users, onRefresh });
      }
    };

    buildControlBar();
    renderCurrentPanel();
  };

  const fetchAndRender = () => {
    Promise.all([getProviders(), getUsers()])
      .then(([providersRes, usersRes]) => {
        const providers = providersRes?.data?.providers || [];
        const users = usersRes?.data?.users || [];
        renderContent(providers, users);
      })
      .catch(() => {
        tmxToast({ message: t('system.loadError'), intent: 'is-danger' });
      });
  };

  fetchAndRender();
}
