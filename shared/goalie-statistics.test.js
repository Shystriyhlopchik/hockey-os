import test from "node:test";
import assert from "node:assert/strict";
import {
  goalieSummary,
  goalieMatchDuration,
  formatGoalieTime,
} from "./goalie-statistics.js";
const rules = { periods: 3, periodMinutes: 15, overtimeMinutes: 5 },
  match = { homeTeamId: 1, awayTeamId: 2 };
const keeper = (id, played = true) => ({ playerId: id, position: "G", played });
function protocol() {
  return {
    timeBasis: "match",
    detailLevel: "full",
    resolution: "regulation",
    homeRoster: [keeper(1), keeper(3, false)],
    awayRoster: [keeper(11)],
    goals: [],
    goalieShifts: [
      { teamId: 1, playerId: 1, from: "00:00", to: "45:00" },
      { teamId: 2, playerId: 11, from: "00:00", to: "45:00" },
    ],
  };
}
function goal(p, time = "21:00", overrides = {}) {
  p.goals.push({
    id: "goal-" + p.goals.length,
    teamId: 2,
    period: 2,
    time,
    situation: "EV",
    ...overrides,
  });
}
const row = (s, id = 1) => s.rows.find((r) => r.playerId === id);
test("Goals go to the defending goalie, with a real zero for a complete clean match", () => {
  const p = protocol();
  goal(p);
  const s = goalieSummary(p, match, rules);
  assert.equal(row(s).goalsAgainst, 1);
  assert.equal(row(s, 11).goalsAgainst, 0);
  assert.equal(row(s).seconds, 2700);
  assert.equal(row(s, 3).participated, false);
  assert.deepEqual(s.issues, []);
});
test("A replacement and an empty-net goal produce 2 / 1 / no personal goal", () => {
  const p = protocol();
  p.homeRoster[1].played = true;
  p.goalieShifts = [
    { teamId: 1, playerId: 1, from: "00:00", to: "25:00" },
    { teamId: 1, playerId: 3, from: "25:00", to: "43:00" },
    { teamId: 1, playerId: null, from: "43:00", to: "45:00" },
    p.goalieShifts[1],
  ];
  goal(p, "05:00", { period: 1 });
  goal(p, "21:00");
  goal(p, "42:00", { period: 3 });
  goal(p, "44:00", { period: 3, situation: "EN" });
  const s = goalieSummary(p, match, rules);
  assert.deepEqual(
    [row(s).goalsAgainst, row(s, 3).goalsAgainst, s.emptyNetGoals[1]],
    [2, 1, 1],
  );
  assert.deepEqual([row(s).seconds, row(s, 3).seconds], [1500, 1080]);
  assert.deepEqual(s.issues, []);
});
test("A goal at a replacement boundary requires an explicit keeper, including an outgoing keeper", () => {
  const p = protocol();
  p.homeRoster[1].played = true;
  p.goalieShifts.splice(
    0,
    1,
    { teamId: 1, playerId: 1, from: "00:00", to: "25:00" },
    { teamId: 1, playerId: 3, from: "25:00", to: "45:00" },
  );
  goal(p, "25:00");
  assert.equal(
    goalieSummary(p, match, rules).assignments[0].status,
    "ambiguous",
  );
  for (const id of [1, 3]) {
    p.goals[0].goalieId = id;
    const s = goalieSummary(p, match, rules);
    assert.equal(row(s, id).goalsAgainst, 1);
    assert.deepEqual(s.issues, []);
  }
});
test("Goals at zero and the final siren belong to the only active keeper", () => {
  const p = protocol();
  goal(p, "00:00", { period: 1 });
  goal(p, "45:00", { period: 3 });
  assert.equal(row(goalieSummary(p, match, rules)).goalsAgainst, 2);
});
test("Missing intervals, gaps and overlaps never turn unknown personal totals into zeros", () => {
  for (const shifts of [
    [],
    [{ teamId: 1, playerId: 1, from: "00:00", to: "20:00" }],
    [
      { teamId: 1, playerId: 1, from: "00:00", to: "30:00" },
      { teamId: 1, playerId: 1, from: "25:00", to: "45:00" },
    ],
  ]) {
    const p = protocol();
    p.goalieShifts = shifts;
    goal(p);
    const s = goalieSummary(p, match, rules);
    assert.equal(row(s).goalsAgainst, null);
    assert.ok(s.issues.length);
  }
});
test("Unknown legacy totals remain unknown even for a scoreless game", () => {
  const p = protocol();
  p.goalieShifts = [];
  assert.equal(row(goalieSummary(p, match, rules)).goalsAgainst, null);
});
test("An empty-net marker must agree with intervals and cannot name a keeper", () => {
  const p = protocol();
  goal(p, "21:00", { situation: "EN" });
  assert.equal(
    goalieSummary(p, match, rules).assignments[0].status,
    "conflict",
  );
  p.goalieShifts[0].playerId = null;
  p.homeRoster[0].played = false;
  assert.equal(
    goalieSummary(p, match, rules).assignments[0].status,
    "empty_net",
  );
  p.goals[0].goalieId = 1;
  assert.equal(
    goalieSummary(p, match, rules).assignments[0].status,
    "conflict",
  );
});
test("A normal goal during an empty-net interval and a goalie from the wrong team are rejected", () => {
  const p = protocol();
  goal(p);
  p.goalieShifts[0].playerId = null;
  assert.equal(
    goalieSummary(p, match, rules).assignments[0].status,
    "conflict",
  );
  p.goalieShifts[0].playerId = 1;
  p.goals[0].goalieId = 11;
  assert.equal(
    goalieSummary(p, match, rules).assignments[0].status,
    "conflict",
  );
});
test("A regulation penalty shot counts as a goal against; the shootout extra goal does not", () => {
  const p = protocol();
  goal(p, "21:00", { situation: "PS" });
  assert.equal(row(goalieSummary(p, match, rules)).goalsAgainst, 1);
  p.goals = [];
  p.resolution = "shootout";
  p.shootout = [{ teamId: 2, goalieId: 1, scored: true }];
  p.goalieShifts.forEach((s) => (s.to = "50:00"));
  assert.equal(row(goalieSummary(p, match, rules)).goalsAgainst, 0);
  assert.equal(goalieMatchDuration(p, rules), 3000);
});
test("Overtime duration stops at the winning goal and uses cumulative or legacy period time", () => {
  for (const basis of ["match", "period"]) {
    const p = protocol();
    p.timeBasis = basis;
    p.resolution = "overtime";
    goal(p, basis === "match" ? "46:30" : "01:30", { period: 4 });
    p.goalieShifts.forEach((s) => (s.to = "46:30"));
    const s = goalieSummary(p, match, rules);
    assert.equal(s.durationSeconds, 2790);
    assert.equal(row(s).seconds, 2790);
    assert.equal(row(s).goalsAgainst, 1);
  }
});
test("Legacy period time is converted once, without mutating a stored protocol", () => {
  const p = protocol();
  delete p.timeBasis;
  goal(p, "06:00");
  goal(p, "12:00", { period: 3 });
  const before = structuredClone(p);
  assert.equal(row(goalieSummary(p, match, rules)).goalsAgainst, 2);
  assert.deepEqual(p, before);
});
test("Technical results and score-only protocols have no individual goalie accounting", () => {
  for (const changed of [
    { resolution: "technical" },
    { detailLevel: "score_only" },
  ]) {
    const p = { ...protocol(), ...changed };
    goal(p);
    assert.deepEqual(goalieSummary(p, match, rules).rows, []);
  }
});
test("A backup marked as having played must get an interval or be unmarked", () => {
  const p = protocol();
  p.homeRoster[1].played = true;
  assert.match(
    goalieSummary(p, match, rules)
      .issues.map((i) => i.message)
      .join(" "),
    /запасного/,
  );
});
test("Incomplete editing values are reported rather than crashing the preview", () => {
  const p = protocol();
  goal(p, "21:6");
  p.goalieShifts[0].from = "";
  assert.equal(row(goalieSummary(p, match, rules)).goalsAgainst, null);
  p.resolution = "overtime";
  assert.equal(goalieMatchDuration(p, rules), null);
});
test("Clock formatting preserves total hours as hockey minutes and never formats missing values as zero", () => {
  assert.equal(formatGoalieTime(3601), "60:01");
  assert.equal(formatGoalieTime(0), "00:00");
  for (const value of [null, undefined, NaN, -1])
    assert.equal(formatGoalieTime(value), "—");
});
