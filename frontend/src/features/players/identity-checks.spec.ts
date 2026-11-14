import test from 'node:test';
import assert from 'node:assert/strict';
import { TestScheduler } from 'rxjs/testing';
import { identityChecks, type IdentityInput } from './identity-checks.ts';

const input = (key: string): IdentityInput => ({ key, revision: 1, query: { firstName: key } });
const result = { matches: [{ id: 7, name: 'Существующий игрок' }], unchanged: false };

test('Fast typing makes only one name lookup after the debounce', () => {
  const scheduler = new TestScheduler(() => {});
  scheduler.run(({ cold, flush }) => {
    const queries: string[] = [],
      values: string[] = [];
    identityChecks(
      cold('a 9ms b 400ms |', { a: input('old'), b: input('latest') }),
      (query) => {
        queries.push(query.firstName as string);
        return cold('5ms x|', { x: result });
      },
      scheduler,
    ).subscribe((value) => values.push(value.key));
    flush();
    assert.deepEqual(queries, ['latest']);
    assert.deepEqual(values, ['latest']);
  });
});

test('A new spelling cancels an already running lookup and ignores its late response', () => {
  const scheduler = new TestScheduler(() => {});
  scheduler.run(({ cold, flush }) => {
    const queries: string[] = [],
      values: string[] = [];
    identityChecks(
      cold('a 349ms b 500ms |', { a: input('old'), b: input('latest') }),
      (query) => {
        queries.push(query.firstName as string);
        return cold('100ms x|', { x: result });
      },
      scheduler,
    ).subscribe((value) => values.push(value.key));
    flush();
    assert.deepEqual(queries, ['old', 'latest']);
    assert.deepEqual(values, ['latest']);
  });
});

test('Closing the form cancels both scheduled and in-flight identity checks', () => {
  const scheduler = new TestScheduler(() => {});
  scheduler.run(({ cold, flush }) => {
    const values: unknown[] = [];
    identityChecks(
      cold('a 319ms n 100ms |', { a: input('old'), n: null }),
      () => cold('100ms x|', { x: result }),
      scheduler,
    ).subscribe((value) => values.push(value));
    flush();
    assert.deepEqual(values, []);
  });
});

test('An HTTP error is displayed without terminating future checks', () => {
  const scheduler = new TestScheduler(() => {});
  scheduler.run(({ cold, flush }) => {
    const values: { key: string; failure: string }[] = [];
    identityChecks(
      cold('a 319ms b 400ms |', { a: input('error'), b: input('latest') }),
      (query) =>
        query.firstName === 'error'
          ? cold('5ms #', {}, new Error('Нет соединения'))
          : cold('5ms x|', { x: result }),
      scheduler,
    ).subscribe((value) => values.push({ key: value.key, failure: value.failure }));
    flush();
    assert.deepEqual(values, [
      { key: 'error', failure: 'Нет соединения' },
      { key: 'latest', failure: '' },
    ]);
  });
});
