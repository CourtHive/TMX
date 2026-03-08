import { createCourtSvg, COURT_SVG_RESOURCE_SUB_TYPE, type CourtSport } from 'services/courtSvg/courtSvgUtil';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { tournamentEngine } from 'tods-competition-factory';
import { tmxToast } from 'services/notifications/tmxToast';
import { renderForm } from 'courthive-components';
import { openModal } from './baseModal/baseModal';
import { isFunction } from 'functions/typeOf';
import { t } from 'i18n';

// constants
import { ADD_ONLINE_RESOURCE } from 'constants/mutationConstants';
import { NONE } from 'constants/tmxConstants';

const COURT_OPTIONS: { sport: CourtSport; label: string }[] = [
  { sport: 'tennis', label: 'Tennis' },
  { sport: 'pickleball', label: 'Pickleball' },
  { sport: 'badminton', label: 'Badminton' },
  { sport: 'basketball', label: 'Basketball' },
  { sport: 'baseball', label: 'Baseball' },
  { sport: 'hockey', label: 'Hockey' },
  { sport: 'padel', label: 'Padel' },
];

export function editTournamentImage({ callback }: { callback?: (url: string) => void } = {}) {
  let inputs: any,
    imageLoaded = false,
    selectedSport: CourtSport | undefined;

  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const imageResource = tournamentRecord?.onlineResources?.find(
    ({ name }: any) => name === 'tournamentImage',
  );
  const tournamentImageURL = imageResource?.resourceType === 'URL' ? imageResource?.identifier : undefined;
  const currentCourtSport =
    imageResource?.resourceSubType === COURT_SVG_RESOURCE_SUB_TYPE ? imageResource?.identifier : undefined;

  selectedSport = currentCourtSport;

  const previewContainer = document.createElement('div');
  previewContainer.id = 'courtSvgPreview';

  const image = document.createElement('img');
  image.id = 'tournamentImagePreview';
  image.onload = () => (imageLoaded = true);
  if (tournamentImageURL) image.src = tournamentImageURL;
  image.style.width = '100%';

  const enableSubmit = (enable?) => {
    const submitButton: any = document.getElementById('createButton');
    if (!submitButton) return;
    submitButton.disabled = enable ? false : !imageLoaded && !selectedSport && inputs?.tournamentImage?.value;
  };

  const clearImage = () => {
    image.style.display = NONE;
    enableSubmit(true);
  };

  const clearCourtPreview = () => {
    previewContainer.innerHTML = '';
  };

  const showCourtPreview = (sport: CourtSport) => {
    clearCourtPreview();
    const svg = createCourtSvg(sport);
    if (svg) {
      svg.style.width = '100%';
      svg.style.height = 'auto';
      svg.style.maxHeight = '200px';
      svg.style.opacity = '0.8';
      svg.style.padding = '16px';
      previewContainer.appendChild(svg);
    }
  };

  const attemptLoad = () => {
    enableSubmit(false);
    imageLoaded = false;
    image.onload = () => {
      imageLoaded = true;
      enableSubmit();
    };
    image.src = inputs.tournamentImage.value;
    image.style.display = '';
  };

  // --- Build content ---
  const content = document.createElement('div');

  // URL input
  const form = (elem) =>
    (inputs = renderForm(elem, [
      {
        onKeyUp: (val) => val.key === 'Enter' && attemptLoad(),
        onChange: () => {
          if (inputs.tournamentImage.value) {
            // URL entered — clear court selection
            selectedSport = undefined;
            courtSelect.value = '';
            clearCourtPreview();
            attemptLoad();
          } else {
            clearImage();
          }
        },
        label: t('modals.tournamentImage.imageLabel'),
        value: tournamentImageURL,
        placeholder: t('modals.tournamentImage.imagePlaceholder'),
        field: 'tournamentImage',
        autocomplete: 'off',
      },
    ]));

  form(content);
  content.appendChild(image);

  // Court SVG selector
  const selectorLabel = document.createElement('label');
  selectorLabel.textContent = t('modals.tournamentImage.courtLabel');
  selectorLabel.style.cssText = 'display:block; margin-top:12px; margin-bottom:4px; font-size:0.9rem; font-weight:500;';
  content.appendChild(selectorLabel);

  const courtSelect = document.createElement('select');
  courtSelect.style.cssText = 'width:100%; padding:6px 8px; border-radius:4px; border:1px solid var(--tmx-border-primary, #ccc); background-color:var(--chc-input-bg, #fff); color:var(--tmx-text-primary, #333); font-size:0.9rem;';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = t('modals.tournamentImage.courtNone');
  courtSelect.appendChild(emptyOption);

  for (const { sport, label } of COURT_OPTIONS) {
    const option = document.createElement('option');
    option.value = sport;
    option.textContent = label;
    if (sport === currentCourtSport) option.selected = true;
    courtSelect.appendChild(option);
  }

  courtSelect.addEventListener('change', () => {
    const value = courtSelect.value as CourtSport | '';
    if (value) {
      selectedSport = value as CourtSport;
      // Clear URL input and image preview
      if (inputs?.tournamentImage) inputs.tournamentImage.value = '';
      image.style.display = NONE;
      imageLoaded = false;
      showCourtPreview(selectedSport);
    } else {
      selectedSport = undefined;
      clearCourtPreview();
    }
    enableSubmit(true);
  });

  content.appendChild(courtSelect);
  content.appendChild(previewContainer);

  // Show initial court preview if one is selected
  if (currentCourtSport) {
    showCourtPreview(currentCourtSport as CourtSport);
  }

  // --- Submit ---
  const submitImage = () => {
    const url = inputs?.tournamentImage?.value;
    let onlineResource;

    if (url) {
      onlineResource = {
        resourceSubType: 'IMAGE',
        name: 'tournamentImage',
        resourceType: 'URL',
        identifier: url,
      };
    } else if (selectedSport) {
      onlineResource = {
        resourceSubType: COURT_SVG_RESOURCE_SUB_TYPE,
        name: 'tournamentImage',
        resourceType: 'OTHER',
        identifier: selectedSport,
      };
    }

    if (!onlineResource) return;

    const postMutation = (result) => {
      if (result.success) {
        tmxToast({ message: t('modals.tournamentImage.updated'), intent: 'is-success' });
        if (isFunction(callback)) callback(selectedSport || url);
      }
    };
    mutationRequest({
      methods: [{ method: ADD_ONLINE_RESOURCE, params: { onlineResource } }],
      callback: postMutation,
    });
  };

  openModal({
    title: t('modals.tournamentImage.title'),
    content,
    config: {
      maxWidth: 500,
      padding: '.5',
      info: `<strong>${t('modals.tournamentImage.imageLabel')}</strong>: ${t('modals.tournamentImage.infoUrl')}<br><br><strong>${t('modals.tournamentImage.courtLabel')}</strong>: ${t('modals.tournamentImage.infoCourt')}`,
    },
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        onClick: submitImage,
        intent: 'is-primary',
        id: 'createButton',
        disabled: !tournamentImageURL && !currentCourtSport,
        label: t('common.save'),
        close: true,
      },
    ],
  });
}
