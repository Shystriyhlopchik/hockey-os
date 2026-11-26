import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSchedule } from './public-schedule';
import { AppService } from './app.service';
import { Match } from './entities';
const match = () => Object.assign(new Match(), { id: 27, round: 2, startsAt: new Date('2027-01-01T09:00:00Z'), venue: 'Арена', slotMinutes: 90, status: 'scheduled', scheduleConfirmed: false, scheduleVersion: 4 });
test('Public schedules hide tentative date and venue without mutating stored fixtures or hiding played dates', () => {
  const original = match();
  const visible = publicSchedule(original);
  assert.equal(visible.startsAt, null); assert.equal(visible.venue, '');
  assert.equal(visible.id, 27); assert.equal(visible.round, 2);
  assert.ok(original.startsAt); assert.equal(original.venue, 'Арена');
  original.scheduleConfirmed = true;
  assert.equal(publicSchedule(original).startsAt, original.startsAt);
  original.scheduleConfirmed = false; original.status = 'completed';
  assert.equal(publicSchedule(original).startsAt, original.startsAt);
});
test('Optimistic snapshots detect confirmation changes, ABA changes and obsolete clients', () => {
  const service = Object.create(AppService.prototype) as AppService;
  const current = match(), expected = service.scheduleSnapshot(current);
  service.assertScheduleUnchanged(current, expected);
  current.scheduleConfirmed = true;
  assert.throws(() => service.assertScheduleUnchanged(current, expected), /изменено/);
  current.scheduleConfirmed = false; current.scheduleVersion++;
  assert.throws(() => service.assertScheduleUnchanged(current, expected), /изменено/);
  const legacy = { ...expected } as any; delete legacy.scheduleVersion;
  assert.throws(() => service.assertScheduleUnchanged(current, legacy), /устарела/);
});
