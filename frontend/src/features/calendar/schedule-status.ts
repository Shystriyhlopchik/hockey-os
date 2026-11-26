export interface ScheduledMatch {
  status: string;
  startsAt: string | null;
  venue: string;
  scheduleConfirmed?: boolean;
}
export function hasPublicSchedule(match: ScheduledMatch): boolean {
  return !!match.startsAt && (match.status === 'completed' || match.scheduleConfirmed === true);
}
export function scheduleStatus(match: ScheduledMatch): string {
  return match.status === 'completed'
    ? 'Матч завершён'
    : hasPublicSchedule(match)
      ? 'Расписание подтверждено'
      : 'Дата и время уточняются';
}
