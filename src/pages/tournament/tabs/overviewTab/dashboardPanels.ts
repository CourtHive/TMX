import { editTournamentImage } from 'components/modals/tournamentImage';
import { saveTournamentRecord } from 'services/storage/saveTournamentRecord';
import { burstChart, fromFactoryDrawData } from 'courthive-components';
import { enterMatchUpScore } from 'services/transitions/scoreMatchUp';
import { getLoginState } from 'services/authentication/loginState';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { removeProviderTournament } from 'services/storage/removeProviderTournament';
import { removeTournament, sendTournament } from 'services/apis/servicesApi';
import { tmxToast } from 'services/notifications/tmxToast';
import { downloadUTRmatches } from 'services/export/UTR';
import { downloadJSON } from 'services/export/download';
import { success } from 'components/notices/success';
import { failure } from 'components/notices/failure';
import { openNotesEditor } from './notesEditorModal';
import type { StructureInfo } from './dashboardData';
import { tmx2db } from 'services/storage/tmx2db';
import { renderOverview } from './renderOverview';
import { context } from 'services/context';
import { t } from 'i18n';

// constants
import { ADD_TOURNAMENT_TIMEITEM, SET_TOURNAMENT_NOTES } from 'constants/mutationConstants';
import { ADMIN, SUPER_ADMIN, TMX_TOURNAMENTS } from 'constants/tmxConstants';

export function createImagePanel(imageUrl?: string): HTMLElement {
  const panel = document.createElement('div');
  panel.style.cssText =
    'border-radius:8px; overflow:hidden; cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:200px;';

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.cssText = 'border-radius:8px; width:100%; object-fit:cover; max-height:300px;';
    img.alt = 'Tournament image';
    panel.appendChild(img);
    panel.style.background = '';
  } else {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'text-align:center; color:#999; padding:24px; font-size:0.95rem;';
    placeholder.innerHTML =
      '<i class="fa fa-camera" style="font-size:48px; margin-bottom:8px; display:block;"></i>No tournament image';
    panel.appendChild(placeholder);
  }

  panel.addEventListener('click', () => {
    editTournamentImage({
      callback: () => renderOverview(),
    });
  });

  return panel;
}

export function createNotesPanel(notes?: string): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'dash-panel dash-panel-notes';
  panel.style.cssText = 'position:relative; min-height:200px; overflow:auto; max-height:300px;';

  const notesView = document.createElement('div');
  notesView.className = 'ql-container ql-snow content';
  notesView.style.border = 'none';

  const hasContent = notes && notes.replace(/<[^>]*>/g, '').trim().length > 0;
  if (hasContent) {
    notesView.innerHTML = notes;
  } else {
    const placeholder = document.createElement('div');
    placeholder.style.cssText =
      'display:flex; align-items:center; justify-content:center; height:100%; min-height:160px; color:#999; text-align:center; font-size:0.95rem;';
    placeholder.innerHTML =
      '<div><i class="fa fa-file-alt" style="font-size:48px; margin-bottom:8px; display:block;"></i>No tournament information</div>';
    notesView.appendChild(placeholder);
  }
  panel.appendChild(notesView);

  const editBtn = document.createElement('button');
  editBtn.style.cssText =
    'position:absolute; bottom:8px; right:8px; background:#fff; border:1px solid #ccc; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:14px;';
  editBtn.innerHTML = '<i class="fa fa-pencil"></i>';
  editBtn.title = 'Edit notes';
  editBtn.addEventListener('click', () => {
    const notes = tournamentEngine.getTournamentInfo()?.tournamentInfo?.notes || '';
    openNotesEditor({
      notes,
      onSave: (html) => {
        mutationRequest({ methods: [{ method: SET_TOURNAMENT_NOTES, params: { notes: html } }] });
        notesView.innerHTML = html;
      },
    });
  });
  panel.appendChild(editBtn);

  return panel;
}

export function createStatCard(label: string, value: string | number, icon?: string): HTMLElement {
  const card = document.createElement('div');
  card.className = 'dash-panel dash-panel-blue';
  card.style.cssText = 'padding:12px 16px; min-width:0;';

  const valueEl = document.createElement('div');
  valueEl.style.cssText = 'font-size:1.5rem; font-weight:bold; margin-bottom:4px;';
  valueEl.textContent = String(value);
  card.appendChild(valueEl);

  const labelEl = document.createElement('div');
  labelEl.style.cssText = 'font-size:0.85rem; color:#666;';
  if (icon) {
    const iconEl = document.createElement('i');
    iconEl.className = `fa ${icon}`;
    iconEl.style.marginRight = '4px';
    labelEl.appendChild(iconEl);
  }
  labelEl.appendChild(document.createTextNode(label));
  card.appendChild(labelEl);

  return card;
}

export function createDualStatCard(
  stats: { label: string; value: string | number; icon?: string }[],
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'dash-panel dash-panel-blue';
  card.style.cssText = 'padding:12px 16px; min-width:0; display:flex; gap:16px;';

  for (const stat of stats) {
    const group = document.createElement('div');

    const valueEl = document.createElement('div');
    valueEl.style.cssText = 'font-size:1.5rem; font-weight:bold; margin-bottom:4px;';
    valueEl.textContent = String(stat.value);
    group.appendChild(valueEl);

    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-size:0.85rem; color:#666;';
    if (stat.icon) {
      const iconEl = document.createElement('i');
      iconEl.className = `fa ${stat.icon}`;
      iconEl.style.marginRight = '4px';
      labelEl.appendChild(iconEl);
    }
    labelEl.appendChild(document.createTextNode(stat.label));
    group.appendChild(labelEl);

    card.appendChild(group);
  }

  return card;
}

export function createSunburstPlaceholder(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'dash-panel dash-panel-green';
  panel.style.cssText += 'display:flex; align-items:center; justify-content:center; min-height:200px;';

  const placeholder = document.createElement('div');
  placeholder.style.cssText = 'text-align:center; color:#999; font-size:0.95rem;';
  placeholder.innerHTML =
    '<i class="fa fa-circle-notch" style="font-size:48px; margin-bottom:8px; display:block;"></i>No draws';
  panel.appendChild(placeholder);

  return panel;
}

export function createSunburstPanel(structures: StructureInfo[]): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'dash-panel dash-panel-green';

  // Dropdown selector
  const select = document.createElement('select');
  select.style.cssText = 'margin-bottom:12px; padding:4px 8px; border-radius:4px; border:1px solid #ccc;';

  for (const s of structures) {
    const option = document.createElement('option');
    option.value = s.structureId;
    option.textContent = `${s.eventName} — ${s.drawName} — ${s.structureName}`;
    select.appendChild(option);
  }

  panel.appendChild(select);

  const chartDiv = document.createElement('div');
  chartDiv.style.cssText = 'display:flex; justify-content:center;';
  panel.appendChild(chartDiv);

  const renderStructure = (structureId: string) => {
    const info = structures.find((s) => s.structureId === structureId);
    if (!info) return;

    // Fetch event data lazily — only for the selected event, not all events
    const eventData = tournamentEngine.getEventData({ eventId: info.eventId })?.eventData;
    const drawData = eventData?.drawsData
      ?.find((d: any) => d.drawId === info.drawId)
      ?.structures?.find((s: any) => s.structureId === structureId);
    if (!drawData) return;

    chartDiv.innerHTML = '';
    const title = `${info.eventName}\n${info.drawName}`;
    const eventHandlers = {
      clickSegment: (data: any) => {
        const matchUp = data?.matchUp;
        if (matchUp?.readyToScore || matchUp?.scoreString) {
          enterMatchUpScore({ matchUpId: matchUp.matchUpId, callback: () => renderStructure(select.value) });
        }
      },
    };
    burstChart({ width: 500, height: 500, eventHandlers }).render(chartDiv, fromFactoryDrawData(drawData), title);
  };

  select.addEventListener('change', () => renderStructure(select.value));

  // Render first structure on load
  if (structures.length) {
    requestAnimationFrame(() => renderStructure(structures[0].structureId));
  }

  return panel;
}

function changeOnlineState({
  postMutation,
  state,
  offline,
}: {
  postMutation?: (result: any) => void;
  state: any;
  offline: boolean;
}): void {
  const itemValue = { ...tournamentEngine.getTournamentTimeItem({ itemType: 'TMX' })?.timeItem?.itemValue };
  if (offline) {
    itemValue.offline = { email: state.email };
  } else {
    delete itemValue.offline;
  }
  const timeItem = { itemType: 'TMX', itemValue };
  mutationRequest({
    methods: [{ method: ADD_TOURNAMENT_TIMEITEM, params: { removePriorValues: true, timeItem } }],
    callback: postMutation,
  });
}

function createActionButton(label: string, icon: string, onClick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'dash-action-btn';
  btn.innerHTML = `<i class="fa ${icon}"></i> ${label}`;
  btn.addEventListener('click', onClick);
  return btn;
}

export function createActionsPanel(): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'dash-panel dash-panel-red';

  const header = document.createElement('div');
  header.style.cssText = 'font-size:1rem; font-weight:600; display:flex; align-items:center; gap:8px; margin-bottom:12px;';
  const headerIcon = document.createElement('i');
  headerIcon.className = 'fa fa-bolt';
  headerIcon.style.fontSize = '0.9rem';
  header.appendChild(headerIcon);
  header.appendChild(document.createTextNode(t('loginMenu.actions')));
  panel.appendChild(header);

  const btnContainer = document.createElement('div');
  btnContainer.className = 'dash-action-buttons';
  panel.appendChild(btnContainer);

  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const offline = tournamentRecord?.timeItems?.find(({ itemType }: any) => itemType === 'TMX')?.itemValue?.offline;
  const provider = tournamentRecord?.parentOrganisation;
  const providerId = provider?.organisationId;
  const state = getLoginState();
  const superAdmin = state?.roles?.includes(SUPER_ADMIN);
  const canDelete = superAdmin || state?.permissions?.includes('deleteTournament');
  const admin = superAdmin || state?.roles?.includes(ADMIN);
  const activeProvider = context.provider || state?.provider;

  if (providerId) {
    btnContainer.appendChild(
      createActionButton(t('modals.tournamentActions.uploadTournament'), 'fa-upload', () => {
        const record = tournamentEngine.getTournament().tournamentRecord;
        tmxToast({
          action: {
            onClick: () => sendTournament({ tournamentRecord: record }).then(success, failure),
            text: 'Send??',
          },
          message: t('modals.tournamentActions.uploadTournament'),
          intent: 'is-danger',
        });
      }),
    );
  }

  if (tournamentRecord && canDelete) {
    btnContainer.appendChild(
      createActionButton(t('modals.tournamentActions.deleteTournament'), 'fa-trash', () => {
        const tournamentId = tournamentRecord.tournamentId;
        const provId = state?.providerId || providerId;
        const navigateAway = () => {
          if (provId) removeProviderTournament({ tournamentId, providerId: provId });
          context.router?.navigate(`/${TMX_TOURNAMENTS}`);
        };
        const localDelete = () => tmx2db.deleteTournament(tournamentId).then(navigateAway);

        tmxToast({
          action: {
            onClick: () => {
              if (activeProvider && provId) {
                removeTournament({ providerId: provId, tournamentId }).then(localDelete, (err) => console.log(err));
              } else {
                localDelete();
              }
            },
            text: t('common.confirm'),
          },
          message: t('modals.tournamentActions.deleteTournament'),
          intent: 'is-danger',
        });
      }),
    );
  }

  if (tournamentRecord && !providerId && activeProvider) {
    btnContainer.appendChild(
      createActionButton(t('modals.tournamentActions.claimTournament'), 'fa-hand-paper', () => {
        const record = tournamentEngine.getTournament().tournamentRecord;
        if (!record.parentOrganisation) {
          record.parentOrganisation = activeProvider;
          tournamentEngine.setState(record);
          sendTournament({ tournamentRecord: record }).then(
            () => {
              tmx2db.deleteTournament(record.tournamentId);
              context.router?.navigate(`/tournament/${record.tournamentId}/detail`);
              tmxToast({ message: t('modals.tournamentActions.tournamentClaimed'), intent: 'is-info' });
            },
            (error: any) => {
              tmxToast({ message: error.message || t('modals.tournamentActions.notClaimed'), intent: 'is-danger' });
            },
          );
        }
      }),
    );
  }

  if (providerId && !offline) {
    btnContainer.appendChild(
      createActionButton(t('modals.tournamentActions.goOffline'), 'fa-wifi', () => {
        changeOnlineState({
          state,
          offline: true,
          postMutation: (result: any) => {
            if (result?.success) {
              saveTournamentRecord();
              const dnav = document.getElementById('dnav');
              if (dnav) dnav.style.backgroundColor = 'lightyellow';
              tmxToast({ message: t('modals.tournamentActions.offline'), intent: 'is-info' });
              renderOverview();
            }
          },
        });
      }),
    );
  }

  if (providerId && offline) {
    btnContainer.appendChild(
      createActionButton(t('modals.tournamentActions.goOnline'), 'fa-wifi', () => {
        changeOnlineState({
          state,
          offline: false,
          postMutation: (result: any) => {
            if (result?.success) {
              const updated = tournamentEngine.getTournament().tournamentRecord;
              sendTournament({ tournamentRecord: updated }).then(
                () => {
                  tmx2db.deleteTournament(updated.tournamentId);
                  const dnav = document.getElementById('dnav');
                  if (dnav) dnav.style.backgroundColor = '';
                  tmxToast({ message: t('modals.tournamentActions.online'), intent: 'is-info' });
                  renderOverview();
                },
                (err: any) => {
                  console.log({ err });
                  changeOnlineState({ state, offline: true });
                },
              );
            }
          },
        });
      }),
    );
  }

  if (tournamentRecord && admin) {
    btnContainer.appendChild(
      createActionButton(t('modals.tournamentActions.exportUtr'), 'fa-download', () => downloadUTRmatches()),
    );
    btnContainer.appendChild(
      createActionButton(t('modals.tournamentActions.exportTods'), 'fa-download', () => {
        downloadJSON(`${tournamentRecord.tournamentId}.tods.json`, tournamentRecord);
      }),
    );
  }

  if (!btnContainer.children.length) {
    const noActions = document.createElement('div');
    noActions.style.cssText = 'font-size:0.85rem; color:#666; font-style:italic;';
    noActions.textContent = t('modals.tournamentActions.noActions');
    btnContainer.appendChild(noActions);
  }

  return panel;
}
