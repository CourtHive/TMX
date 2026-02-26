import { getConfidenceBand } from '../sorters/ratingSorter';
import { fixtures } from 'tods-competition-factory';

const { ratingsParameters } = fixtures;

export const ratingFormatter =
  (rating: string) =>
  (cell: any): HTMLSpanElement => {
    const ratingDetails = ratingsParameters[rating];
    const accessor = ratingDetails?.accessor || `${rating.toLowerCase()}Rating`;
    const data = cell.getValue();
    const confidence = data?.confidence ?? 100;
    const value = data?.[accessor];
    const band = getConfidenceBand(confidence);

    const content = document.createElement('span');

    const colorMap: Record<string, string> = {
      medium: 'var(--tmx-accent-green)',
      low: 'var(--tmx-accent-teal)',
      high: 'var(--tmx-accent-blue)',
    };

    content.style.color = colorMap[band];
    content.innerHTML = value ?? '';

    return content;
  };
