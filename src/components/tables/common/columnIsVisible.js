import { context } from 'services/context';

export const columnIsVisible = (field) => context.columns[field] !== false;
