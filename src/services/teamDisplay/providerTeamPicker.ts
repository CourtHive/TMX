import { baseApi } from 'services/apis/baseApi';
import { t } from 'i18n';

const PROVIDER_ERROR_KEY = 'teamPresentation.providerError';

/** A bounded provider directory keeps palette authoring out of the tournament import workflow. */
export function providerTeamPicker(target: HTMLElement) {
  const selected = new Set<string>();
  const root = document.createElement('section');
  const label = document.createElement('label');
  label.textContent = t('teamPresentation.searchTeams');
  const query = document.createElement('input');
  label.appendChild(query);
  const search = document.createElement('button');
  search.type = 'button';
  search.textContent = t('teamPresentation.search');
  const rows = document.createElement('div');
  const more = document.createElement('button');
  more.type = 'button';
  more.textContent = t('teamPresentation.more');
  more.hidden = true;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  let nextOffset: number | undefined;
  let generation = 0;
  let closed = false;
  search.addEventListener('click', () => load());
  more.addEventListener('click', () => load(nextOffset));
  root.append(label, search, rows, more, status);
  target.appendChild(root);
  load();

  async function load(offset = 0): Promise<void> {
    const request = ++generation;
    search.disabled = more.disabled = true;
    try {
      const response = await baseApi.get(
        `/provider/team-displays?q=${encodeURIComponent(query.value)}&offset=${offset}`,
      );
      if (closed || generation !== request) return;
      const teams = response?.data?.teams;
      if (!Array.isArray(teams)) throw new Error(t(PROVIDER_ERROR_KEY));
      if (!offset) rows.replaceChildren();
      for (const team of teams) {
        if (typeof team.participantId !== 'string' || typeof team.participantName !== 'string')
          throw new Error(t(PROVIDER_ERROR_KEY));
        rows.appendChild(choice(team));
      }
      nextOffset = response?.data?.nextOffset;
      more.hidden = nextOffset === undefined;
      status.textContent = teams.length ? '' : t('teamPresentation.noTeams');
    } catch {
      if (!closed && generation === request) status.textContent = t(PROVIDER_ERROR_KEY);
    } finally {
      if (!closed && generation === request) search.disabled = more.disabled = false;
    }
  }
  function choice(team: { participantId: string; participantName: string }) {
    const row = document.createElement('label');
    row.style.display = 'block';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selected.has(team.participantId);
    input.addEventListener('change', () => {
      if (input.checked) selected.add(team.participantId);
      else selected.delete(team.participantId);
    });
    row.append(input, document.createTextNode(team.participantName));
    return row;
  }
  return {
    selected: () => [...selected],
    destroy: () => {
      closed = true;
      generation++;
    },
  };
}
