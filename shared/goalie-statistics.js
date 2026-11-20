// Pure shared calculation: the editor preview and published API use the same rules.
function seconds(value) {
  if (typeof value !== "string" || !/^\d{1,4}:\d{2}$/.test(value)) return null;
  const [minutes, remainder] = value.split(":").map(Number);
  return remainder < 60 ? minutes * 60 + remainder : null;
}
function goalSeconds(goal, protocol, rules) {
  const value = seconds(goal.time);
  if (value === null || !Number.isInteger(goal.period) || goal.period < 1)
    return null;
  const regular = goal.period <= rules.periods;
  const length = (regular ? rules.periodMinutes : rules.overtimeMinutes) * 60;
  const start = regular
    ? (goal.period - 1) * length
    : rules.periods * rules.periodMinutes * 60 +
      (goal.period - rules.periods - 1) * length;
  const elapsed = protocol.timeBasis === "match" ? value : start + value;
  return elapsed >= start && elapsed <= start + length ? elapsed : null;
}
export function goalieMatchDuration(protocol, rules) {
  const regular = rules.periods * rules.periodMinutes * 60;
  if (!Number.isFinite(regular) || regular <= 0) return null;
  if (protocol.resolution === "shootout")
    return regular + rules.overtimeMinutes * 60;
  if (protocol.resolution !== "overtime") return regular;
  const goals = protocol.goals.filter((goal) => goal.period > rules.periods);
  const times = goals.map((goal) => goalSeconds(goal, protocol, rules));
  return times.length && times.every((time) => time !== null)
    ? Math.max(...times)
    : null;
}
export function formatGoalieTime(value) {
  if (!Number.isFinite(value) || value < 0) return "—";
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
}
export function goalieSummary(protocol, match, rules) {
  const summary = {
    durationSeconds: goalieMatchDuration(protocol, rules),
    rows: [],
    issues: [],
    assignments: [],
    emptyNetGoals: {},
  };
  if (protocol.detailLevel !== "full" || protocol.resolution === "technical")
    return summary;
  const duration = summary.durationSeconds;
  for (const [teamId, roster] of [
    [match.homeTeamId, protocol.homeRoster],
    [match.awayTeamId, protocol.awayRoster],
  ]) {
    const teamLabel = teamId === match.homeTeamId ? "Хозяева" : "Гости";
    const issue = (message, goalId) =>
      summary.issues.push({
        teamId,
        ...(goalId ? { goalId } : {}),
        message: `${teamLabel}: ${message}`,
      });
    const keepers = roster.filter((row) => row.position === "G");
    const intervals = [];
    let validIntervals = true;
    for (const shift of protocol.goalieShifts.filter(
      (row) => row.teamId === teamId,
    )) {
      const from = seconds(shift.from),
        to = seconds(shift.to);
      if (
        from === null ||
        to === null ||
        to <= from ||
        duration === null ||
        to > duration ||
        (shift.playerId !== null &&
          !keepers.some((row) => row.playerId === shift.playerId && row.played))
      ) {
        issue("проверьте время и участника интервала игры вратаря.");
        validIntervals = false;
        continue;
      }
      intervals.push({ from, to, playerId: shift.playerId });
    }
    intervals.sort((a, b) => a.from - b.from || a.to - b.to);
    let cursor = 0;
    for (const interval of intervals) {
      if (interval.from !== cursor) validIntervals = false;
      cursor = Math.max(cursor, interval.to);
    }
    const coverage =
      validIntervals &&
      duration !== null &&
      cursor === duration &&
      intervals.length > 0;
    if (!coverage)
      issue(
        "заполните интервалы от начала до конца матча, включая пустые ворота, без пропусков и пересечений.",
      );
    const goalsAgainst = new Map(keepers.map((row) => [row.playerId, 0]));
    let unresolved = false;
    summary.emptyNetGoals[teamId] = 0;
    for (const goal of protocol.goals.filter(
      (row) =>
        row.teamId ===
        (teamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId),
    )) {
      const time = goalSeconds(goal, protocol, rules);
      let candidates = [];
      if (time !== null) {
        const inside = intervals.filter(
          (row) => time > row.from && time < row.to,
        );
        const touching = intervals.filter(
          (row) => time === row.from || time === row.to,
        );
        candidates = [
          ...new Set(
            (inside.length ? inside : touching).map((row) => row.playerId),
          ),
        ];
      }
      let status = "missing",
        goalieId;
      if (goal.situation === "EN") {
        if (
          typeof goal.goalieId === "number" ||
          (candidates.length && !candidates.includes(null))
        )
          status = "conflict";
        else {
          status = "empty_net";
          goalieId = null;
          summary.emptyNetGoals[teamId]++;
        }
      } else if (goal.goalieId === null) status = "conflict";
      else if (typeof goal.goalieId === "number") {
        if (
          !keepers.some(
            (row) => row.playerId === goal.goalieId && row.played,
          ) ||
          (candidates.length && !candidates.includes(goal.goalieId))
        )
          status = "conflict";
        else if (candidates.includes(goal.goalieId)) {
          status = "assigned";
          goalieId = goal.goalieId;
        }
      } else if (candidates.length > 1) status = "ambiguous";
      else if (candidates.length === 1) {
        if (candidates[0] === null) status = "conflict";
        else {
          status = "assigned";
          goalieId = candidates[0];
        }
      }
      if (status === "assigned")
        goalsAgainst.set(goalieId, (goalsAgainst.get(goalieId) || 0) + 1);
      if (status !== "assigned" && status !== "empty_net") {
        unresolved = true;
        const message =
          status === "ambiguous"
            ? `гол ${goal.time} совпал со сменой вратаря. Укажите пропустившего вратаря в записи гола.`
            : status === "conflict"
              ? `гол ${goal.time}: вратарь, ситуация «Пустые ворота» и интервалы не согласованы.`
              : `для гола ${goal.time} не определён вратарь. Проверьте интервалы игры.`;
        issue(message, goal.id);
      }
      summary.assignments.push({ goalId: goal.id, teamId, goalieId, status });
    }
    for (const keeper of keepers) {
      const playedSeconds = intervals
        .filter((row) => row.playerId === keeper.playerId)
        .reduce((sum, row) => sum + row.to - row.from, 0);
      const participationConflict =
        keeper.played && coverage && playedSeconds === 0;
      if (participationConflict)
        issue(
          `вратарь${keeper.number ? " №" + keeper.number : ""} отмечен «Играл», но у него нет времени на льду. Снимите отметку у запасного или заполните интервал.`,
        );
      const complete = coverage && !unresolved && !participationConflict;
      summary.rows.push({
        teamId,
        playerId: keeper.playerId,
        seconds: playedSeconds,
        knownGoalsAgainst: goalsAgainst.get(keeper.playerId) || 0,
        goalsAgainst: complete ? goalsAgainst.get(keeper.playerId) || 0 : null,
        complete,
        participated: playedSeconds > 0 || (!coverage && keeper.played),
      });
    }
  }
  return summary;
}
