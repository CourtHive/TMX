import { toggleEditVisibility } from '../../common/toggleEditVisibility';
import { mutationRequest } from 'services/mutation/mutationRequest';
import { fixtures } from 'tods-competition-factory';

// constants
import { ADD_PARTICIPANT_TIME_ITEM } from 'constants/mutationConstants';

const { ratingsParameters } = fixtures;

export function saveRatings(e: any, table: any): void {
  // Dynamically find all rating columns in the table
  const ratingColumns = table
    .getColumns()
    .filter((c: any) => c.getField()?.startsWith('ratings.'))
    .map((c: any) => c.getField());

  toggleEditVisibility({
    columns: ratingColumns,
    classNames: ['saveRatings', 'saveTennisId'],
    visible: false,
    table,
    e,
  });

  for (const field of ratingColumns) {
    table.showColumn(field);
  }
  table.redraw(true);

  const rows = table.getData();
  const methods = rows.flatMap((row: any) => {
    if (!row.ratings) return [];

    return Object.entries(row.ratings)
      .map(([key, ratingData]: [string, any]) => {
        if (!ratingData) return null;
        const upperKey = key.toUpperCase();
        const params = ratingsParameters[upperKey];
        if (!params) return null;

        const accessor = params.accessor || `${key}Rating`;
        const ratingValue = ratingData?.[accessor];
        const confidence = ratingData?.confidence || (ratingValue ? 50 : 0);
        const itemValue = confidence ? { ...ratingData, [accessor]: ratingValue, confidence } : '';

        return {
          method: ADD_PARTICIPANT_TIME_ITEM,
          params: {
            participantId: row.participantId,
            removePriorValues: true,
            timeItem: {
              itemType: `SCALE.RATING.SINGLES.${upperKey}`,
              itemValue,
            },
          },
        };
      })
      .filter(Boolean);
  });

  const postMutation = (result: any) => {
    if (!result.success) console.log(result);
  };
  mutationRequest({ methods, callback: postMutation });
}
