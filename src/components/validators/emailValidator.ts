export const emailValidator = (value: string): RegExpMatchArray | null => value.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i);
