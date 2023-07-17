export const wordValidator = (minWords, maxWords) => (value) => {
  const wordCount = (value || '').trim().split(' ').length;
  return wordCount >= minWords && (!maxWords || (maxWords && wordCount <= maxWords));
};
