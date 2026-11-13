import {MigrationInterface,QueryRunner} from 'typeorm';

// Existing duplicates retain their IDs and history. The unique name registry
// reserves every existing name and prevents new collisions, including concurrent writes.
export class PlayerIdentity1794614400000 implements MigrationInterface {
  async up(q:QueryRunner):Promise<void>{
    await q.query('LOCK TABLE players IN SHARE ROW EXCLUSIVE MODE');
    await q.query(`CREATE FUNCTION hockey_player_name_part(value text) RETURNS text
      LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $fn$
      SELECT translate(lower(translate(btrim(regexp_replace(
        translate(normalize(value,NFKC),U&'\\0085\\00A0\\1680\\2000\\2001\\2002\\2003\\2004\\2005\\2006\\2007\\2008\\2009\\200A\\2028\\2029\\202F\\205F\\3000\\FEFF',repeat(' ',21)),
        '[[:space:]]+',' ','g')),
        'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ','абвгдеёжзийклмнопрстуфхцчшщъыьэюя')),'ё','е')
      $fn$`);
    await q.query(`CREATE FUNCTION hockey_player_name_key(last_name text,first_name text,middle_name text) RETURNS jsonb
      LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $fn$
      SELECT jsonb_build_array(public.hockey_player_name_part(coalesce(last_name,'')),public.hockey_player_name_part(coalesce(first_name,'')),public.hockey_player_name_part(coalesce(middle_name,'')))
      $fn$`);
    await q.query(`CREATE INDEX players_name_key_lookup ON players (hockey_player_name_key("lastName","firstName","middleName"))`);
    await q.query(`CREATE TABLE player_name_keys (
      "nameKey" jsonb CONSTRAINT player_name_unique PRIMARY KEY,
      uses integer NOT NULL CHECK (uses>=0))`);
    await q.query(`INSERT INTO public.player_name_keys ("nameKey",uses)
      SELECT hockey_player_name_key("lastName","firstName","middleName"),count(*)::integer FROM players GROUP BY 1`);
    await q.query(`CREATE FUNCTION hockey_guard_player_name() RETURNS trigger LANGUAGE plpgsql AS $fn$
      DECLARE old_key jsonb; new_key jsonb;
      BEGIN
        IF TG_OP <> 'DELETE' THEN
          new_key := public.hockey_player_name_key(NEW."lastName",NEW."firstName",NEW."middleName");
        END IF;
        IF TG_OP <> 'INSERT' THEN
          old_key := public.hockey_player_name_key(OLD."lastName",OLD."firstName",OLD."middleName");
        END IF;
        IF TG_OP = 'UPDATE' AND new_key = old_key THEN RETURN NEW; END IF;
        IF TG_OP <> 'DELETE' THEN
          INSERT INTO public.player_name_keys ("nameKey",uses) VALUES (new_key,1);
        END IF;
        IF TG_OP <> 'INSERT' THEN
          UPDATE public.player_name_keys SET uses=uses-1 WHERE "nameKey"=old_key;
          IF NOT FOUND THEN RAISE EXCEPTION 'Player name registry is inconsistent' USING ERRCODE='23514'; END IF;
          DELETE FROM public.player_name_keys WHERE "nameKey"=old_key AND uses=0;
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END
      $fn$`);
    await q.query(`CREATE TRIGGER player_name_insert BEFORE INSERT ON players FOR EACH ROW EXECUTE FUNCTION hockey_guard_player_name()`);
    await q.query(`CREATE TRIGGER player_name_update BEFORE UPDATE OF "lastName","firstName","middleName" ON players FOR EACH ROW EXECUTE FUNCTION hockey_guard_player_name()`);
    await q.query(`CREATE TRIGGER player_name_delete BEFORE DELETE ON players FOR EACH ROW EXECUTE FUNCTION hockey_guard_player_name()`);
  }
  async down(q:QueryRunner):Promise<void>{
    for(const name of ['player_name_insert','player_name_update','player_name_delete'])await q.query(`DROP TRIGGER ${name} ON players`);
    await q.query('DROP FUNCTION hockey_guard_player_name()');
    await q.query('DROP TABLE player_name_keys');
    await q.query('DROP INDEX players_name_key_lookup');
    await q.query('DROP FUNCTION hockey_player_name_key(text,text,text)');
    await q.query('DROP FUNCTION hockey_player_name_part(text)');
  }
}
