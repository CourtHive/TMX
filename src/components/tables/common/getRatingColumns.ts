/**
 * Dynamically generate Tabulator column definitions for all rating types present in data.
 * Scans data to discover which ratings exist and creates columns with appropriate formatters/sorters.
 */
import { ratingFormatter } from './formatters/ratingFormatter';
import { numericEditor } from './editors/numericEditor';
import { ratingSorter } from './sorters/ratingSorter';
import { fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

type RatingColumnStyle = 'participant' | 'entry';

/**
 * Discover which ratings exist in the data and return column configs.
 * @param data - array of mapped participant/entry objects (must have `ratings` property)
 * @param style - 'participant' uses nested accessor field paths; 'entry' uses flat field paths
 */
export function getRatingColumns(data: any[], style: RatingColumnStyle): any[] {
  // Collect all rating keys present across the data
  const presentRatings = new Set<string>();
  for (const item of data) {
    if (item.ratings) {
      for (const key of Object.keys(item.ratings)) {
        presentRatings.add(key);
      }
    }
  }

  const columns: any[] = [];

  for (const key of presentRatings) {
    const upperKey = key.toUpperCase();
    const params = ratingsParameters[upperKey];
    if (!params) continue;

    const { range } = params;
    const accessor = params.accessor || `${key}Rating`;
    const [rangeA, rangeB] = range || [0, 100];
    const maxValue = Math.max(rangeA, rangeB);
    const width = upperKey.length > 3 ? 70 + (upperKey.length - 3) * 10 : 70;

    if (style === 'participant') {
      // Participants table: data is nested like ratings.wtn.wtnRating
      const field = `ratings.${key}.${accessor}`;
      columns.push({
        editor: numericEditor({ maxValue, decimals: true, field }),
        sorterParams: { alignEmptyValues: 'bottom' },
        responsive: true,
        resizable: false,
        sorter: 'number',
        editable: false,
        visible: true,
        title: upperKey,
        width,
        field,
      });
    } else {
      // Entry/draw tables: data is like ratings.wtn (object with accessor inside)
      const field = `ratings.${key}`;
      columns.push({
        formatter: ratingFormatter(upperKey),
        sorter: ratingSorter(upperKey),
        resizable: false,
        visible: true,
        title: upperKey,
        width,
        field,
      });
    }
  }

  // Sort columns alphabetically by title for consistent ordering
  columns.sort((a, b) => a.title.localeCompare(b.title));

  return columns;
}
