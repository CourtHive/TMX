export const wordValidator = (minWords, maxWords) => (value) => {
  const wordCount = (value || '').split(' ').length;
  return wordCount >= minWords && (!maxWords || (maxWords && wordCount <= maxWords));
};
