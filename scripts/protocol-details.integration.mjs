import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const root=process.cwd(),require=createRequire(resolve('backend/package.json'));
const {Client}=require('pg'),{Workbook}=require('exceljs'),{emptyProtocol}=require('./dist/domain.js');
const source=new URL(process.env.PROTOCOL_TEST_DATABASE_URL||'');
assert.ok(['localhost','127.0.0.1'].includes(source.hostname));assert.equal(source.port,'15444','Use the isolated protocol test database');
source.pathname='/postgres';const admin=new Client({connectionString:source.href});await admin.connect();
const database='hockey_protocol_test_'+Date.now();await admin.query(`CREATE DATABASE "${database}"`);
const url=new URL(source);url.pathname='/'+database;
const temp=await mkdtemp(join(tmpdir(),'hockey-protocol-')),port=4124,base=`http://127.0.0.1:${port}/api/`;
let log='',passed=0;const cookies={};
const server=spawn(process.execPath,[resolve(root,'backend/dist/main.js')],{cwd:temp,env:{...process.env,DATABASE_URL:url.href,NODE_ENV:'test',DEMO_SEED:'true',DEMO_PASSWORD:'ProtocolTest2026!',JWT_SECRET:'protocol-test-only-session-key-at-least-32-characters',FRONTEND_ORIGIN:`http://127.0.0.1:${port}`,PORT:String(port),HOST:'127.0.0.1',UPLOAD_DIR:join(temp,'uploads')},stdio:['ignore','pipe','pipe'],windowsHide:true});
server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
async function api(path,method='GET',body,status=200,who='secretary'){
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookies[who]?{Cookie:cookies[who]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const result=await r.json();assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(result)}`);return result;
}
const ok=message=>{passed++;console.log('✓ '+message);};
async function save(matchId,p,publish,status=201){const detail=await api(`workspace/matches/${matchId}`);return api(`workspace/matches/${matchId}/${publish?'publish':'draft'}`,'POST',{protocol:p,expectedDraftVersion:detail.draftVersion,expectedProtocolVersion:detail.match.protocolVersion,reason:'Проверка новых полей протокола'},status);}
async function cleanup(){
  if(server.exitCode===null){const stopped=once(server,'exit');server.kill();await stopped;}
  await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()',[database]);
  await admin.query(`DROP DATABASE "${database}"`);await admin.end();await rm(temp,{recursive:true,force:true});
}
try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'health')).ok){ready=true;break;}}catch{}if(server.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,150));}assert.ok(ready,log);
  for(const who of ['admin','secretary']){const r=await fetch(base+'auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:who,password:'ProtocolTest2026!'})});assert.equal(r.status,200);cookies[who]=r.headers.get('set-cookie').split(';')[0];}
  const workspace=await api('workspace'),match=workspace.matches.find(m=>m.status==='scheduled'),tournament=workspace.tournaments.find(t=>t.id===match.tournamentId);
  const roster=teamId=>workspace.registrations.filter(r=>r.teamId===teamId&&r.tournamentId===match.tournamentId&&r.active).map(r=>({...r,position:workspace.players.find(p=>p.id===r.playerId).position})).sort((a,b)=>Number(b.position==='G')-Number(a.position==='G')||a.number-b.number).map((r,i)=>({playerId:r.playerId,number:r.number,position:r.position,captain:r.captain||'',played:r.position!=='G'||i===0}));
  const p=emptyProtocol();Object.assign(p,{timeBasis:'match',goalieStatsVersion:1,homeRoster:roster(match.homeTeamId),awayRoster:roster(match.awayTeamId),referee:'Главный Тестовый',spectators:125});
  const homeKeeper=p.homeRoster.find(r=>r.position==='G'),awayKeeper=p.awayRoster.find(r=>r.position==='G'),scorer=p.homeRoster.find(r=>r.position!=='G'),assistant=p.homeRoster.find(r=>r.position!=='G'&&r!==scorer);
  const bench=p.awayRoster.find(r=>!r.played);assert.ok(bench,'Fixture needs a backup keeper');
  p.bestPlayerId=awayKeeper.playerId;
  p.goals=[{id:'goal-pp-empty',teamId:match.homeTeamId,period:3,time:'44:00',scorerId:scorer.playerId,assist1Id:assistant.playerId,assist2Id:null,strength:'PP',goalType:'empty_net',situation:'EN',goalieId:null}];
  p.penalties=[{id:'penalty-1',teamId:match.homeTeamId,playerId:scorer.playerId,servedById:assistant.playerId,period:2,time:'21:00',start:'21:00',end:'23:00',timingMode:'start',minutes:2,code:'Подножка'}];
  p.goalieShifts=[{teamId:match.homeTeamId,playerId:homeKeeper.playerId,from:'00:00',to:'45:00'},{teamId:match.awayTeamId,playerId:awayKeeper.playerId,from:'00:00',to:'43:59'},{teamId:match.awayTeamId,playerId:null,from:'43:59',to:'45:00'}];
  const staff={headCoach:'',coach:'',manager:'',representative:''};
  p.sheet={matchNumber:'Т-1',city:'Чебоксары',startedAt:'',endedAt:'',homeStaff:{...staff},awayStaff:{...staff},officials:{referee2:'Второй Главный',linesman1:'Линейный Первый',linesman2:'Линейный Второй',secretary:'Секретарь Тестовая',timekeeper:'Хронометрист Тестовый',inspector:'Инспектор Тестовый'},timeouts:[],missedShots:[],disciplinaryNotes:'',matchNotes:'',injuryNotes:'Закрытая медицинская запись',protestNotes:''};
  await save(match.id,p,false);const reopened=await api(`workspace/matches/${match.id}`);assert.deepEqual(reopened.draft,p);ok('Секретарь сохраняет и повторно открывает MVP, два признака гола и начало/конец удаления без потери данных');
  const invalid=structuredClone(p);invalid.bestPlayerId=bench.playerId;assert.match((await save(match.id,invalid,true,400)).message,/должен участвовать/);
  invalid.bestPlayerId=p.bestPlayerId;invalid.penalties[0].time='20:00';assert.match((await save(match.id,invalid,true,400)).message,/Момент назначения/);
  invalid.penalties[0].time='21:00';invalid.goals[0].situation='EV';assert.match((await save(match.id,invalid,true,400)).message,/не соответствует/);ok('API отвергает запасного MVP, несовместимое время и несогласованный тип гола');
  await save(match.id,p,true);let published=await api(`matches/${match.id}`);assert.equal(published.protocol.bestPlayerId,awayKeeper.playerId);assert.equal(published.protocol.goals[0].strength,'PP');assert.equal(published.protocol.goals[0].goalType,'empty_net');assert.equal(published.match.homeScore,1);assert.equal(published.protocol.sheet.officials.inspector,'Инспектор Тестовый');assert.ok(!('injuryNotes' in published.protocol.sheet));ok('Публичный протокол показывает новые данные и судейство, медицинские сведения остаются служебными');
  const response=await fetch(base+`matches/${match.id}/export.xlsx`);assert.equal(response.status,200);const workbook=new Workbook();await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));const rows=[];workbook.eachSheet(s=>s.eachRow(r=>rows.push(r.values.slice(1))));
  assert.ok(rows.some(r=>r[0]==='Лучший игрок матча'&&r[1]===published.identities[awayKeeper.playerId].name));assert.ok(rows.some(r=>r.includes('В большинстве · В пустые ворота')));assert.ok(rows.some(r=>r.includes('Инспектор Тестовый')));assert.ok(rows.some(r=>r[0]===2&&r[7]==='21:00'&&r[8]==='23:00'));assert.ok(!JSON.stringify(rows).includes('Закрытая медицинская запись'));ok('XLSX содержит MVP, полную ситуацию гола, начало/конец и все заполненные должности');
  p.penalties[0].timingMode='separate';p.penalties[0].time='20:30';await save(match.id,p,true);published=await api(`matches/${match.id}`);assert.equal(published.match.protocolVersion,2);assert.equal(published.protocol.penalties[0].time,'20:30');assert.equal(published.protocol.penalties[0].start,'21:00');assert.equal(published.protocol.bestPlayerId,p.bestPlayerId);ok('Исправленная версия сохраняет отдельное назначение удаления и MVP');
  console.log(`Passed ${passed} protocol integration checks. Match ${match.id}.`);
  if(process.argv.includes('--preview')){console.log(`PREVIEW_READY http://127.0.0.1:${port}/office/protocol/${match.id} public /matches/${match.id}`);await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});}
}finally{await cleanup();}
