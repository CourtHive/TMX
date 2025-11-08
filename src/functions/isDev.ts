function getWindow(): any {
  try {
    return window;
  } catch (e) {
    return undefined;
  }
}

export const isDev = (): boolean => getWindow()?.dev && typeof getWindow()?.dev === 'object';
