function getWindow() {
  try {
    return window;
  } catch (e) {
    return undefined;
  }
}

export const isDev = () => getWindow().dev && typeof getWindow().dev === 'object';
