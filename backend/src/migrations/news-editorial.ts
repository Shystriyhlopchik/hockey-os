import { MigrationInterface, QueryRunner } from "typeorm";

export class NewsEditorial1795176000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query("ALTER TABLE news ALTER COLUMN published SET DEFAULT false");
    await q.query(`ALTER TABLE news
      ADD COLUMN slug varchar(200),
      ADD COLUMN excerpt text NOT NULL DEFAULT '',
      ADD COLUMN "coverUrl" varchar,
      ADD COLUMN "publishedAt" timestamptz,
      ADD COLUMN "slugLocked" boolean NOT NULL DEFAULT false,
      ADD COLUMN "authorUserId" integer REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN "updatedByUserId" integer REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN "deletedAt" timestamptz`);
    await q.query(
      `UPDATE news SET slug='novost-'||id, "publishedAt"=CASE WHEN published THEN "createdAt" ELSE NULL END, "slugLocked"=published`,
    );
    await q.query("CREATE UNIQUE INDEX news_slug_unique ON news (slug)");
    await q.query(
      'CREATE INDEX news_publication_order ON news ("publishedAt" DESC,id DESC) WHERE published=true AND "deletedAt" IS NULL',
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query("ALTER TABLE news ALTER COLUMN published SET DEFAULT true");
    await q.query("DROP INDEX news_publication_order");
    await q.query("DROP INDEX news_slug_unique");
    await q.query(
      'ALTER TABLE news DROP COLUMN slug, DROP COLUMN excerpt, DROP COLUMN "coverUrl", DROP COLUMN "publishedAt", DROP COLUMN "slugLocked", DROP COLUMN "authorUserId", DROP COLUMN "updatedByUserId", DROP COLUMN "deletedAt"',
    );
  }
}
