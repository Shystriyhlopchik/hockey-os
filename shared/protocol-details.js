export const GOAL_STRENGTHS = [
  ['EV', 'В равных составах'], ['PP', 'В большинстве'], ['PP2', 'В двойном большинстве'],
  ['SH', 'В меньшинстве'], ['SH2', 'В двойном меньшинстве'],
];
export const GOAL_TYPES = [['regular', 'Обычный гол'], ['empty_net', 'В пустые ворота'], ['penalty_shot', 'Штрафной бросок']];
export const OFFICIAL_ROLES = [
  ['referee2', 'Второй главный судья'], ['linesman1', 'Первый линейный судья'], ['linesman2', 'Второй линейный судья'],
  ['timekeeper', 'Судья времени матча'], ['announcer', 'Информатор'], ['penaltyHome', 'При оштрафованных игроках · А'],
  ['penaltyAway', 'При оштрафованных игроках · Б'], ['scorekeeperHome', 'Судья-регистратор · А'], ['scorekeeperAway', 'Судья-регистратор · Б'],
  ['goalJudge1', 'Судья за воротами · 1'], ['goalJudge2', 'Судья за воротами · 2'], ['reserveReferee', 'Резервный главный судья'],
  ['reserveLinesman', 'Резервный линейный судья'], ['videoJudge', 'Судья видеоповторов'], ['inspector', 'Инспектор'],
  ['secretary', 'Секретарь'], ['chiefReferee', 'Главный судья соревнований'],
];
export function goalContext(goal) {
  return {
    strength: goal.strength !== undefined ? goal.strength : GOAL_STRENGTHS.some(([code]) => code === goal.situation) ? goal.situation : null,
    goalType: goal.goalType || (goal.situation === 'EN' ? 'empty_net' : goal.situation === 'PS' ? 'penalty_shot' : 'regular'),
  };
}
export function goalContextPatch(goal, patch) {
  let {strength, goalType} = {...goalContext(goal), ...patch};
  if (goalType === 'penalty_shot') strength = null;
  return {
    strength, goalType,
    situation: goalType === 'empty_net' ? 'EN' : goalType === 'penalty_shot' ? 'PS' : strength || 'EV',
    ...(goalType === 'empty_net' ? {goalieId: null} : goal.goalieId === null ? {goalieId: undefined} : {}),
    ...(goalType === 'penalty_shot' ? {assist1Id: null, assist2Id: null} : {}),
  };
}
export function goalSituationLabel(goal) {
  const {strength, goalType} = goalContext(goal);
  if (goalType === 'penalty_shot') return 'Штрафной бросок';
  const label = GOAL_STRENGTHS.find(([code]) => code === strength)?.[1] || 'Составы не указаны';
  return goalType === 'empty_net' ? `${label} · В пустые ворота` : label;
}
export function penaltyTimingMode(penalty) {
  return penalty.timingMode || (penalty.start && penalty.start !== penalty.time ? 'separate' : 'start');
}
export function penaltyStart(penalty) { return penalty.start || penalty.time || ''; }
export function penaltyStartPatch(penalty, start) {
  const timingMode = penaltyTimingMode(penalty);
  return {start, timingMode, ...(timingMode === 'start' ? {time: start} : {})};
}
export function penaltyModePatch(penalty, separate) {
  const start = penaltyStart(penalty);
  return {timingMode: separate ? 'separate' : 'start', start, ...(!separate ? {time: start} : {})};
}
export function officialCrew(protocol) {
  return [['referee', 'Главный судья'], ...OFFICIAL_ROLES].map(([key, role]) => ({key, role,
    name: (key === 'referee' ? protocol.referee : protocol.sheet?.officials?.[key]) || '',
  })).filter(row => typeof row.name === 'string' && row.name.trim());
}
