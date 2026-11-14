import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createScheduleRows,
  scheduleGroups,
  nearestScheduleGroup,
  scheduleRowsInGroup,
  changedScheduleRows,
  scheduleChanges,
  applyScheduleBulk,
} from './schedule-editor.ts';

const game = (id, round, startsAt, status = 'scheduled', stage = 'regular') => ({
  id,
  tournamentId: 1,
  round,
  stage,
  startsAt,
  status,
  venue: 'Арена',
  slotMinutes: 90,
});

test('The editor uses Moscow time and keeps the original schedule for concurrency checks', () => {
  const source = [game(27, 3, '2026-11-14T09:00:00.000Z'), game(28, 3, null)];
  const rows = createScheduleRows(source);
  assert.equal(rows[0].startsAt, '2026-11-14T12:00');
  assert.equal(rows[1].startsAt, '');
  assert.deepEqual(scheduleChanges(rows), []);
  rows[0].startsAt = '2026-11-14T15:00';
  assert.deepEqual(scheduleChanges(rows), [
    {
      id: 27,
      round: 3,
      startsAt: '2026-11-14T12:00:00.000Z',
      venue: 'Арена',
      slotMinutes: 90,
      expected: {
        round: 3,
        startsAt: '2026-11-14T09:00:00.000Z',
        venue: 'Арена',
        slotMinutes: 90,
      },
    },
  ]);
  assert.equal(source[0].startsAt, '2026-11-14T09:00:00.000Z');
});

test('Bulk changes affect only unplayed matches in the selected round and preserve their times', () => {
  const rows = createScheduleRows([
    game(1, 3, '2026-11-14T09:00:00Z'),
    game(2, 3, '2026-11-14T11:00:00Z', 'completed'),
    game(3, 4, '2026-11-21T09:00:00Z'),
  ]);
  applyScheduleBulk(rows, 'regular:3', '2026-11-15', 'Другая арена');
  assert.equal(rows[0].startsAt, '2026-11-15T12:00');
  assert.equal(rows[0].venue, 'Другая арена');
  assert.equal(rows[1].startsAt, '2026-11-14T14:00');
  assert.equal(rows[2].startsAt, '2026-11-21T12:00');
  assert.deepEqual(
    changedScheduleRows(rows).map((row) => row.id),
    [1],
  );
  rows[2].slotMinutes = 120;
  assert.deepEqual(
    scheduleChanges(rows).map((row) => row.id),
    [1, 3],
  );
});

test('The nearest pending round is selected; stages are separate and completed rounds are not editable', () => {
  const rows = createScheduleRows([
    game(1, 1, '2026-10-31T09:00:00Z', 'completed'),
    game(2, 2, '2026-11-07T09:00:00Z'),
    game(3, 3, '2026-11-14T09:00:00Z'),
    game(4, 3, null),
    game(5, 1, '2026-12-01T09:00:00Z', 'scheduled', 'semi'),
  ]);
  assert.equal(nearestScheduleGroup(rows, Date.parse('2026-11-12T09:00:00Z')), 'regular:3');
  assert.deepEqual(
    scheduleGroups(rows).map((g) => g.key),
    ['regular:2', 'regular:3', 'semi:1'],
  );
  assert.equal(scheduleGroups(rows)[1].pending, 2);
});

test('Completed rows cannot enter the payload; clearing a date is explicit and malformed edits are rejected', () => {
  const rows = createScheduleRows([
    game(1, 3, '2026-11-14T09:00:00Z', 'completed'),
    game(2, 3, '2026-11-14T11:00:00Z'),
  ]);
  rows[0].venue = 'Изменение запрещено';
  rows[1].startsAt = '';
  assert.deepEqual(
    scheduleChanges(rows).map((row) => [row.id, row.startsAt]),
    [[2, null]],
  );
  rows[1].slotMinutes = 0;
  assert.throws(() => scheduleChanges(rows), /60 до 300/);
  rows[1].slotMinutes = 90;
  rows[1].venue = '';
  assert.throws(() => scheduleChanges(rows), /площадку/);
});

test('Moving every match out of a round preserves the source view and detects round-only edits', () => {
  const source = [
    game(1, 3, '2026-11-14T09:00:00Z'),
    game(2, 3, '2026-11-14T11:00:00Z'),
    game(3, 4, '2026-11-21T09:00:00Z'),
  ];
  const rows = createScheduleRows(source);
  rows[0].round = 4;
  rows[1].round = 15;
  assert.deepEqual(
    changedScheduleRows(rows).map((row) => row.id),
    [1, 2],
  );
  assert.deepEqual(
    scheduleRowsInGroup(rows, 'regular:3').map((row) => row.id),
    [1, 2],
  );
  assert.deepEqual(
    scheduleRowsInGroup(rows, 'regular:4').map((row) => row.id),
    [3],
  );
  assert.equal(scheduleRowsInGroup(rows, 'all').length, 3);
  assert.deepEqual(
    scheduleGroups(rows).map((group) => [group.key, group.pending]),
    [
      ['regular:3', 2],
      ['regular:4', 1],
    ],
  );
  const changes = scheduleChanges(rows);
  assert.deepEqual(
    changes.map((row) => [row.id, row.round, row.expected.round]),
    [
      [1, 4, 3],
      [2, 15, 3],
    ],
  );
  assert.equal(source[0].round, 3);
  // A reopened saved calendar uses the new groups, including a previously nonexistent round.
  const saved = createScheduleRows(
    rows.map((row) => ({ ...row, startsAt: row.expected.startsAt })),
  );
  assert.deepEqual(
    scheduleRowsInGroup(saved, 'regular:15').map((row) => row.id),
    [2],
  );
  rows[0].round = 3;
  rows[1].round = 3;
  assert.equal(changedScheduleRows(rows).length, 0);
});

test('Bulk edits keep affecting the selected source group after moving its matches', () => {
  const rows = createScheduleRows([
    game(1, 3, '2026-11-14T09:00:00Z'),
    game(2, 4, '2026-11-21T09:00:00Z'),
  ]);
  rows[0].round = 4;
  applyScheduleBulk(rows, 'regular:3', '2026-11-15', 'Площадка бумажного календаря');
  assert.equal(rows[0].startsAt, '2026-11-15T12:00');
  assert.equal(rows[0].round, 4);
  assert.equal(rows[1].venue, 'Арена');
  assert.throws(
    () => applyScheduleBulk(rows, 'all', '2026-11-15', 'Общая арена'),
    /выберите один тур/,
  );
});

test('Round transfers reject invalid numbers and playoff series changes while keeping completed games locked', () => {
  const rows = createScheduleRows([
    game(1, 3, null),
    game(2, 1, null, 'scheduled', 'semi'),
    game(3, 3, null, 'completed'),
  ]);
  for (const round of [0, -1, 1.5, 1001, NaN]) {
    rows[0].round = round;
    assert.throws(() => scheduleChanges(rows), /Номер тура/);
  }
  rows[0].round = 3;
  rows[1].round = 2;
  assert.throws(() => scheduleChanges(rows), /плей-офф/);
  rows[1].round = 1;
  rows[2].round = 5;
  assert.deepEqual(scheduleChanges(rows), []);
});

test('Round choices remain in numerical order when dates no longer follow round numbers', () => {
  const rows = createScheduleRows([
    game(1, 4, '2026-11-14T09:00:00Z'),
    game(2, 15, '2026-11-14T11:00:00Z'),
    game(3, 3, '2026-11-21T09:00:00Z'),
    game(4, 1, null, 'scheduled', 'final'),
    game(5, 2, null, 'scheduled', 'semi'),
  ]);
  assert.deepEqual(
    scheduleGroups(rows).map((group) => group.key),
    ['regular:3', 'regular:4', 'regular:15', 'semi:2', 'final:1'],
  );
});
