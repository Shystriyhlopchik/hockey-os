import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSheet,periodSummary,protocolWarnings} from '../src/protocol-sheet.ts';
const match={id:27,homeTeamId:1,awayTeamId:2};
const rules={periods:3,periodMinutes:15,minSkaters:1,maxSkaters:20,minGoalies:1,maxGoalies:2};
const protocol=()=>({detailLevel:'full',resolution:'regulation',referee:'Судья',manualHomeScore:null,manualAwayScore:null,homeRoster:[{playerId:1,number:1,position:'G'},{playerId:2,number:2,position:'F'}],awayRoster:[{playerId:11,number:1,position:'G'},{playerId:12,number:2,position:'F'}],goals:[{id:'g1',teamId:1,period:2,time:'21:00'}],penalties:[{teamId:2,period:2,minutes:2}],goalieShifts:[],shootout:[]});
test('Старый протокол получает пустые необязательные поля без изменения сохранённого объекта',()=>{
  const source=protocol(),original=structuredClone(source),p=prepareSheet(source,match,'Чебоксары');
  assert.equal(p.sheet.matchNumber,'27');assert.equal(p.sheet.city,'Чебоксары');assert.equal(p.sheet.officials.secretary,'');
  p.goals[0].homeOnIce.push(1);assert.deepEqual(source,original);
});
test('Сведения с бумажного бланка и медицинские заметки сохраняются при повторном открытии',()=>{
  const p=prepareSheet(protocol(),match,'Чебоксары');p.sheet.matchNumber='Б-7';p.sheet.injuryNotes='Уведомление';p.sheet.officials.secretary='Иванов';p.sheet.homeStaff.headCoach='Петров';p.sheet.timeouts=[{teamId:1,period:2,time:'21:00'}];
  const reopened=prepareSheet(p,match,'Другой город');assert.deepEqual(reopened,p);reopened.sheet.timeouts[0].time='22:00';assert.equal(p.sheet.timeouts[0].time,'21:00');
});
test('Сводка считает голы и минуты по периодам отдельно для каждой команды',()=>{
  const p=protocol();p.goals.push({id:'g2',teamId:2,period:3,time:'42:00'});p.penalties.push({teamId:1,period:3,minutes:5},{teamId:1,period:3,minutes:0,kind:'penalty_shot'});
  const {rows,total}=periodSummary(p,match,rules);assert.equal(rows[1].home,1);assert.equal(rows[1].awayPenalty,2);assert.equal(rows[2].homePenalty,5);assert.deepEqual(total,{label:'Общий',home:1,away:1,homePenalty:5,awayPenalty:2});
});
test('Серия БП добавляет только одну командную шайбу; режим счёта не выдумывает периодов',()=>{
  const p=protocol();p.resolution='shootout';p.goals=[];p.shootout=[{teamId:1,scored:true},{teamId:1,scored:true},{teamId:2,scored:false}];
  assert.equal(periodSummary(p,match,rules).total.home,1);
  p.detailLevel='score_only';p.manualHomeScore=7;p.manualAwayScore=3;assert.deepEqual(periodSummary(p,match,rules).rows,[]);assert.equal(periodSummary(p,match,rules).total.home,7);
});
test('Проверка подсказывает недостающие разделы и несогласованный исход',()=>{
  const p=prepareSheet(protocol(),match);p.referee='';p.resolution='draw';const warnings=protocolWarnings(p,match,rules);
  assert.ok(warnings.some(s=>s.includes('главный судья')));assert.ok(warnings.some(s=>s.includes('секретарь')));assert.ok(warnings.some(s=>s.includes('вратарей')));assert.ok(warnings.some(s=>s.includes('счёт команд различается')));
});
