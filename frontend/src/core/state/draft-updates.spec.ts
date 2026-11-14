import test from 'node:test';
import assert from 'node:assert/strict';
import { updatePath, replaceItem, replaceList } from './draft-updates.ts';

test('Editing a nested field changes its signal reference without modifying the loaded snapshot', () => {
  const original = {
    rules: { periodMinutes: 15, pointsWin: 2 },
    teams: [1, 2],
  };
  const next = updatePath(original, ['rules', 'periodMinutes'], 20);
  assert.equal(original.rules.periodMinutes, 15);
  assert.equal(next.rules.periodMinutes, 20);
  assert.notEqual(next, original);
  assert.notEqual(next.rules, original.rules);
  assert.equal(next.teams, original.teams);
});
test('One protocol row patch updates its related fields together and preserves other rows', () => {
  const goal = { id: 'goal-a', teamId: 1, scorerId: 10, assist1Id: 11 };
  const other = { id: 'goal-b', teamId: 2, scorerId: 20, assist1Id: null };
  const protocol = { goals: [goal, other], notes: '' };
  const next = replaceItem(protocol, goal, {
    teamId: 2,
    scorerId: null,
    assist1Id: null,
  });
  assert.deepEqual(next.goals[0], {
    id: 'goal-a',
    teamId: 2,
    scorerId: null,
    assist1Id: null,
  });
  assert.equal(next.goals[1], other);
  assert.equal(protocol.goals[0].scorerId, 10);
});
test('Removing an event replaces only the correct list, including nested official-sheet events', () => {
  const timeouts = [{ teamId: 1 }, { teamId: 2 }];
  const goals = [{ id: 'goal' }];
  const protocol = { goals, sheet: { timeouts } };
  const next = replaceList(protocol, timeouts, timeouts.slice(1));
  assert.equal(next.goals, goals);
  assert.equal(next.sheet.timeouts.length, 1);
  assert.equal(protocol.sheet.timeouts.length, 2);
});
