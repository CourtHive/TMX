import { fixtures } from 'tods-competition-factory';
import { getConfidenceBand } from '../sorters/ratingSorter';

const { ratingsParameters } = fixtures;

export const ratingFormatter = (rating) => (cell) => {
  const ratingDetails = ratingsParameters[rating];
  const { accessor } = ratingDetails;
  const data = cell.getValue();
  const confidence = data.confidence ?? 100;
  const value = data[accessor];
  const band = getConfidenceBand(confidence);

  const content = document.createElement('span');

  const colorMap = {
    medium: 'darkgreen',
    low: 'lightblue',
    high: 'blue',
  };

  content.style.color = colorMap[band];
  content.innerHTML = value;

  return content;
};
