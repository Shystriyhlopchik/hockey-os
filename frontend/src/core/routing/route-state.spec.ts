import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute } from './route-state.ts';

test('Deep links and query strings keep the selected protocol identity', () => {
  assert.deepEqual(parseRoute('/office/protocol/27?print=1'), {
    route: 'office',
    section: 'protocol',
    entityId: 27,
  });
  assert.deepEqual(parseRoute('/matches/12?source=calendar'), {
    route: 'matches',
    section: '',
    entityId: 12,
  });
});
test('Home and office root routes have their own defaults', () => {
  assert.deepEqual(parseRoute('/'), {
    route: 'home',
    section: '',
    entityId: 0,
  });
  assert.deepEqual(parseRoute('/office'), {
    route: 'office',
    section: 'overview',
    entityId: 0,
  });
});
