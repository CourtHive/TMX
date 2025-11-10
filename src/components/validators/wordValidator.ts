export const wordValidator = (minWords: number, maxWords?: number) => (value: string): boolean => {
  const wordCount = (value || '').trim().split(' ').length;
  return wordCount >= minWords && (!maxWords || wordCount <= maxWords);
};
