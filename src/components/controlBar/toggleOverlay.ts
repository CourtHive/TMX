import { CENTER, EMPTY_STRING, FLEX, LEFT, NONE, OVERLAY, RIGHT } from 'constants/tmxConstants';

export const toggleOverlay =
  ({ target }: { target: HTMLElement }) =>
  (rows: any[] = []): void => {
    target.style.backgroundColor = rows?.length ? 'lightgray' : EMPTY_STRING;
    const toggleOption = (option: string, hasRows: string, noRows: string) => {
      const element = target.getElementsByClassName(`options_${option}`)[0] as HTMLElement;
      if (element) element.style.display = rows?.length ? hasRows : noRows;
    };
    toggleOption(OVERLAY, FLEX, NONE);
    toggleOption(LEFT, NONE, FLEX);
    toggleOption(CENTER, NONE, FLEX);
    toggleOption(RIGHT, NONE, FLEX);
  };
