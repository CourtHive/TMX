import { lang } from 'services/translator';
import { env } from 'settings/env';

const getFirstDayOfWeek = () => env.calendar.first_day;
const getMonths = () => Object.values(lang.obj('i18n').months);
const formatMonthTitle = (d) => `${getMonths()[d.getMonth()]} ${d.getFullYear()}`;
const formatWeekdayLong = (day) => Object.values(lang.obj('i18n').weekdays)[day];
const formatWeekdayShort = (day) => Object.values(lang.obj('i18n').weekdaysShort)[day];
const formatDay = (d) =>
  `${formatWeekdayLong(d.getDay())}, ${d.getDate()} ${getMonths()[d.getMonth()]} ${d.getFullYear()}`;
export const localeUtils = {
  formatDay,
  getMonths,
  formatMonthTitle,
  getFirstDayOfWeek,
  formatWeekdayLong,
  formatWeekdayShort
};
