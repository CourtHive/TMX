import { tools } from 'tods-competition-factory';

const { extractTime, timeStringMinutes } = tools.dateTime;

export function matchUpScheduleSort(a: any, b: any): number {
  const scheduleA = a.schedule ?? {};
  const scheduleB = b.schedule ?? {};
  if (scheduleA.scheduledDate && !scheduleB.scheduledDate) return 1;
  if (scheduleB.scheduledDate && !scheduleA.scheduledDate) return -1;
  if (scheduleA.scheduledDate && scheduleB.scheduledDate) {
    if (scheduleA.scheduledDate === scheduleB.scheduledDate) {
      if (scheduleA.scheduleTime && !scheduleB.scheduleTime) return 1;
      if (scheduleB.scheduleTime && !scheduleA.scheduleTime) return -1;
      if (scheduleA.scheduleTime && scheduleB.scheduleTime) {
        const timeA = timeStringMinutes(extractTime(scheduleA.scheduleTime));
        const timeB = timeStringMinutes(extractTime(scheduleB.scheduleTime));
        return timeA - timeB;
      }
    }
    return new Date(scheduleA.scheduledDate).getTime() - new Date(scheduleB.scheduledDate).getTime();
  }
  return 0;
}
