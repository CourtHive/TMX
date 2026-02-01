/**
 * Invalid Participants Modal - displays participants that failed validation when adding to event
 * Shows table with participant names and reasons for validation failure
 */
import { TabulatorFull as Tabulator } from 'tabulator-tables';
import { tournamentEngine } from 'tods-competition-factory';
import { cModal } from 'courthive-components';

export interface InvalidParticipant {
  participantId: string;
  errors: Array<{
    error: string;
    [key: string]: any;
  }>;
}

export interface InvalidParticipantsModalParams {
  invalidParticipants: InvalidParticipant[];
}

// Map error codes to human-readable messages with optional context
function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    const errorMessages: Record<string, string> = {
      mismatchedGender: 'Gender does not match event requirements',
      invalidAge: 'Age outside category range',
      invalidRating: 'Rating outside category range',
      age: 'Age outside category range',
      rating: 'Rating outside category range',
    };
    return errorMessages[error] || error;
  }

  // If error has a reason field, use it directly (from categoryRejections)
  if (error.reason) {
    return error.reason;
  }

  // Handle error objects with additional context
  const errorCode = error.error;
  switch (errorCode) {
    case 'mismatchedGender':
      return `Gender mismatch: ${error.sex} participant in ${error.expectedGender} event`;
    case 'age':
    case 'invalidAge':
      return error.reason || 'Age outside category range';
    case 'rating':
    case 'invalidRating':
      return error.reason || 'Rating outside category range';
    default:
      return error.message || errorCode || 'Validation error';
  }
}

export function invalidParticipantsModal({ invalidParticipants }: InvalidParticipantsModalParams): void {
  if (!invalidParticipants?.length) {
    console.error('No invalid participants provided');
    return;
  }

  // Check if we need to fetch participant names
  const needsNames = invalidParticipants.some((ip: any) => !ip.participantName);
  
  let participantMap: Map<string, any> | undefined;
  
  if (needsNames) {
    // Extract participant IDs that need names
    const participantIds = invalidParticipants
      .filter((ip: any) => !ip.participantName)
      .map((ip) => ip.participantId);

    // Fetch participant details from tournament engine
    const { participants } = tournamentEngine.getParticipants({
      participantFilters: { participantIds },
      withIndividualParticipants: true,
    }) ?? {};

    if (!participants?.length && participantIds.length) {
      console.error('Could not fetch participant details');
      return;
    }

    // Create a map of participantId to participant for quick lookup
    participantMap = new Map(participants?.map((p: any) => [p.participantId, p]) || []);
  }

  // Transform data for table display
  const tableData = invalidParticipants.map((invalid: any) => {
    // Use provided participantName or fetch from map
    let participantName = invalid.participantName;
    if (!participantName && participantMap) {
      const participant: any = participantMap.get(invalid.participantId);
      participantName = participant?.participantName || 'Unknown Participant';
    }

    // Collect all error reasons
    const reasons = invalid.errors.map((err: any) => getErrorMessage(err)).join('; ');

    return {
      participantId: invalid.participantId,
      participantName,
      reasons,
    };
  });

  // Create modal content container
  const content = document.createElement('div');
  content.style.width = '100%';

  // Table container
  const tableElement = document.createElement('div');
  tableElement.className = 'tmxTable';
  tableElement.style.width = '100%';
  content.appendChild(tableElement);

  // Define table columns
  const columns = [
    {
      title: 'Participant',
      field: 'participantName',
      widthGrow: 2,
      headerSort: false,
    },
    {
      title: 'Reason',
      field: 'reasons',
      widthGrow: 3,
      headerSort: false,
    },
  ];

  // Initialize Tabulator table
  const table = new Tabulator(tableElement, {
    columns,
    data: tableData,
    layout: 'fitColumns',
    height: Math.min(300 + tableData.length * 40, 600), // Dynamic height based on rows
    placeholder: 'No invalid participants',
  });

  // Clean up table when modal closes
  const onClose = () => {
    table?.destroy();
  };

  // Open modal
  cModal.open({
    title: 'Invalid Participants',
    content,
    buttons: [
      {
        label: 'OK',
        close: true,
      },
    ],
    config: {
      maxWidth: 800,
    },
    onClose,
  });
}
