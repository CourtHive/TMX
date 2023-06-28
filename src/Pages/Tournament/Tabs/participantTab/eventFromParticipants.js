import { navigateToEvent } from 'components/tables/common/navigateToEvent';
import { editEvent } from '../eventsTab/editEvent';

export const eventFromParticipants = (table) => {
  const selected = table.getSelectedData();
  const active = table.getData('active').map((a) => a.participantId);
  const participants = selected.filter((s) => active.includes(s.participantId));

  const postEventCreation = (result) => {
    table.deselectRow();
    if (result?.success) {
      const eventId = result?.event?.eventId;
      if (eventId) navigateToEvent({ eventId });
    }
  };
  editEvent({ callback: postEventCreation, participants });
};
