import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const root = process.cwd(), require = createRequire(resolve(root, 'backend/package.json'));
require('reflect-metadata');
const { Client } = require('pg');
const { ScheduleConfirmation1795636800000 } = require('./dist/migrations/schedule-confirmation.js');
const source = new URL(process.env.SCHEDULE_TEST_DATABASE_URL || '');
assert.ok(['127.0.0.1', 'localhost'].includes(source.hostname));
assert.equal(source.port, '15446', 'Use the isolated schedule PostgreSQL');
source.pathname = '/postgres';
const admin = new Client({ connectionString: source.href }); await admin.connect();
const database = 'hockey_schedule_test_' + Date.now();
await admin.query(`CREATE DATABASE "${database}"`);
const url = new URL(source); url.pathname = '/' + database;
const db = new Client({ connectionString: url.href }); await db.connect();
const temp = await mkdtemp(join(tmpdir(), 'hockey-schedule-test-'));
const port = 4136, base = `http://127.0.0.1:${port}/api/`, sessions = {};
let server, log = '', passed = 0;
const ok = message => { passed++; console.log('✓ ' + message); };
const snapshot = m => ({ round: m.round, startsAt: m.startsAt, venue: m.venue, slotMinutes: m.slotMinutes, scheduleConfirmed: m.scheduleConfirmed, scheduleVersion: m.scheduleVersion });
const edit = (m, fields = {}) => ({ id: m.id, ...snapshot(m), ...fields, expected: snapshot(m) });
async function api(path, method = 'GET', body, who = 'admin', status = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(sessions[who] ? { Cookie: sessions[who] } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const result = await r.json(); assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(result)}`); return result;
}
async function login(who) {
  const r = await fetch(base + 'auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: who, password: 'ScheduleTest2026!' }) });
  assert.equal(r.status, 200); sessions[who] = r.headers.get('set-cookie').split(';')[0];
}
const get = async id => (await api('workspace')).matches.find(m => m.id === id);
const save = (m, fields = {}, who = 'admin', status = 200) => api('workspace/matches/' + m.id, 'PATCH', edit(m, fields), who, status);
try {
  // Apply and roll back the migration over legacy rows before testing the complete application.
  await db.query('CREATE SCHEMA schedule_fixture; SET search_path TO schedule_fixture; CREATE TABLE matches (id int, status text, "startsAt" timestamptz, venue text)');
  await db.query(`INSERT INTO matches VALUES (1,'scheduled','2027-01-01T09:00:00Z','Арена'),(2,'completed','2026-01-01T09:00:00Z','Арена')`);
  const migration = new ScheduleConfirmation1795636800000();
  const queryRunner = { query: (...args) => db.query(...args) };
  await migration.up(queryRunner);
  const old = (await db.query('SELECT * FROM matches ORDER BY id')).rows;
  assert.ok(old.every(m => m.scheduleConfirmed === false && m.scheduleVersion === 0 && m.scheduleChangedAt === null));
  assert.equal(old[0].startsAt.toISOString(), '2027-01-01T09:00:00.000Z'); assert.equal(old[1].status, 'completed');
  await assert.rejects(db.query('UPDATE matches SET "scheduleConfirmed"=true,"startsAt"=null WHERE id=1'), /matches_confirmed_schedule/);
  await migration.down(queryRunner);
  assert.equal((await db.query('SELECT * FROM matches')).rows[0].scheduleConfirmed, undefined);
  await db.query('SET search_path TO public; DROP SCHEMA schedule_fixture CASCADE');
  ok('Миграция сохраняет старые даты и результаты, сбрасывает подтверждение и поддерживает откат');

  server = spawn(process.execPath, [resolve(root, 'backend/dist/main.js')], { cwd: temp, env: { ...process.env, DATABASE_URL: url.href, NODE_ENV: 'test', DEMO_SEED: 'true', DEMO_PASSWORD: 'ScheduleTest2026!', JWT_SECRET: 'schedule-test-only-key-at-least-32-characters', FRONTEND_ORIGIN: `http://127.0.0.1:${port}`, HOST: '127.0.0.1', PORT: String(port), UPLOAD_DIR: join(temp, 'uploads') }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  server.stdout.on('data', b => log += b); server.stderr.on('data', b => log += b);
  let ready = false;
  for (let i = 0; i < 120; i++) { try { if ((await fetch(base + 'health')).ok) { ready = true; break; } } catch {} if (server.exitCode !== null) throw Error(log); await new Promise(r => setTimeout(r, 150)); }
  assert.ok(ready, log);
  for (const who of ['admin', 'secretary', 'organizer', 'community']) await login(who);
  const initial = await api('workspace'), t = initial.tournaments[0];
  const fixtures = initial.matches.filter(m => m.tournamentId === t.id && m.status === 'scheduled');
  let [a, b, c] = fixtures;
  const path = 'workspace/tournaments/' + t.id + '/schedule';
  const original = { id: a.id, round: a.round, homeTeamId: a.homeTeamId, awayTeamId: a.awayTeamId, protocolVersion: a.protocolVersion };
  let pub = await api('public');
  assert.ok(pub.matches.filter(m => m.status === 'scheduled').every(m => m.startsAt === null && m.venue === ''));
  assert.ok(pub.matches.filter(m => m.status === 'completed').every(m => m.startsAt && m.venue));
  assert.ok(initial.matches.filter(m => m.status === 'scheduled').every(m => m.startsAt));
  let detail = await api('matches/' + a.id); assert.equal(detail.match.startsAt, null); assert.equal(detail.match.venue, '');
  ok('Предварительные даты скрыты в публичном календаре и карточке матча, но доступны в кабинете; сыгранные даты сохранены');

  a = await save(a, { startsAt: '2035-01-05T09:00:00Z', venue: 'Арена согласования', scheduleConfirmed: true }, 'secretary');
  assert.equal(a.scheduleConfirmed, true); assert.equal(a.scheduleVersion, 1);
  pub = await api('public'); let published = pub.matches.find(m => m.id === a.id);
  assert.equal(published.startsAt, '2035-01-05T09:00:00.000Z'); assert.equal(published.venue, 'Арена согласования');
  assert.equal((await api('matches/' + a.id)).match.startsAt, published.startsAt);
  for (const key of Object.keys(original)) assert.equal(a[key], original[key]);
  ok('Назначенный секретарь подтверждает отдельную игру; дата появляется публично без изменения пары, тура и протокола');

  await save(a, { round: a.round + 1 }, 'secretary', 403);
  await api(path, 'PATCH', { matches: [edit(a)] }, 'secretary', 403);
  await api('workspace/users', 'POST', { username: 'schedule_other', displayName: 'Другой секретарь', password: 'ScheduleTest2026!', role: 'secretary', active: true, tournamentIds: [initial.tournaments[1].id] }, 'admin', 201);
  await login('schedule_other'); await save(a, {}, 'schedule_other', 403); await save(a, {}, 'anonymous', 401);
  ok('Секретарь не меняет туры и общий календарь; доступ к чужому турниру и анонимное редактирование закрыты');

  a = await save(a, { scheduleConfirmed: false }, 'secretary');
  assert.equal(a.startsAt, published.startsAt); assert.ok(a.scheduleChangedAt);
  assert.equal((await api('matches/' + a.id)).match.startsAt, null);
  a = await save(a, { scheduleConfirmed: true });
  const confirmedTime = a.startsAt;
  const implicitEdit = edit(a, { startsAt: '2035-01-06T09:00:00Z' }); delete implicitEdit.scheduleConfirmed;
  a = await api('workspace/matches/' + a.id, 'PATCH', implicitEdit, 'secretary');
  assert.equal(a.scheduleConfirmed, false); assert.notEqual(a.startsAt, confirmedTime);
  assert.equal((await api('matches/' + a.id)).match.startsAt, null);
  a = await save(a, { scheduleConfirmed: true });
  assert.ok((await api('matches/' + a.id)).match.scheduleChangedAt);
  ok('Снятие подтверждения скрывает дату, перенос без повторного согласования снимает подтверждение; история изменения сохраняется');

  for (const fields of [{ startsAt: null, scheduleConfirmed: true }, { venue: '', scheduleConfirmed: true }, { scheduleConfirmed: 'true' }]) await save(a, fields, 'admin', 400);
  b = await save(b, { startsAt: a.startsAt, venue: a.venue, scheduleConfirmed: false });
  await save(b, { scheduleConfirmed: true }, 'admin', 409);
  const sharedTeam = fixtures.find(m => m.id !== a.id && m.id !== b.id && [m.homeTeamId, m.awayTeamId].some(id => [a.homeTeamId, a.awayTeamId].includes(id)));
  await save(sharedTeam, { startsAt: a.startsAt, venue: 'Другая площадка', scheduleConfirmed: true }, 'admin', 409);
  const foreignGame = initial.matches.find(m => m.tournamentId !== t.id && m.status === 'scheduled');
  await save(foreignGame, { startsAt: a.startsAt, venue: a.venue, scheduleConfirmed: true }, 'admin', 409);
  assert.equal((await get(b.id)).scheduleConfirmed, false);
  ok('Подтверждение требует дату и площадку; пересечения арены и команды проверяются между всеми турнирами, предварительные игры не резервируют слот');

  b = await save(b, { startsAt: '2035-01-07T09:00:00Z', venue: 'Вторая арена' });
  c = await save(c, { startsAt: '2035-01-08T09:00:00Z', venue: 'Третья арена' });
  await api(path, 'PATCH', { matches: [edit(b, { scheduleConfirmed: true }), edit(c, { startsAt: null, scheduleConfirmed: true })] }, 'organizer', 400);
  assert.equal((await get(b.id)).scheduleConfirmed, false);
  await api(path, 'PATCH', { matches: [edit(b, { scheduleConfirmed: true }), edit(c, { startsAt: b.startsAt, venue: b.venue, scheduleConfirmed: true })] }, 'organizer', 409);
  assert.equal((await get(b.id)).scheduleConfirmed, false);
  await api(path, 'PATCH', { matches: [edit(b, { scheduleConfirmed: true }), edit(c, { scheduleConfirmed: true })] }, 'organizer');
  b = await get(b.id); c = await get(c.id); assert.ok(b.scheduleConfirmed && c.scheduleConfirmed);
  ok('Групповое подтверждение атомарно: неверная дата или конфликт откатывают весь пакет');

  const stale = edit(a, { venue: 'Устаревший ввод' });
  const beforeABA = a;
  a = await save(a, { scheduleConfirmed: false }); a = await save(a, { scheduleConfirmed: true });
  assert.equal(a.startsAt, beforeABA.startsAt); assert.equal(a.scheduleConfirmed, beforeABA.scheduleConfirmed);
  await api('workspace/matches/' + a.id, 'PATCH', stale, 'admin', 409);
  const legacy = edit(a); delete legacy.expected.scheduleVersion;
  await api('workspace/matches/' + a.id, 'PATCH', legacy, 'admin', 409);
  const concurrent = edit(a, { venue: 'Арена параллельной правки' });
  const results = await Promise.all([1, 2].map(() => fetch(base + 'workspace/matches/' + a.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: sessions.admin }, body: JSON.stringify(concurrent) })));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  a = await get(a.id);
  ok('Версия расписания защищает от устаревших форм, снятия и возврата подтверждения и одновременных сохранений');

  const finished = initial.matches.find(m => m.status === 'completed' && m.tournamentId === t.id);
  await save(finished, { venue: 'Нельзя' }, 'admin', 409);
  await api(path, 'PATCH', { matches: [edit(b), edit(foreignGame)] }, 'admin', 400);
  const oldStats = initial.stats;
  assert.deepEqual((await api('workspace')).stats, oldStats);
  const audit = await api('workspace/audit');
  assert.ok(audit.some(row => row.entityId === a.id && row.details.before?.scheduleConfirmed === false && row.details.after?.scheduleConfirmed === true));
  assert.ok(audit.some(row => row.entityId === a.id && row.details.before?.scheduleVersion < row.details.after?.scheduleVersion));
  ok('Завершённые игры защищены, статистика не меняется, журнал сохраняет подтверждения и версии');

  const profile = initial.tournaments[0].rules;
  const newTournament = await api('workspace/tournaments', 'POST', { name: 'Турнир без согласованных дат', slug: 'schedule-launch-test', seasonId: initial.seasons[0].id, division: '18+', description: '', teamIds: t.teamIds.slice(0, 2), rules: { ...profile, rounds: 1 } }, 'admin', 201);
  await api(`workspace/tournaments/${newTournament.id}/schedule`, 'POST', { startsAt: a.startsAt, venue: a.venue, slotMinutes: 90 }, 'admin', 201);
  let generated = (await api('workspace')).matches.filter(m => m.tournamentId === newTournament.id);
  assert.ok(generated.every(m => m.scheduleConfirmed === false));
  for (const game of generated) await save(game, { startsAt: null, venue: '' });
  await api(`workspace/tournaments/${newTournament.id}/launch`, 'POST', {}, 'admin', 201);
  generated = (await api('public')).matches.filter(m => m.tournamentId === newTournament.id);
  assert.ok(generated.length && generated.every(m => m.startsAt === null));
  ok('Автоматический календарь предварительный; турнир запускается с утверждёнными парами без точных дат');

  const beforeMove = b;
  await api(path, 'PATCH', { matches: [edit(b, { round: b.round + 10 })] }, 'organizer');
  b = await get(b.id); assert.equal(b.scheduleConfirmed, true); assert.equal(b.startsAt, beforeMove.startsAt); assert.equal(b.homeTeamId, beforeMove.homeTeamId);
  await api(path, 'PATCH', { matches: [edit(b, { scheduleConfirmed: false }), edit(c, { scheduleConfirmed: false })] }, 'organizer');
  assert.equal((await api('matches/' + b.id)).match.startsAt, null); assert.equal((await api('matches/' + c.id)).match.startsAt, null);
  ok('Перенос между турами сохраняет согласованное время; групповое снятие подтверждения скрывает даты');

  console.log(`Готово: ${passed} сквозных проверок подтверждения расписания.`);
  if (process.env.SCHEDULE_TEST_PREVIEW === '1') {
    b = await get(b.id); await save(b, { scheduleConfirmed: true });
    console.log(`PREVIEW_READY http://127.0.0.1:${port} (admin / ScheduleTest2026!). Send newline to stop.`);
    await once(process.stdin, 'data');
  }
} finally {
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
  await db.end(); await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`); await admin.end();
  await rm(temp, { recursive: true, force: true });
}
