import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
process.loadEnvFile('.env');
const require=createRequire(resolve('backend/package.json'));
const {Client}=require('pg');const {Workbook}=require('exceljs');const {emptyProtocol,FESTIVAL_RULES}=require('./dist/domain.js');
const name='hockey_test_'+Date.now();assert.match(name,/^hockey_test_\d+$/);
const adminUrl=new URL(process.env.DATABASE_URL);adminUrl.pathname='/postgres';
const admin=new Client({connectionString:adminUrl.href});await admin.connect();await admin.query(`CREATE DATABASE "${name}"`);
const testUrl=new URL(process.env.DATABASE_URL);testUrl.pathname='/'+name;
const port=4101,base=`http://127.0.0.1:${port}/api/`;let log='';let passed=0;
const server=spawn(process.execPath,[resolve('backend/dist/main.js')],{cwd:process.cwd(),env:{...process.env,PORT:String(port),DATABASE_URL:testUrl.href,DEMO_SEED:'true',NODE_ENV:'test'},stdio:['ignore','pipe','pipe'],windowsHide:true});
server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const sessions={};
async function api(path,method='GET',body,who='admin',expected=200){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(sessions[who]?{Cookie:sessions[who]}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);return data;}
async function login(username){const response=await fetch(base+'auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:process.env.DEMO_PASSWORD})});assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/HttpOnly/i);sessions[username]=response.headers.get('set-cookie').split(';')[0];return response.json();}
function ok(message){passed++;console.log(`✓ ${message}`);}
function scoreProtocol(home,away){const p=emptyProtocol();p.detailLevel='score_only';p.manualHomeScore=home;p.manualAwayScore=away;p.resolution=home===away?'draw':'regulation';return p;}
async function publish(id,p,who='admin',reason=''){const d=await api(`workspace/matches/${id}`,'GET',undefined,who);return api(`workspace/matches/${id}/publish`,'POST',{protocol:p,expectedDraftVersion:d.draftVersion,expectedProtocolVersion:d.match.protocolVersion,reason},who,201);}
try{
  let ready=false;for(let i=0;i<80;i++){try{const r=await fetch(base+'health');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready,log);
  for(const route of ['/', '/tournaments', '/office']){const r=await fetch(`http://127.0.0.1:${port}${route}`);assert.equal(r.status,200);assert.match(await r.text(),/<app-root>/);}
  assert.equal((await fetch(base+'unknown')).status,404);
  const pub=await api('public');assert.equal(pub.tournaments.length,2);assert.equal(pub.players.length,352);assert.equal(pub.matches.length,112);assert.ok(!JSON.stringify(pub).includes('passwordHash'));assert.ok(!('birthDate' in pub.players[0]));ok('Чистая миграция и демо-данные; публичный API не раскрывает закрытые поля');
  await api('workspace','GET',undefined,'anonymous',401);await login('admin');await login('secretary');await login('organizer');await login('community');ok('Четыре роли входят через HttpOnly-сессию; анонимный доступ в кабинет закрыт');
  await api('workspace/community','PATCH',{},'secretary',403);await api('workspace/tournaments','POST',{},'secretary',403);
  const outsider=await api('workspace/users','POST',{username:'outsider',displayName:'Без назначений',password:process.env.DEMO_PASSWORD,role:'secretary',active:true,tournamentIds:[]},'admin',201);await login('outsider');
  assert.equal((await api('workspace','GET',undefined,'outsider')).tournaments.length,0);await api('workspace/matches/1','GET',undefined,'outsider',403);ok('Секретарь не меняет правила; назначения изолируют турниры');
  await api('workspace/tournaments/2/staff','PATCH',{secretaryIds:[outsider.id]},'organizer');
  assert.deepEqual((await api('workspace','GET',undefined,'outsider')).tournaments.map(x=>x.id),[2]);await api('workspace/matches/1','GET',undefined,'outsider',403);
  await api('workspace/tournaments/1/staff','PATCH',{secretaryIds:[]},'secretary',403);ok('Администратор турнира назначает секретарей в своих пределах; секретарь не выдаёт доступ');
  const countBefore=(await api('workspace')).players.length;
  await api('workspace/players','POST',{tournamentId:1,firstName:'Проверочный',lastName:'Игрок',birthDate:'1990-01-01',position:'F',qualification:'amateur',teamId:1,number:1,registerAfter:true},'secretary',409);
  assert.equal((await api('workspace')).players.length,countBefore);ok('Ошибка заявки откатывает создание игрока целиком');
  await api('workspace/matches/10','PATCH',{startsAt:pub.matches.find(x=>x.id===9).startsAt,venue:'Новое Поколение',slotMinutes:90},'admin',409);ok('Пересечения интервалов арены не допускаются');
  const draftMatch=pub.matches.find(x=>x.tournamentId===1&&x.status==='scheduled');const d=await api(`workspace/matches/${draftMatch.id}`,'GET',undefined,'secretary');const p=emptyProtocol();
  for(const c of d.candidates){const r={playerId:c.playerId,number:c.number,position:c.player.position,captain:c.captain,played:c.player.position!=='G'||c.number===1};(c.teamId===d.match.homeTeamId?p.homeRoster:p.awayRoster).push(r);}
  p.goals=[{id:'integration-goal',teamId:d.match.homeTeamId,period:2,time:'03:25',scorerId:p.homeRoster[9].playerId,assist1Id:p.homeRoster[3].playerId,assist2Id:p.homeRoster[4].playerId,situation:'EV'}];
  const body={protocol:p,expectedDraftVersion:0,expectedProtocolVersion:0};
  await api(`workspace/matches/${draftMatch.id}/draft`,'POST',body,'secretary',201);
  await api(`workspace/matches/${draftMatch.id}/publish`,'POST',body,'secretary',409);ok('Сохранение черновика и защита устаревшего запроса');
  await publish(draftMatch.id,p,'secretary');let after=await api('public');assert.equal(after.matches.find(x=>x.id===draftMatch.id).homeScore,1);
  const original=after.stats.find(x=>x.playerId===p.homeRoster[9].playerId&&x.tournamentId===1).goals;
  await publish(draftMatch.id,p,'secretary','Исправлено описание');after=await api('public');assert.equal(after.stats.find(x=>x.playerId===p.homeRoster[9].playerId&&x.tournamentId===1).goals,original);assert.equal(after.matches.find(x=>x.id===draftMatch.id).protocolVersion,2);ok('Публикация обновляет результат и статистику; новая версия не удваивает голы');
  const exportResponse=await fetch(base+`matches/${draftMatch.id}/export.xlsx`);assert.equal(exportResponse.status,200);const wb=new Workbook();await wb.xlsx.load(Buffer.from(await exportResponse.arrayBuffer()));assert.deepEqual(wb.worksheets.map(s=>s.name),['Протокол','Дополнения']);assert.ok(wb.worksheets[0].rowCount>40);ok('Экспорт XLSX содержит составы, голы и второй лист');
  const rules={...FESTIVAL_RULES,rounds:1,playoffSkaterGames:0,playoffGoalieGames:0,semiWins:2,finalWins:2};
  const tournament=await api('workspace/tournaments','POST',{name:'Проверка серий',slug:'series-test',seasonId:1,division:'18+',description:'Изолированный тест',teamIds:pub.tournaments[0].teamIds.slice(0,2),rules},'admin',201);
  await api(`workspace/tournaments/${tournament.id}/schedule`,'POST',{startsAt:'2027-01-01T12:00:00+03:00',venue:'Тестовая арена',slotMinutes:90},'admin',201);
  await api(`workspace/tournaments/${tournament.id}/launch`,'POST',{},'admin',201);
  await api(`workspace/tournaments/${tournament.id}`,'PATCH',{...tournament,rules:{...rules,periodMinutes:20}},'admin',409);ok('Запуск фиксирует правила турнира');
  let work=await api('workspace');const regular=work.matches.find(x=>x.tournamentId===tournament.id);await publish(regular.id,scoreProtocol(1,0));
  await api(`workspace/tournaments/${tournament.id}/playoff`,'POST',{size:2},'admin',201);work=await api('workspace');const series=work.series.find(x=>x.tournamentId===tournament.id);let games=work.matches.filter(x=>x.seriesId===series.id).sort((a,b)=>a.gameNumber-b.gameNumber);assert.equal(games.length,3);
  const last=await api(`workspace/matches/${games[2].id}`);await api(`workspace/matches/${games[2].id}/publish`,'POST',{protocol:scoreProtocol(1,0),expectedDraftVersion:last.draftVersion,expectedProtocolVersion:0},'admin',409);ok('Плей-офф создаёт серию; нельзя пропустить предыдущий матч');
  await publish(games[0].id,scoreProtocol(1,0));await publish(games[1].id,scoreProtocol(1,0));work=await api('workspace');assert.equal(work.series.find(x=>x.id===series.id).wins1,2);assert.ok(!work.matches.some(x=>x.id===games[2].id));ok('Серия 2:0 завершается досрочно; лишний матч скрывается');
  await publish(games[1].id,scoreProtocol(0,10),'admin','Пересмотр результата');work=await api('workspace');assert.equal(work.series.find(x=>x.id===series.id).status,'active');assert.equal(work.matches.find(x=>x.id===games[2].id).status,'scheduled');
  await publish(games[2].id,scoreProtocol(0,1));work=await api('workspace');const done=work.series.find(x=>x.id===series.id);assert.equal(done.winnerId,series.team1Id);assert.equal(done.wins1,2);assert.equal(done.wins2,1);assert.equal(work.tournaments.find(x=>x.id===tournament.id).status,'completed');ok('Пересмотр возобновляет серию; победитель определяется победами, а не суммой шайб');
  const t2=await api('workspace/tournaments','POST',{name:'Чужой турнир',slug:'scope-test',seasonId:1,division:'18+',description:'',teamIds:[],rules},'admin',201);await api(`workspace/tournaments/${t2.id}`,'PATCH',{...t2,name:'Вмешательство'},'organizer',403);ok('Администратор турнира не меняет неназначенный турнир');
  const cup=await api('workspace/tournaments','POST',{name:'Кубок четырёх',slug:'cup-four',seasonId:1,division:'18+',description:'',teamIds:pub.tournaments[0].teamIds.slice(0,4),rules},'admin',201);
  await api(`workspace/tournaments/${cup.id}/schedule`,'POST',{startsAt:'2027-02-10T12:00:00+03:00',venue:'Кубковая арена',slotMinutes:90},'admin',201);await api(`workspace/tournaments/${cup.id}/launch`,'POST',{},'admin',201);
  work=await api('workspace');for(const g of work.matches.filter(x=>x.tournamentId===cup.id))await publish(g.id,scoreProtocol(g.homeTeamId<g.awayTeamId?1:0,g.homeTeamId<g.awayTeamId?0:1));
  await api(`workspace/tournaments/${cup.id}/playoff`,'POST',{size:4},'admin',201);work=await api('workspace');const semis=work.series.filter(x=>x.tournamentId===cup.id&&x.round==='semi');
  for(const s of semis){const games=work.matches.filter(x=>x.seriesId===s.id).sort((a,b)=>a.gameNumber-b.gameNumber);await publish(games[0].id,scoreProtocol(1,0));await publish(games[1].id,scoreProtocol(1,0));}
  work=await api('workspace');const final=work.series.find(x=>x.tournamentId===cup.id&&x.round==='final');assert.ok(final.team1Id&&final.team2Id);const finalGames=work.matches.filter(x=>x.seriesId===final.id);assert.equal(finalGames.length,3);ok('Победители полуфиналов автоматически попадают в единственную финальную серию');
  const fd=await api(`workspace/matches/${finalGames[0].id}`);await api(`workspace/matches/${finalGames[0].id}/draft`,'POST',{protocol:scoreProtocol(1,0),expectedDraftVersion:fd.draftVersion,expectedProtocolVersion:0},'admin',201);
  const semiGame=work.matches.find(x=>x.seriesId===semis[0].id);const sd=await api(`workspace/matches/${semiGame.id}`);
  await api(`workspace/matches/${semiGame.id}/publish`,'POST',{protocol:scoreProtocol(0,1),expectedDraftVersion:sd.draftVersion,expectedProtocolVersion:sd.match.protocolVersion,reason:'Пересмотр после начала финала'},'admin',409);ok('Пересмотр не переписывает участника уже начатой следующей серии');
  await publish(finalGames[0].id,scoreProtocol(1,0));await publish(finalGames[1].id,scoreProtocol(1,0));work=await api('workspace');assert.equal(work.placements[cup.id].length,3);const third=work.placements[cup.id].find(x=>x.place===3).teamId;const losers=semis.map(s=>s.team2Id);const frozen=work.tournaments.find(x=>x.id===cup.id).qualificationSnapshot.ranking;assert.equal(third,frozen.find(x=>losers.includes(x.teamId)).teamId);ok('Бронза присуждается лучшему по регулярке из проигравших полуфиналистов');
  const audit=await api('workspace/audit');assert.ok(audit.some(a=>a.action==='publish_protocol'));assert.ok(audit.some(a=>a.action==='correct_protocol'));ok('Журнал сохраняет публикации и причины исправлений');
  console.log(`Готово: ${passed} сквозных проверок на отдельной PostgreSQL.`);
}finally{
  server.kill('SIGTERM');await Promise.race([once(server,'exit'),new Promise(r=>setTimeout(r,2000))]);
  await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();
}
