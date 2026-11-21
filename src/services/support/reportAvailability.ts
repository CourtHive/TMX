import { networkIsIsolated, onNetworkIsolation } from 'services/network/networkPolicy';

export const supportReportingAvailable = (): boolean => !networkIsIsolated();

// One application-lifetime listener also hides actions rendered before isolation starts.
// Help refreshes its action when opened after return; old transient toast actions stay hidden.
onNetworkIsolation(() => {
  globalThis.document
    ?.querySelectorAll<HTMLElement>('.tmx-support-entry, .tmx-support-report-toast button:not(.delete)')
    .forEach((element) => {
      element.hidden = true;
    });
});
