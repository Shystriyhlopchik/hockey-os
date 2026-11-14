export interface ScheduleMatch {
  id: number;
  tournamentId: number;
  stage: string;
  round: number;
  status: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  startsAt: string | null;
  venue: string;
  slotMinutes: number;
}
export interface ScheduleRow extends Omit<ScheduleMatch, 'startsAt'> {
  startsAt: string;
  originalStartsAt: string;
  expected: {
    round: number;
    startsAt: string | null;
    venue: string;
    slotMinutes: number;
  };
}
export function scheduleGroupKey(match: Pick<ScheduleMatch, 'stage' | 'round'>): string {
  return `${match.stage}:${match.round}`;
}
// Keep a match in its original group until saving, so editing its round cannot remove the focused row.
export function originalScheduleGroupKey(row: ScheduleRow): string {
  return scheduleGroupKey({ stage: row.stage, round: row.expected.round });
}
export function scheduleRowsInGroup(rows: readonly ScheduleRow[], key: string): ScheduleRow[] {
  return rows.filter((row) => key === 'all' || originalScheduleGroupKey(row) === key);
}
export function createScheduleRows(matches: readonly ScheduleMatch[]): ScheduleRow[] {
  return matches.map((match) => {
    const startsAt = match.startsAt
      ? new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Europe/Moscow',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
          .format(new Date(match.startsAt))
          .replace(' ', 'T')
      : '';
    return {
      ...match,
      startsAt,
      originalStartsAt: startsAt,
      expected: {
        round: match.round,
        startsAt: match.startsAt,
        venue: match.venue,
        slotMinutes: match.slotMinutes,
      },
    };
  });
}
export function scheduleGroups(rows: readonly ScheduleRow[]): {
  key: string;
  label: string;
  pending: number;
}[] {
  const groups = new Map<
    string,
    {
      key: string;
      label: string;
      pending: number;
    }
  >();
  const labels: Record<string, string> = {
    quarter: '¼ финала',
    semi: '½ финала',
    final: 'Финал',
  };
  for (const row of rows) {
    if (row.status !== 'scheduled') continue;
    const round = row.expected.round,
      key = originalScheduleGroupKey(row);
    const label =
      row.stage === 'regular'
        ? `Тур ${round}`
        : `Плей-офф · ${labels[row.stage] || row.stage} · серия ${round}`;
    const group = groups.get(key) || { key, label, pending: 0 };
    group.pending++;
    groups.set(key, group);
  }
  const stages = ['regular', 'quarter', 'semi', 'final'];
  return [...groups.values()].sort((a, b) => {
    const [stageA, roundA] = a.key.split(':'),
      [stageB, roundB] = b.key.split(':');
    return stages.indexOf(stageA) - stages.indexOf(stageB) || Number(roundA) - Number(roundB);
  });
}
export function nearestScheduleGroup(rows: readonly ScheduleRow[], now = Date.now()): string {
  const future = rows
    .filter(
      (row) =>
        row.status === 'scheduled' &&
        row.expected.startsAt &&
        Date.parse(row.expected.startsAt) >= now,
    )
    .sort(
      (a, b) => Date.parse(a.expected.startsAt!) - Date.parse(b.expected.startsAt!) || a.id - b.id,
    );
  return future.length ? originalScheduleGroupKey(future[0]) : scheduleGroups(rows)[0]?.key || '';
}
export function changedScheduleRows(rows: readonly ScheduleRow[]): ScheduleRow[] {
  return rows.filter(
    (row) =>
      row.status === 'scheduled' &&
      (Number(row.round) !== row.expected.round ||
        row.startsAt !== row.originalStartsAt ||
        row.venue.trim() !== row.expected.venue ||
        Number(row.slotMinutes) !== row.expected.slotMinutes),
  );
}
export function scheduleChanges(rows: readonly ScheduleRow[]) {
  return changedScheduleRows(rows).map((row) => {
    const round = Number(row.round);
    if (!Number.isInteger(round) || round < 1 || round > 1000)
      throw new Error(`Номер тура матча №${row.id}: целое число от 1 до 1000`);
    if (row.stage !== 'regular' && round !== row.expected.round)
      throw new Error('Матчи плей-офф нельзя переносить в другую серию');
    if (row.startsAt && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(row.startsAt))
      throw new Error(`Укажите дату и время матча №${row.id}`);
    const date = row.startsAt ? new Date(row.startsAt + ':00+03:00') : null;
    if (date && Number.isNaN(+date)) throw new Error(`Некорректная дата матча №${row.id}`);
    const slotMinutes = Number(row.slotMinutes);
    if (!Number.isInteger(slotMinutes) || slotMinutes < 60 || slotMinutes > 300)
      throw new Error(`Занятость площадки для матча №${row.id}: от 60 до 300 минут`);
    if (!row.venue.trim() || row.venue.length > 200)
      throw new Error(`Укажите площадку матча №${row.id} (до 200 символов)`);
    return {
      id: row.id,
      round,
      startsAt: date?.toISOString() ?? null,
      venue: row.venue.trim(),
      slotMinutes,
      expected: { ...row.expected },
    };
  });
}
export function applyScheduleBulk(
  rows: ScheduleRow[],
  key: string,
  date: string,
  venue: string,
): void {
  if (key === 'all') throw new Error('Для общей даты и площадки выберите один тур');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Укажите дату тура');
  for (const row of scheduleRowsInGroup(rows, key)) {
    if (row.status !== 'scheduled') continue;
    if (date) row.startsAt = date + 'T' + (row.startsAt.slice(11, 16) || '12:00');
    if (venue.trim()) row.venue = venue.trim();
  }
}
