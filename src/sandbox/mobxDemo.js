import { makeObservable, observable, action, autorun } from 'mobx';

export function mobxDemo(enable) {
  // ATTENTION: disables router
  if (enable) {
    class Demo {
      id = Math.random();
      label = '';

      constructor(label = '') {
        makeObservable(this, {
          changeLabel: action,
          label: observable
        });
        this.label = label;
      }

      changeLabel(newLabel) {
        this.label = newLabel;
      }
    }

    const myDemo = new Demo('things');
    autorun(() => {
      document.getElementById('pdfButton').innerHTML = myDemo.label;
    });

    window.myDemo = myDemo;
  }
}
