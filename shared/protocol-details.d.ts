export type GoalStrength = 'EV' | 'PP' | 'PP2' | 'SH' | 'SH2';
export type GoalType = 'regular' | 'empty_net' | 'penalty_shot';
export interface GoalContextInput { situation: string; strength?: GoalStrength | null; goalType?: GoalType; goalieId?: number | null; }
export interface GoalContext { strength: GoalStrength | null; goalType: GoalType; }
export interface PenaltyTiming { time: string; start?: string; end?: string; timingMode?: 'start' | 'separate'; }
export const GOAL_STRENGTHS: readonly (readonly [GoalStrength, string])[];
export const GOAL_TYPES: readonly (readonly [GoalType, string])[];
export const OFFICIAL_ROLES: readonly (readonly [string, string])[];
export function goalContext(goal: GoalContextInput): GoalContext;
export function goalContextPatch(goal: GoalContextInput, patch: Partial<GoalContext>): GoalContext & {situation: string; goalieId?: number | null; assist1Id?: null; assist2Id?: null};
export function goalSituationLabel(goal: GoalContextInput): string;
export function penaltyTimingMode(penalty: PenaltyTiming): 'start' | 'separate';
export function penaltyStart(penalty: PenaltyTiming): string;
export function penaltyStartPatch(penalty: PenaltyTiming, start: string): Partial<PenaltyTiming>;
export function penaltyModePatch(penalty: PenaltyTiming, separate: boolean): Partial<PenaltyTiming>;
export function officialCrew(protocol: {referee?: string; sheet?: {officials?: Record<string,string>}}): {key: string; role: string; name: string}[];
