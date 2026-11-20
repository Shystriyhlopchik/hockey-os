import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sortRoster,
  newestEventEntries,
  chronologicalGoals,
  withoutEvent,
} from './protocol-order.ts';

test('Both goalie numbers precede skaters, with ascending numbers inside each group', () => {
  const roster = [
    { playerId: 1, position: 'F', number: 2 },
    { playerId: 2, position: 'G', number: 30 },
    { playerId: 3, position: 'G', number: 1 },
    { playerId: 4, position: 'D', number: 10 },
    { playerId: 5, position: 'F', number: 5 },
  ];
  const original = structuredClone(roster);
  const sorted = sortRoster(roster);
  assert.deepEqual(
    sorted.map((row) => row.playerId),
    [3, 2, 1, 5, 4],
  );
  assert.deepEqual(roster, original);
  assert.equal(sorted[0], roster[2]);
});

const goals = [
  { id: 'first', period: 2, time: '21:00' },
  { id: 'second', period: 3, time: '42:00' },
  { id: 'entered-later', period: 1, time: '09:00' },
];

test('The newest entry stays first even if the secretary enters an earlier match time', () => {
  const rows = newestEventEntries(goals);
  assert.deepEqual(
    rows.map((row) => [row.event.id, row.index]),
    [
      ['entered-later', 2],
      ['second', 1],
      ['first', 0],
    ],
  );
  assert.equal(rows[0].event, goals[2]);
  assert.deepEqual(
    goals.map((goal) => goal.id),
    ['first', 'second', 'entered-later'],
  );
});

test('Deleting the top visible goal removes its ID rather than the oldest stored event', () => {
  const top = newestEventEntries(goals)[0];
  const remaining = withoutEvent(goals, top.event.id);
  assert.deepEqual(
    remaining.map((goal) => goal.id),
    ['first', 'second'],
  );
  assert.deepEqual(
    newestEventEntries(remaining).map((row) => row.event.id),
    ['second', 'first'],
  );
  assert.equal(goals.length, 3);
});

test('Public and printed events are chronological, independent of the entry order', () => {
  assert.deepEqual(
    chronologicalGoals(goals).map((goal) => goal.id),
    ['entered-later', 'first', 'second'],
  );
  const samePeriod = [
    { id: 'later', period: 1, time: '10:00' },
    { id: 'earlier', period: 1, time: '9:00' },
    { id: 'same-time', period: 1, time: '9:00' },
    { id: 'incomplete', period: 1, time: '' },
  ];
  assert.deepEqual(
    chronologicalGoals(samePeriod).map((goal) => goal.id),
    ['earlier', 'same-time', 'later', 'incomplete'],
  );
  assert.deepEqual(
    samePeriod.map((goal) => goal.id),
    ['later', 'earlier', 'same-time', 'incomplete'],
  );
});

test('Penalty display keeps entry order and original indexes without changing saved events', () => {
  const penalties = [
    { id: 'oldest', period: 2, time: '22:00', minutes: 2 },
    { id: 'middle', period: 3, time: '42:00', minutes: 10 },
    { id: 'newest', period: 1, time: '08:00', minutes: 5 },
  ];
  const original = structuredClone(penalties);
  const visible = newestEventEntries(penalties);
  assert.deepEqual(
    visible.map(({ event, index }) => [event.id, index]),
    [
      ['newest', 2],
      ['middle', 1],
      ['oldest', 0],
    ],
  );
  for (const { event } of visible) {
    const remaining = withoutEvent(penalties, event.id);
    assert.equal(remaining.length, 2);
    assert.ok(remaining.every((penalty) => penalty.id !== event.id));
    assert.deepEqual(
      remaining,
      original.filter((penalty) => penalty.id !== event.id),
    );
  }
  const afterTopRemoval = withoutEvent(penalties, visible[0].event.id);
  assert.deepEqual(
    newestEventEntries(afterTopRemoval).map((row) => row.event.id),
    ['middle', 'oldest'],
  );
  assert.deepEqual(penalties, original);
});
