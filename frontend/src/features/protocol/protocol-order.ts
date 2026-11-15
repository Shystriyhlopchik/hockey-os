export interface RosterOrder {
  position: string;
  number: number;
}

export function compareRoster(a: RosterOrder, b: RosterOrder): number {
  return Number(b.position === 'G') - Number(a.position === 'G') || a.number - b.number;
}

export function sortRoster<T extends RosterOrder>(entries: readonly T[]): T[] {
  return [...entries].sort(compareRoster);
}

/** Keep the saved sequence and server error numbers separate from the editor's display order. */
export function newestGoalEntries<T>(goals: readonly T[]) {
  return goals.map((goal, index) => ({ goal, index })).reverse();
}

export function withoutGoal<T extends { id: string }>(goals: readonly T[], id: string): T[] {
  return goals.filter((goal) => goal.id !== id);
}

function clock(time: string): number {
  const match = /^(\d+):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : Infinity;
}

export function chronologicalGoals<T extends { period: number; time: string }>(
  goals: readonly T[],
): T[] {
  return [...goals].sort((a, b) => a.period - b.period || clock(a.time) - clock(b.time));
}
