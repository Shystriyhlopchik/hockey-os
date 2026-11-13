import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {existsSync} from 'node:fs';
if(existsSync('.env'))process.loadEnvFile('.env');
const require=createRequire(resolve('backend/package.json'));
const {Client}=require('pg');const {emptyProtocol}=require('./dist/domain.js');
const name='hockey_delete_'+Date.now();assert.match(name,/^hockey_delete_\d+$/);
const adminUrl=new URL(process.env.DATABASE_URL);adminUrl.pathname='/postgres';
const admin=new Client({connectionString:adminUrl.href});await admin.connect();await admin.query(`CREATE DATABASE "${name}"`);
const testUrl=new URL(process.env.DATABASE_URL);testUrl.pathname='/'+name;
const db=new Client({connectionString:testUrl.href});await db.connect();
const port=4102,base=`http://127.0.0.1:${port}/api/`;let log='',passed=0,sequence=0;
const sessions={},clients=[];
const server=spawn(process.execPath,[resolve('backend/dist/main.js')],{cwd:process.cwd(),env:{...process.env,HOST:'127.0.0.1',PORT:String(port),DATABASE_URL:testUrl.href,DEMO_SEED:'true',NODE_ENV:'test'},stdio:['ignore','pipe','pipe'],windowsHide:true});
server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
async function api(path,method='GET',body,who='admin',expected=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(sessions[who]?{Cookie:sessions[who]}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);return data;}
async function login(username){const r=await fetch(base+'auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:process.env.DEMO_PASSWORD})});assert.equal(r.status,200);sessions[username]=r.headers.get('set-cookie').split(';')[0];}
const ok=message=>{passed++;console.log('✓ '+message);};
const info=id=>api(`workspace/players/${id}/deletion`);
const remove=(id,version,expected=200)=>api(`workspace/players/${id}`,'DELETE',{expectedVersion:version},'admin',expected);
async function create(){return api('workspace/players','POST',{lastName:'Удаляемый'+(++sequence),firstName:'Тестовый',middleName:'Проверочный',birthDate:'1970-01-01',position:'F',qualification:'amateur',insured:true,medicallyCleared:true},'admin',201);}
async function register(p,t,team,number=90){return api('workspace/registrations','POST',{tournamentId:t,teamId:team,playerId:p.id,number,captain:''},'admin',201);}
async function draft(matchId,protocol,expected=201,publish=false){const d=await api(`workspace/matches/${matchId}`);return api(`workspace/matches/${matchId}/${publish?'publish':'draft'}`,'POST',{protocol,expectedDraftVersion:d.draftVersion,expectedProtocolVersion:d.match.protocolVersion,reason:'Проверка удаления'},'admin',expected);}
async function connection(){const c=new Client({connectionString:testUrl.href});await c.connect();clients.push(c);return c;}
async function waitLock(fragment,count=1){for(let i=0;i<100;i++){const r=await db.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1 AND wait_event_type='Lock' AND query ILIKE $2`,[name,'%'+fragment+'%']);if(r.rows[0].n>=count)return;await new Promise(r=>setTimeout(r,20));}throw Error('Expected concurrent lock: '+fragment);}
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,log);
  for(const u of ['admin','secretary','organizer','community'])await login(u);
  const initial=await api('workspace');const t1=initial.tournaments[0],t2=initial.tournaments[1];
  const unused=await create();
  for(const role of ['secretary','organizer','community']){
    await api(`workspace/players/${unused.id}/deletion`,'GET',undefined,role,403);
    await api(`workspace/players/${unused.id}`,'DELETE',{},role,403);
  }
  await api(`workspace/players/${unused.id}`,'DELETE',{},'anonymous',401);
  await api(`workspace/players/${unused.id}/deletion`,'GET',undefined,'anonymous',401);
  ok('Просмотр удаления и само удаление доступны только суперпользователю, включая прямой вызов API');
  const clean=await info(unused.id);assert.equal(clean.canDelete,true);assert.equal(clean.referenceCount,0);assert.deepEqual(clean.registrations,[]);
  await remove(unused.id,undefined,409);await remove(unused.id,'old-version',409);
  await remove(unused.id,clean.version);await api(`workspace/players/${unused.id}/deletion`,'GET',undefined,'admin',404);await remove(unused.id,clean.version,404);
  const recreated=await api('workspace/players','POST',unused,'admin',201);assert.notEqual(recreated.id,unused.id);
  await remove(recreated.id,(await info(recreated.id)).version);
  ok('Удаляется незаявленная карточка; подтверждение актуальной версии обязательно, повторное удаление безопасно, имя освобождается');
  const registered=await create();
  await register(registered,t1.id,t1.teamIds[0]);await register(registered,t1.id,t1.teamIds[1]);await register(registered,t2.id,t2.teamIds[0]);
  const all=await info(registered.id);assert.equal(all.registrations.length,3);assert.equal(all.registrations.filter(r=>r.active).length,2);assert.equal(all.canDelete,true);
  const before=await api('public');await remove(registered.id,all.version);
  assert.equal((await db.query('SELECT count(*)::int n FROM registrations WHERE "playerId"=$1',[registered.id])).rows[0].n,0);
  const after=await api('public');assert.ok(!after.players.some(p=>p.id===registered.id));assert.deepEqual(after.stats,before.stats);assert.deepEqual(after.matches,before.matches);
  const deletion=(await api('workspace/audit')).find(a=>a.action==='delete_player'&&a.entityId===registered.id);assert.ok(deletion);assert.equal(deletion.details.registrations.length,3);assert.ok(deletion.details.name.includes(registered.lastName));assert.ok(!JSON.stringify(deletion.details).includes('1970-01-01'));
  ok('Удаление очищает действующие и архивные заявки обеих лиг, сохраняет остальных игроков и результаты, фиксируется в журнале');
  const stale=await create();let old=await info(stale.id);
  await api(`workspace/players/${stale.id}`,'PATCH',{...stale,insured:false});
  await db.query('UPDATE players SET "updatedAt"=$1 WHERE id=$2',[stale.updatedAt,stale.id]);
  await remove(stale.id,old.version,409);
  old=await info(stale.id);await register(stale,t1.id,t1.teamIds[0]);await remove(stale.id,old.version,409);
  await remove(stale.id,(await info(stale.id)).version);
  ok('Изменение карточки или добавление заявки после открытия окна требует повторного подтверждения');
  const historyMatch=initial.matches.find(m=>m.protocolVersion>0);const history=await api(`workspace/matches/${historyMatch.id}`);const historyId=history.protocol.homeRoster[0].playerId;
  assert.ok((await info(historyId)).references.some(m=>m.id===historyMatch.id&&m.published));
  await remove(historyId,(await info(historyId)).version,409);
  const correction=emptyProtocol();Object.assign(correction,{detailLevel:'score_only',resolution:'draw',manualHomeScore:0,manualAwayScore:0});
  await draft(historyMatch.id,correction,201,true);
  const preserved=await info(historyId);assert.ok(preserved.references.some(m=>m.id===historyMatch.id&&m.published));await remove(historyId,preserved.version,409);
  await api('public');await api(`matches/${historyMatch.id}`);
  ok('Любая опубликованная версия защищает игрока, даже если последующее исправление уже не содержит его в составе');
  const target=initial.matches.find(m=>m.status==='scheduled'&&m.tournamentId===t1.id);
  const sheet={matchNumber:'',city:'',startedAt:'',endedAt:'',homeStaff:{headCoach:'',coach:'',manager:'',representative:''},awayStaff:{headCoach:'',coach:'',manager:'',representative:''},officials:{},timeouts:[],missedShots:[],disciplinaryNotes:'',matchNotes:'',injuryNotes:'',protestNotes:''};
  const paths=[['homeRoster','playerId'],['awayRoster','playerId'],['goals','scorerId'],['goals','assist1Id'],['goals','assist2Id'],['goals','homeOnIce'],['goals','awayOnIce'],['penalties','playerId'],['penalties','servedById'],['goalieShifts','playerId'],['shootout','playerId'],['shootout','goalieId'],['sheet','missedShots','playerId'],['sheet','missedShots','goalieId']];
  for(const path of paths){
    const p=await create(),protocol=emptyProtocol();
    const key=path.at(-1),item={[key]:key.endsWith('OnIce')?[p.id]:p.id};
    if(path[0]==='sheet')protocol.sheet={...sheet,missedShots:[item]};else protocol[path[0]]=[item];
    await draft(target.id,protocol);
    const blocked=await info(p.id);assert.equal(blocked.canDelete,false,path.join('.'));assert.ok(blocked.references.some(m=>m.id===target.id&&m.draft));await remove(p.id,blocked.version,409);
    await draft(target.id,emptyProtocol());await remove(p.id,(await info(p.id)).version);
  }
  ok('Черновики защищают все 14 ссылок на игрока: составы, голы и ассисты, игроки на льду, штрафы, вратари и штрафные броски');
  const unrelated=await create();const numeric=emptyProtocol();numeric.goals=[{teamId:unrelated.id,period:unrelated.id,id:String(unrelated.id)}];await draft(target.id,numeric);
  assert.equal((await info(unrelated.id)).canDelete,true);await remove(unrelated.id,(await info(unrelated.id)).version);await draft(target.id,emptyProtocol());
  ok('Совпадение ID с номером периода, команды или события не блокирует удаление постороннего игрока');
  const frozen=await create();const fr=await register(frozen,t1.id,t1.teamIds[0]);
  await db.query('UPDATE tournaments SET "qualificationSnapshot"=$1 WHERE id=$2',[JSON.stringify({ranking:[]}),t1.id]);
  const frozenInfo=await info(frozen.id);assert.equal(frozenInfo.canDelete,false);assert.ok(frozenInfo.registrations.find(r=>r.id===fr.id).frozen);await remove(frozen.id,frozenInfo.version,409);
  await db.query('UPDATE tournaments SET "qualificationSnapshot"=NULL,status=\'completed\' WHERE id=$1',[t1.id]);assert.equal((await info(frozen.id)).canDelete,false);
  await db.query('UPDATE tournaments SET status=\'active\' WHERE id=$1',[t1.id]);await remove(frozen.id,(await info(frozen.id)).version);
  ok('Составы плей-офф и завершённого турнира сохраняются при попытке удаления');
  // A gate in the isolated fixture pauses the writer after it has locked the player.
  const gate=await connection();await gate.query('SELECT pg_advisory_lock(17946,77)');
  await db.query(`CREATE FUNCTION deletion_test_gate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${target.id} AND NEW.draft IS NOT NULL THEN PERFORM pg_advisory_xact_lock(17946,77); END IF; RETURN NEW; END $$; CREATE TRIGGER deletion_test_gate BEFORE UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION deletion_test_gate()`);
  const writerFirst=await create();const wp=emptyProtocol();wp.homeRoster=[{playerId:writerFirst.id}];
  const saving=draft(target.id,wp);await waitLock('UPDATE "matches"');
  const deleting=remove(writerFirst.id,(await info(writerFirst.id)).version,409);await waitLock('FROM "players"');
  await gate.query('SELECT pg_advisory_unlock(17946,77)');await saving;await deleting;
  await db.query('DROP TRIGGER deletion_test_gate ON matches; DROP FUNCTION deletion_test_gate()');
  assert.equal((await info(writerFirst.id)).canDelete,false);await draft(target.id,emptyProtocol());await remove(writerFirst.id,(await info(writerFirst.id)).version);
  ok('Если сохранение черновика началось первым, удаление дожидается его и сохраняет карточку вместе с историей');
  for(const operation of ['draft','publish','registration','edit']){
    const p=await create();const expected=await info(p.id);const lock=await connection();await lock.query('BEGIN');await lock.query('SELECT id FROM players WHERE id=$1 FOR UPDATE',[p.id]);
    const removing=remove(p.id,expected.version);await waitLock('FROM "players"');
    let writing;
    if(operation==='registration')writing=register(p,t1.id,t1.teamIds[0]).then(()=>{throw Error('Registration should fail')},e=>{assert.match(e.message,/404/);});
    else if(operation==='edit')writing=api(`workspace/players/${p.id}`,'PATCH',{...p,insured:false},'admin',404);
    else{const protocol=emptyProtocol();protocol.homeRoster=[{playerId:p.id}];writing=draft(target.id,protocol,409,operation==='publish');}
    await waitLock('FROM "players"',2);await lock.query('COMMIT');await removing;await writing;
    assert.equal((await db.query('SELECT count(*)::int n FROM players WHERE id=$1',[p.id])).rows[0].n,0);
    assert.equal((await info(historyId)).canDelete,false);
    ok('Если удаление началось первым, операция '+operation+' отклоняется без потерянных ссылок и восстановления карточки');
  }
  console.log(`Готово: ${passed} проверок удаления игроков на отдельной PostgreSQL.`);
}finally{
  for(const c of clients){await c.query('ROLLBACK').catch(()=>{});await c.query('SELECT pg_advisory_unlock_all()').catch(()=>{});await c.end();}
  server.kill('SIGTERM');await Promise.race([once(server,'exit'),new Promise(r=>setTimeout(r,2000))]);
  await db.end();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();
}
