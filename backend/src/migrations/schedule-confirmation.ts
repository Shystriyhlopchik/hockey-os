import { MigrationInterface, QueryRunner } from 'typeorm';
export class ScheduleConfirmation1795636800000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE matches ADD COLUMN "scheduleConfirmed" boolean NOT NULL DEFAULT false, ADD COLUMN "scheduleVersion" integer NOT NULL DEFAULT 0, ADD COLUMN "scheduleChangedAt" timestamptz');
    await q.query('ALTER TABLE matches ADD CONSTRAINT matches_confirmed_schedule CHECK (NOT "scheduleConfirmed" OR ("startsAt" IS NOT NULL AND length(trim(venue)) > 0))');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE matches DROP CONSTRAINT matches_confirmed_schedule');
    await q.query('ALTER TABLE matches DROP COLUMN "scheduleConfirmed", DROP COLUMN "scheduleVersion", DROP COLUMN "scheduleChangedAt"');
  }
}
