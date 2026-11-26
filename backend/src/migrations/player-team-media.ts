import { MigrationInterface, QueryRunner } from 'typeorm';
export class PlayerTeamMedia1795550400000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE players ADD COLUMN "photoUrl" varchar');
    await q.query('ALTER TABLE teams ADD COLUMN "logoUrl" varchar');
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('ALTER TABLE players DROP COLUMN "photoUrl"');
    await q.query('ALTER TABLE teams DROP COLUMN "logoUrl"');
  }
}
