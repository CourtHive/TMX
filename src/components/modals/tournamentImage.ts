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

export function editTournamentImage({ callback }: { callback?: (url: string) => void } = {}) {
  let inputs: any,
    imageLoaded = false;

  const tournamentRecord = tournamentEngine.getTournament().tournamentRecord;
  const tournamentImageURL = tournamentRecord?.onlineResources?.find(
    ({ name, resourceType }) => name === 'tournamentImage' && resourceType === 'URL',
  )?.identifier;

  const clearImage = () => {
    const imageEl = document.getElementById('tournamentImagePreview');
    if (imageEl) imageEl.style.display = NONE;
    enableSubmit(true);
  };

  const enableSubmit = (enable?) => {
    const submitButton: any = document.getElementById('createButton');
    const disabled = enable ? false : !imageLoaded && inputs.tournamentImage.value;
    submitButton.disabled = disabled;
  };

  const attemptLoad = () => {
    enableSubmit(false);
    imageLoaded = false;
    const imageEl = document.getElementById('tournamentImagePreview');
    if (imageEl) {
      imageEl.onload = () => {
        imageLoaded = true;
        enableSubmit();
      };
      imageEl['src'] = inputs.tournamentImage.value;
      imageEl.style.display = '';
    }
  };

  const form = (elem) =>
    (inputs = renderForm(elem, [
      {
        onKeyUp: (val) => val.key === 'Enter' && attemptLoad(),
        onChange: () => {
          return inputs.tournamentImage.value ? attemptLoad() : clearImage();
        },
        label: t('modals.tournamentImage.imageLabel'),
        value: tournamentImageURL,
        placeholder: t('modals.tournamentImage.imagePlaceholder'),
        field: 'tournamentImage',
        autocomplete: 'off',
      },
    ]));

  const content = document.createElement('div');
  form(content);
  const image = document.createElement('img');
  image.id = 'tournamentImagePreview';
  image.onload = () => (imageLoaded = true);
  if (tournamentImageURL) image.src = tournamentImageURL;
  image.style.width = '100%';
  content.appendChild(image);

  const submitImage = () => {
    const url = inputs.tournamentImage.value;
    const onlineResource = {
      resourceSubType: 'IMAGE',
      name: 'tournamentImage',
      resourceType: 'URL',
      identifier: url,
    };
    const postMutation = (result) => {
      if (result.success) {
        tmxToast({ message: t('modals.tournamentImage.updated'), intent: 'is-success' });
        if (isFunction(callback)) callback(url);
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
    buttons: [
      { label: t('common.cancel'), intent: 'none', close: true },
      {
        onClick: submitImage,
        intent: 'is-primary',
        id: 'createButton',
        disabled: true,
        label: t('common.save'),
        close: true,
      },
    ],
  });
}
