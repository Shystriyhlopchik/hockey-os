import test from 'node:test';
import assert from 'node:assert/strict';
import {ageOn,roundRobin,FESTIVAL_RULES,STANDARD_RULES,emptyProtocol,resolveProtocol,calculateStandings,validateRules,validateProtocolShape,protocolInMatchTime,Protocol,Rules} from './domain';
const rules:Rules={...FESTIVAL_RULES,minSkaters:3,maxSkaters:20};
const match={homeTeamId:1,awayTeamId:2,stage:'regular'};
function protocol():Protocol{const p=emptyProtocol();p.homeRoster=[1,2,3,4].map((id,i)=>({playerId:id,number:id,position:i===0?'G':'F',captain:i===1?'C':'',played:true}));p.awayRoster=p.homeRoster.map(x=>({...x,playerId:x.playerId+10}));return p;}
function goal(p:Protocol,team=1,period=1,time='03:20'){p.goals.push({id:'g'+p.goals.length,teamId:team,period,time,scorerId:team===1?2:12,assist1Id:team===1?3:13,assist2Id:team===1?4:14,situation:'EV'});}
test('Возраст вычисляется по дню рождения',()=>{assert.equal(ageOn('1986-11-09','2026-11-08'),39);assert.equal(ageOn('1986-11-09','2026-11-09'),40);});
test('Два круга: каждая пара играет дважды и не встречается сама с собой',()=>{const rows=roundRobin([1,2,3,4,5,6,7,8],2);assert.equal(rows.length,56);for(let a=1;a<=8;a++)for(let b=a+1;b<=8;b++){assert.equal(rows.filter(x=>x.homeTeamId===a&&x.awayTeamId===b).length,1);assert.equal(rows.filter(x=>x.homeTeamId===b&&x.awayTeamId===a).length,1);}for(let r=1;r<=14;r++){const ids=rows.filter(x=>x.round===r).flatMap(x=>[x.homeTeamId,x.awayTeamId]);assert.equal(new Set(ids).size,ids.length);}});
test('Нечётное число участников не создаёт фиктивную команду',()=>{const rows=roundRobin([1,2,3],1);assert.equal(rows.length,3);assert.ok(rows.every(x=>x.homeTeamId>0&&x.awayTeamId>0));});
test('Гол с двумя ассистентами формирует счёт нужного периода',()=>{const p=protocol();goal(p,1,2);const r=resolveProtocol(p,match,rules);assert.equal(r.homeScore,1);assert.equal(r.periodScores[1].home,1);assert.equal(r.winnerId,1);});
test('Автор не может ассистировать самому себе',()=>{const p=protocol();goal(p);p.goals[0].assist1Id=2;assert.throws(()=>resolveProtocol(p,match,rules),/разными/);});
test('Автор из другой команды отвергается',()=>{const p=protocol();goal(p);p.goals[0].scorerId=12;assert.throws(()=>resolveProtocol(p,match,rules),/отсутствует/);});
test('Не участвовавший игрок не получает гол',()=>{const p=protocol();goal(p);p.homeRoster[1].played=false;assert.throws(()=>resolveProtocol(p,match,rules),/участвовавший/);});
test('Время после окончания 15-минутного периода отвергается',()=>{const p=protocol();goal(p,1,1,'15:01');assert.throws(()=>resolveProtocol(p,match,rules),/пределы/);});
test('Ничья разрешена только в регулярном этапе',()=>{const p=protocol();p.resolution='draw';assert.equal(resolveProtocol(p,match,rules).winnerId,null);assert.throws(()=>resolveProtocol(p,{...match,stage:'quarter'},rules),/Ничья/);});
test('Овертайм завершается первой шайбой',()=>{const p=protocol();p.resolution='overtime';goal(p,1,4,'01:00');assert.equal(resolveProtocol(p,{...match,stage:'semi'},rules).homeScore,1);goal(p,1,4,'02:00');assert.throws(()=>resolveProtocol(p,{...match,stage:'semi'},rules),/первой шайбой/);});
test('Регулярка фестиваля не принимает исход ОТ',()=>{const p=protocol();p.resolution='overtime';goal(p,1,4,'01:00');assert.throws(()=>resolveProtocol(p,match,rules),/не предусматривает/);});
test('Технический результат не создаёт голов игроков',()=>{const p=emptyProtocol();p.resolution='technical';p.manualHomeScore=5;p.manualAwayScore=0;p.technicalReason='Неявка команды';assert.equal(resolveProtocol(p,match,rules).homeScore,5);goal(p);assert.throws(()=>resolveProtocol(p,match,rules));});
test('Итоговый счёт допускается без выдуманных составов',()=>{const p=emptyProtocol();p.detailLevel='score_only';p.manualHomeScore=3;p.manualAwayScore=2;const r=resolveProtocol(p,match,rules);assert.equal(r.homeScore,3);assert.deepEqual(r.periodScores,[]);});
test('Нельзя дублировать номер в составе',()=>{const p=protocol();goal(p);p.homeRoster[1].number=1;assert.throws(()=>resolveProtocol(p,match,rules),/Номера/);});
test('Интервалы вратарей не пересекаются',()=>{const p=protocol();goal(p);p.goalieShifts=[{teamId:1,playerId:1,from:'00:00',to:'25:00'},{teamId:1,playerId:1,from:'24:00',to:'45:00'}];assert.throws(()=>resolveProtocol(p,match,rules),/пересекаются/);});
test('Вратарю нельзя добавить время после матча',()=>{const p=protocol();goal(p);p.goalieShifts=[{teamId:1,playerId:1,from:'00:00',to:'60:00'}];assert.throws(()=>resolveProtocol(p,match,rules),/интервал/);});
test('Полная серия бросков добавляет одну командную шайбу',()=>{const p=protocol();p.resolution='shootout';for(let i=0;i<3;i++){p.shootout.push({teamId:1,playerId:2,goalieId:11,scored:i===0},{teamId:2,playerId:12,goalieId:1,scored:false});}const r=resolveProtocol(p,match,{...STANDARD_RULES,minSkaters:3});assert.equal(r.homeScore,1);assert.equal(p.goals.length,0);});
test('Незавершённая серия бросков отвергается',()=>{const p=protocol();p.resolution='shootout';p.shootout=[{teamId:1,playerId:2,goalieId:11,scored:true},{teamId:2,playerId:12,goalieId:1,scored:false}];assert.throws(()=>resolveProtocol(p,match,{...STANDARD_RULES,minSkaters:3}),/не завершена/);});
test('Таблица учитывает личные встречи трёх команд',()=>{const teams=[1,2,3].map(id=>({id,name:String(id),color:'',abbreviation:''}));const matches=[[1,2,5,0],[2,3,3,0],[3,1,2,0]].map(([homeTeamId,awayTeamId,homeScore,awayScore])=>({homeTeamId,awayTeamId,homeScore,awayScore,stage:'regular',status:'completed',resolution:'regulation'}));const result=calculateStandings(teams,matches,rules);assert.deepEqual(result.map(x=>x.teamId),[1,3,2]);assert.ok(result.every(x=>x.points===2));});
test('Неопубликованные матчи не влияют на таблицу',()=>{const teams=[{id:1,name:'А',color:'',abbreviation:''},{id:2,name:'Б',color:'',abbreviation:''}];const result=calculateStandings(teams,[{...match,homeScore:5,awayScore:0,status:'scheduled',resolution:'regulation'}],rules);assert.ok(result.every(x=>x.played===0&&x.points===0));});
test('Некорректные правила и составные разделы отвергаются',()=>{assert.throws(()=>validateRules({...rules,minSkaters:21,maxSkaters:20}));const p=protocol();(p.goals as any)=[null];assert.throws(()=>validateProtocolShape(p),/раздел/);});

test('Время матча 21:00 во втором и 42:00 в третьем периоде принимается при 3×15 и 3×20',()=>{
  for(const minutes of [15,20]){
    const p=protocol();p.timeBasis='match';goal(p,1,2,'21:00');goal(p,1,3,'42:00');
    const original=structuredClone(p),result=resolveProtocol(p,match,{...rules,periodMinutes:minutes});
    assert.equal(result.homeScore,2);assert.equal(result.periodScores[1].home,1);assert.equal(result.periodScores[2].home,1);
    assert.deepEqual(p,original);
  }
});
test('Время матча проверяется по обеим границам периода с указанием проблемного гола',()=>{
  const p=protocol();p.timeBasis='match';goal(p,1,2,'14:59');
  for(const time of ['14:59','30:01']){p.goals[0].time=time;assert.throws(()=>resolveProtocol(p,match,rules),/Гол №1:.*15:00–30:00/);}
  for(const time of ['15:00','30:00']){p.goals[0].time=time;assert.equal(resolveProtocol(p,match,rules).homeScore,1);}
  p.goals[0].period=3;p.goals[0].time='29:59';assert.throws(()=>resolveProtocol(p,match,rules),/30:00–45:00/);
  p.goals[0].time='45:01';assert.throws(()=>resolveProtocol(p,match,rules),/30:00–45:00/);
  p.goals[0].period=2;p.goals[0].time='19:59';assert.throws(()=>resolveProtocol(p,match,{...rules,periodMinutes:20}),/20:00–40:00/);
  p.goals[0].time='21:60';assert.throws(()=>resolveProtocol(p,match,rules),/Гол №1: Секунды/);
});
test('Удаления используют общее время матча и сообщают номер ошибочной записи',()=>{
  const p=protocol();p.timeBasis='match';goal(p);
  p.penalties=[{id:'match-penalty',teamId:1,playerId:null,period:2,time:'21:00',minutes:2,code:'Командный штраф',start:'21:00',end:'23:00'}];
  assert.equal(resolveProtocol(p,match,rules).homeScore,1);
  p.penalties[0].period=3;p.penalties[0].time='42:00';assert.equal(resolveProtocol(p,match,rules).homeScore,1);
  p.penalties[0].period=2;assert.throws(()=>resolveProtocol(p,match,rules),/Удаление №1:.*15:00–30:00/);
});
test('Общее время овертаймов не удваивается при расчёте интервалов вратаря',()=>{
  for(const [period,time] of [[4,'61:30'],[5,'66:30']] as const){
    const p=protocol();p.timeBasis='match';p.resolution='overtime';goal(p,1,period,time);
    p.goalieShifts=[{teamId:1,playerId:1,from:'00:00',to:time}];
    assert.equal(resolveProtocol(p,match,{...STANDARD_RULES,minSkaters:3}).homeScore,1);
    p.goalieShifts[0].to=time.slice(0,3)+'31';assert.throws(()=>resolveProtocol(p,match,{...STANDARD_RULES,minSkaters:3}),/интервал/);
  }
});
test('Старые протоколы переводятся в общее время без изменения сохранённых данных и повторного прибавления',()=>{
  const p=protocol();goal(p,1,2,'06:00');goal(p,1,3,'12:00');
  p.penalties=[{id:'legacy-penalty',teamId:1,playerId:null,period:3,time:'12:15',minutes:2,code:'Штраф',start:'42:15',end:'44:15'}];
  p.goalieShifts=[{teamId:1,playerId:1,from:'00:00',to:'45:00'}];
  const original=structuredClone(p),converted=protocolInMatchTime(p,rules);
  assert.equal(converted.timeBasis,'match');assert.deepEqual(converted.goals.map(g=>g.time),['21:00','42:00']);
  assert.equal(converted.penalties[0].time,'42:15');assert.equal(converted.penalties[0].start,'42:15');assert.deepEqual(converted.goalieShifts,p.goalieShifts);
  assert.deepEqual(protocolInMatchTime(converted,rules),converted);assert.deepEqual(p,original);
  assert.deepEqual(resolveProtocol(converted,match,rules),resolveProtocol(p,match,rules));
});
test('Незавершённый старый черновик остаётся доступен для исправления',()=>{
  const p=protocol();goal(p,1,2,'21:00');goal(p,1,3,'не заполнено');
  const converted=protocolInMatchTime(p,rules);
  assert.deepEqual(converted.goals.map(g=>g.time),['21:00','не заполнено']);assert.equal(converted.timeBasis,'match');
  const invalid={...p,timeBasis:'unknown'} as unknown as Protocol;assert.throws(()=>validateProtocolShape(invalid),/формат времени/);
});
