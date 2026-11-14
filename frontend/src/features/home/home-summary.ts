import type { LeagueMatch, PlayerStat } from '../../core/models/league';
export function homeSummary(
  matches: readonly LeagueMatch[],
  stats: readonly PlayerStat[],
  teams: number,
) {
  const completed = matches.filter((match) => match.status === 'completed');
  return {
    teams,
    played: completed.length,
    remaining: matches.filter((match) => match.status === 'scheduled').length,
    goals: completed.reduce(
      (sum, match) => sum + (match.homeScore || 0) + (match.awayScore || 0),
      0,
    ),
    players: new Set(stats.filter((row) => row.games > 0).map((row) => row.playerId)).size,
    assists: stats.reduce((sum, row) => sum + row.assists, 0),
    penalties: stats.reduce((sum, row) => sum + row.penaltyMinutes, 0),
  };
}
