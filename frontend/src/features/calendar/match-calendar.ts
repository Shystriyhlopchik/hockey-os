export interface CalendarMatch {
  id: number;
  tournamentId: number;
  startsAt: string | null;
  status: string;
}
export interface CalendarTournament {
  id: number;
  seasonId: number;
  status: string;
}
function startTime(match: CalendarMatch): number {
  const timestamp = match.startsAt ? Date.parse(match.startsAt) : NaN;
  return Number.isFinite(timestamp) ? timestamp : Infinity;
}
export function sortMatches<T extends CalendarMatch>(
  matches: readonly T[],
  direction: 'asc' | 'desc' = 'asc',
): T[] {
  const sign = direction === 'asc' ? 1 : -1;
  return [...matches].sort((a, b) => {
    const left = startTime(a),
      right = startTime(b);
    if (left === right) return sign * (a.id - b.id);
    if (left === Infinity) return 1;
    if (right === Infinity) return -1;
    return sign * (left - right);
  });
}
export function listPublicMatches<T extends CalendarMatch>(
  matches: readonly T[],
  tournaments: readonly CalendarTournament[],
  seasonId = 0,
): T[] {
  const visible = new Set(
    tournaments.filter((t) => !seasonId || t.seasonId === seasonId).map((t) => t.id),
  );
  return sortMatches(
    matches.filter((m) => visible.has(m.tournamentId) && m.status !== 'cancelled'),
  );
}
export function upcomingMatches<T extends CalendarMatch>(
  matches: readonly T[],
  now = Date.now(),
  limit = 4,
): T[] {
  return sortMatches(
    matches.filter(
      (m) => m.status === 'scheduled' && startTime(m) !== Infinity && startTime(m) >= now,
    ),
  ).slice(0, limit);
}
export function upcomingActiveMatches<T extends CalendarMatch>(
  matches: readonly T[],
  tournaments: readonly CalendarTournament[],
  now = Date.now(),
  limit = 4,
): T[] {
  const active = tournaments.filter((t) => t.status === 'active');
  return upcomingMatches(listPublicMatches(matches, active), now, limit);
}
export function recentTournamentResults<T extends CalendarMatch>(
  matches: readonly T[],
  tournamentId: number | undefined,
  limit = 4,
): T[] {
  return sortMatches(
    matches.filter((match) => match.tournamentId === tournamentId && match.status === 'completed'),
    'desc',
  ).slice(0, limit);
}
