export function parse({ note, data }: { note?: string; data: string }): any {
  try {
    return JSON.parse(data);
  } catch (err) {
    console.log({ message: 'falied normal parse', note });
  }
}

export function stringify(data: any): string | undefined {
  if (!data) return undefined;
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch (e) {
    return '';
  }
}
