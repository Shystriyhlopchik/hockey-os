export interface GoalieRules {
  periods: number;
  periodMinutes: number;
  overtimeMinutes: number;
}
export interface GoalieRosterEntry {
  playerId: number;
  position: string;
  played: boolean;
}
export interface GoalieGoal {
  id: string;
  teamId: number;
  period: number;
  time: string;
  situation: string;
  goalieId?: number | null;
}
export interface GoalieProtocol {
  timeBasis?: string;
  detailLevel: string;
  resolution: string;
  homeRoster: readonly GoalieRosterEntry[];
  awayRoster: readonly GoalieRosterEntry[];
  goals: readonly GoalieGoal[];
  goalieShifts: readonly {
    teamId: number;
    playerId: number | null;
    from: string;
    to: string;
  }[];
}
export interface GoalieMatch {
  homeTeamId: number;
  awayTeamId: number;
}
export interface GoalieIssue {
  teamId: number;
  goalId?: string;
  message: string;
}
export interface GoalieAssignment {
  goalId: string;
  teamId: number;
  goalieId: number | null | undefined;
  status: "assigned" | "empty_net" | "missing" | "ambiguous" | "conflict";
}
export interface GoalieRow {
  teamId: number;
  playerId: number;
  seconds: number;
  knownGoalsAgainst: number;
  goalsAgainst: number | null;
  complete: boolean;
  participated: boolean;
}
export interface GoalieSummary {
  durationSeconds: number | null;
  rows: GoalieRow[];
  issues: GoalieIssue[];
  assignments: GoalieAssignment[];
  emptyNetGoals: Record<number, number>;
}
export function goalieSummary(
  protocol: GoalieProtocol,
  match: GoalieMatch,
  rules: GoalieRules,
): GoalieSummary;
export function goalieMatchDuration(
  protocol: GoalieProtocol,
  rules: GoalieRules,
): number | null;
export function formatGoalieTime(seconds: number | null | undefined): string;
