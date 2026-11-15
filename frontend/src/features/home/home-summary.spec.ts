import test from 'node:test';
import assert from 'node:assert/strict';
import { homeSummary } from './home-summary.ts';

test('Season summary counts published scores, pending games and unique participating people', () => {
  const matches = [
    { status: 'completed', homeScore: 3, awayScore: 2 },
    { status: 'scheduled', homeScore: null, awayScore: null },
    { status: 'cancelled', homeScore: 99, awayScore: 99 },
  ];
  const stats = [
    { playerId: 1, games: 2, assists: 3, penaltyMinutes: 4 },
    { playerId: 1, games: 1, assists: 1, penaltyMinutes: 2 },
    { playerId: 2, games: 0, assists: 0, penaltyMinutes: 0 },
  ];
  assert.deepEqual(homeSummary(matches as any, stats as any, 4), {
    teams: 4,
    played: 1,
    remaining: 1,
    goals: 5,
    players: 1,
    assists: 4,
    penalties: 6,
  });
});
test('Empty tournaments show actual zero values', () => {
  assert.deepEqual(homeSummary([], [], 0), {
    teams: 0,
    played: 0,
    remaining: 0,
    goals: 0,
    players: 0,
    assists: 0,
    penalties: 0,
  });
});

test('Technical games count as completed while their nominal goals are excluded; a played 5:0 counts', () => {
  const matches = [
    { status: 'completed', resolution: 'technical', homeScore: 0, awayScore: 5 },
    { status: 'completed', resolution: 'technical', homeScore: 5, awayScore: 0 },
    { status: 'completed', resolution: 'regulation', homeScore: 5, awayScore: 0 },
    { status: 'scheduled', resolution: null, homeScore: null, awayScore: null },
  ];
  const summary = homeSummary(matches as any, [], 2);
  assert.equal(summary.played, 3);
  assert.equal(summary.remaining, 1);
  assert.equal(summary.goals, 5);
});
