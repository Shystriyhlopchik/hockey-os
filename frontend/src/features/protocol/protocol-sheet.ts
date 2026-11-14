export const OFFICIAL_FIELDS = [
  ['referee2', 'Второй главный судья'],
  ['linesman1', 'Первый линейный судья'],
  ['linesman2', 'Второй линейный судья'],
  ['timekeeper', 'Судья времени матча'],
  ['announcer', 'Информатор'],
  ['penaltyHome', 'При оштрафованных игроках · А'],
  ['penaltyAway', 'При оштрафованных игроках · Б'],
  ['scorekeeperHome', 'Судья-регистратор · А'],
  ['scorekeeperAway', 'Судья-регистратор · Б'],
  ['goalJudge1', 'Судья за воротами · 1'],
  ['goalJudge2', 'Судья за воротами · 2'],
  ['reserveReferee', 'Резервный главный судья'],
  ['reserveLinesman', 'Резервный линейный судья'],
  ['videoJudge', 'Судья видеоповторов'],
  ['inspector', 'Инспектор'],
  ['secretary', 'Секретарь'],
  ['chiefReferee', 'Главный судья соревнований'],
];
export const STAFF_FIELDS = [
  ['headCoach', 'Главный тренер'],
  ['coach', 'Тренер'],
  ['manager', 'Начальник команды'],
  ['representative', 'Представитель команды'],
];
export const SITUATIONS = [
  ['EV', 'Равные составы'],
  ['PP', '+1 · Большинство'],
  ['PP2', '+2 · Двойное большинство'],
  ['SH', '−1 · Меньшинство'],
  ['SH2', '−2 · Двойное меньшинство'],
  ['EN', 'ПВ · Пустые ворота'],
  ['PS', 'ШБ · Штрафной бросок'],
];
export const PENALTY_CODES = [
  ['АГРЕС', 'Агрессор в драке'],
  ['АТ-В-ГОЛ', 'Атака в область головы и шеи'],
  ['БЛОК', 'Атака игрока, не владеющего шайбой'],
  ['АТ-СЗ', 'Атака сзади'],
  ['БР-КЛ', 'Бросок клюшки'],
  ['ГРУБ', 'Грубость'],
  ['ВБ-ШБ', 'Выброс шайбы'],
  ['ДИСЦ', 'Дисциплинарный штраф'],
  ['ДИС-КН', 'Дисциплинарный до конца игры'],
  ['ДРАКА', 'Драка'],
  ['ЗАЧИН', 'Зачинщик драки'],
  ['ЗД-ИГ', 'Задержка игры'],
  ['ЗД-КЛ-СП', 'Задержка клюшки соперника'],
  ['ЗД-КЛ', 'Задержка клюшкой'],
  ['ЗД-РУК', 'Задержка руками'],
  ['ЗД-ШБ', 'Задержка шайбы руками'],
  ['ИС-ГР', 'Исключительная грубость'],
  ['СЛ-КЛ', 'Игра сломанной клюшкой'],
  ['КЛ-УД', 'Колющий удар'],
  ['МТ-ШТ', 'Матч-штраф'],
  ['СК-ШТ', 'Малый скамеечный штраф'],
  ['НАР-ЭК', 'Незаконное и опасное снаряжение'],
  ['НП-АТ', 'Неправильная атака'],
  ['ЧС-СТ', 'Нарушение численного состава'],
  ['ВП-КЛ', 'Опасная игра высоко поднятой клюшкой'],
  ['НС-ПВ', 'Оскорбление судей и неспортивное поведение'],
  ['ОТ-ИГ', 'Отказ начать игру'],
  ['ОТСЧ', 'Отсечение'],
  ['ПОДН', 'Подножка'],
  ['ПР-ИН', 'Предупреждение инфекций'],
  ['ПК-СК', 'Покидание скамейки'],
  ['СД-ВР', 'Сдвиг ворот'],
  ['СИМ', 'Симуляция'],
  ['ТЛ-БР', 'Толчок на борт'],
  ['ТЛ-КЛ', 'Толчок клюшкой'],
  ['УД-ГОЛ', 'Удар головой'],
  ['УД-КЛ', 'Удар клюшкой'],
  ['УД-К-КЛ', 'Удар концом клюшки'],
  ['УД-КОЛ', 'Удар коленом'],
  ['УД-ЛОК', 'Удар локтем'],
  ['УД-НГ', 'Удар ногой'],
  ['КН-ЗР', 'Физический контакт со зрителем'],
  ['ШТ-ВР', 'Штрафы вратаря'],
];
export function prepareSheet(protocol: any, match: any, city = '') {
  const source = protocol.sheet || {},
    staff = { headCoach: '', coach: '', manager: '', representative: '' };
  return {
    ...protocol,
    goals: protocol.goals.map((g: any) => ({
      ...g,
      homeOnIce: [...(g.homeOnIce || [])],
      awayOnIce: [...(g.awayOnIce || [])],
    })),
    sheet: {
      matchNumber: String(match.id),
      city,
      startedAt: '',
      endedAt: '',
      disciplinaryNotes: '',
      matchNotes: '',
      injuryNotes: '',
      protestNotes: '',
      ...source,
      homeStaff: { ...staff, ...source.homeStaff },
      awayStaff: { ...staff, ...source.awayStaff },
      officials: {
        ...Object.fromEntries(OFFICIAL_FIELDS.map(([key]) => [key, ''])),
        ...source.officials,
      },
      timeouts: (source.timeouts || []).map((t: any) => ({ ...t })),
      missedShots: (source.missedShots || []).map((s: any) => ({ ...s })),
    },
  };
}
export function periodSummary(p: any, match: any, rules: any) {
  const count = Math.min(
    rules.periods + 20,
    Math.max(
      rules.periods,
      ...p.goals.map((g: any) => Number(g.period) || 0),
      ...p.penalties.map((g: any) => Number(g.period) || 0),
    ),
  );
  const rows = Array.from({ length: count }, (_, i) => ({
    label: i < rules.periods ? String(i + 1) : `ОТ${i - rules.periods + 1}`,
    home: 0,
    away: 0,
    homePenalty: 0,
    awayPenalty: 0,
  }));
  for (const goal of p.goals)
    if (rows[goal.period - 1])
      rows[goal.period - 1][goal.teamId === match.homeTeamId ? 'home' : 'away']++;
  for (const pen of p.penalties)
    if (rows[pen.period - 1])
      rows[pen.period - 1][pen.teamId === match.homeTeamId ? 'homePenalty' : 'awayPenalty'] +=
        Number(pen.minutes) || 0;
  if (p.resolution === 'shootout') {
    const home = p.shootout.filter((s: any) => s.teamId === match.homeTeamId && s.scored).length,
      away = p.shootout.filter((s: any) => s.teamId === match.awayTeamId && s.scored).length;
    rows.push({
      label: 'БП',
      home: home > away ? 1 : 0,
      away: away > home ? 1 : 0,
      homePenalty: 0,
      awayPenalty: 0,
    });
  }
  const total = {
    label: 'Общий',
    home: rows.reduce((n, r) => n + r.home, 0),
    away: rows.reduce((n, r) => n + r.away, 0),
    homePenalty: rows.reduce((n, r) => n + r.homePenalty, 0),
    awayPenalty: rows.reduce((n, r) => n + r.awayPenalty, 0),
  };
  if (p.detailLevel === 'score_only' || p.resolution === 'technical') {
    total.home = p.manualHomeScore ?? 0;
    total.away = p.manualAwayScore ?? 0;
    return { rows: [], total };
  }
  return { rows, total };
}
export function protocolWarnings(p: any, match: any, rules: any): string[] {
  const messages: string[] = [];
  if (p.detailLevel === 'full' && p.resolution !== 'technical')
    for (const [id, list] of [
      [match.homeTeamId, p.homeRoster],
      [match.awayTeamId, p.awayRoster],
    ]) {
      const title = id === match.homeTeamId ? 'Хозяева' : 'Гости',
        goalies = list.filter((r: any) => r.position === 'G').length,
        skaters = list.length - goalies;
      if (skaters < rules.minSkaters || skaters > rules.maxSkaters)
        messages.push(
          `${title}: проверьте количество полевых (${skaters}; разрешено ${rules.minSkaters}–${rules.maxSkaters}).`,
        );
      if (goalies < rules.minGoalies || goalies > rules.maxGoalies)
        messages.push(
          `${title}: проверьте количество вратарей (${goalies}; разрешено ${rules.minGoalies}–${rules.maxGoalies}).`,
        );
      if (new Set(list.map((r: any) => r.number)).size !== list.length)
        messages.push(`${title}: повторяются номера игроков.`);
    }
  if (!p.referee.trim()) messages.push('Не указан главный судья.');
  if (!p.sheet?.officials?.secretary?.trim()) messages.push('Не указан секретарь матча.');
  if (p.detailLevel === 'full' && p.resolution !== 'technical' && !p.goalieShifts.length)
    messages.push('Не внесено время игры вратарей.');
  const { total } = periodSummary(p, match, rules);
  if (p.resolution === 'draw' && total.home !== total.away)
    messages.push('Выбрана ничья, но счёт команд различается.');
  if (p.resolution === 'regulation' && total.home === total.away)
    messages.push('При равном счёте выберите ничью или способ определения победителя.');
  return messages;
}
