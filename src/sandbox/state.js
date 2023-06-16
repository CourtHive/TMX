import { Subject } from 'rxjs';

const subject = new Subject();

let state = {
  id: undefined,
  content: ''
};

export const todoStore = {
  changeContent: (newContent) => (state.content = newContent),
  subscribe: (setState) => subject.subscribe(setState),
  init: () => subject.next(state),
  getState: () => state
};
