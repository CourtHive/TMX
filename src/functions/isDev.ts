function getWindow(): any {
  try {
    return globalThis;
  } catch {
    // Window not available (e.g., server-side rendering)
    return undefined;
  }
}

export const isDev = (): boolean => getWindow()?.dev && typeof getWindow()?.dev === 'object';
