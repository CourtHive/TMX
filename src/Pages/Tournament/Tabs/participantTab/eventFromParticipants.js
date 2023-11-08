import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { editEvent } from '../eventsTab/editEvent';
import { isFunction } from 'functions/typeOf';

export const eventFromParticipants = (table, callback) => {
  const selected = table.getSelectedData();
  const active = table.getData('active').map((a) => a.participantId);
  const participants = selected.filter((s) => active.includes(s.participantId));

  const postEventCreation = (result) => {
    table.deselectRow();
    if (result?.success) {
      const eventId = result?.results[0]?.event?.eventId;
      if (isFunction(callback)) {
        callback({ eventId });
      } else {
        if (eventId) navigateToEvent({ eventId });
      }
    }
  };
  editEvent({ callback: postEventCreation, participants });
};
