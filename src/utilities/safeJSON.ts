export function parse({ note, data }: { note?: string; data: string }): any {
  try {
    return JSON.parse(data);
  } catch {
    // JSON parse failed - log and return undefined
    console.log({ message: 'failed normal parse', note });
  }
}

export function stringify(data: any): string | undefined {
  if (!data) return undefined;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch {
    // JSON stringify failed - return empty string as fallback
    return '';
  }
}
