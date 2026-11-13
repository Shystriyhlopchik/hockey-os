export type Role = 'superuser' | 'community_admin' | 'tournament_admin' | 'secretary';
export type Position = 'G' | 'D' | 'F';
export type Qualification = 'novice' | 'amateur' | 'school' | 'former_master';
export interface Rules {
  profile: 'festival' | 'standard' | 'custom'; periods: number; periodMinutes: number;
  allowDraw: boolean; pointsWin: number; pointsDraw: number; pointsLoss: number; pointsOvertimeLoss: number;
  overtimeMinutes: number; shootoutAttempts: number; quarterWins: number; semiWins: number; finalWins: number;
  minAge: number; maxRoster: number; minSkaters: number; maxSkaters: number; minGoalies: number; maxGoalies: number;
  playoffSkaterGames: number; playoffGoalieGames: number; schoolLimit: number; formerMasterLimit: number;
  registrationDeadline: string | null; transferLimit: number; rounds: number; noChecking: boolean;
}
export const FESTIVAL_RULES: Rules = {
  profile: 'festival', periods: 3, periodMinutes: 15, allowDraw: true,
  pointsWin: 2, pointsDraw: 1, pointsLoss: 0, pointsOvertimeLoss: 1,
  overtimeMinutes: 20, shootoutAttempts: 3, quarterWins: 2, semiWins: 2, finalWins: 4,
  minAge: 18, maxRoster: 30, minSkaters: 9, maxSkaters: 20, minGoalies: 1, maxGoalies: 2,
  playoffSkaterGames: 2, playoffGoalieGames: 1, schoolLimit: 2, formerMasterLimit: 2,
  registrationDeadline: null, transferLimit: 1, rounds: 2, noChecking: true,
};
export const STANDARD_RULES: Rules = {...FESTIVAL_RULES, profile: 'standard', periodMinutes: 20, allowDraw: false,
  overtimeMinutes: 5, quarterWins: 4, semiWins: 4, finalWins: 4, noChecking: false, schoolLimit: 30, formerMasterLimit: 30};
export interface RosterEntry { playerId: number; number: number; position: Position; captain: '' | 'C' | 'A'; played: boolean; }
export interface Goal { id: string; teamId: number; period: number; time: string; scorerId: number; assist1Id: number | null; assist2Id: number | null; situation: 'EV' | 'PP' | 'PP2' | 'SH' | 'SH2' | 'EN' | 'PS'; homeOnIce?:number[]; awayOnIce?:number[]; }
export interface Penalty { id: string; teamId: number; playerId: number | null; servedById?: number | null; kind?: 'minutes' | 'penalty_shot'; period: number; time: string; minutes: number; code: string; start?: string; end?: string; }
export interface GoalieShift { teamId: number; playerId: number | null; from: string; to: string; }
export interface ShootoutAttempt { teamId: number; playerId: number; goalieId: number; scored: boolean; }
export interface Protocol {
  timeBasis?: 'match' | 'period';
  detailLevel: 'full' | 'score_only'; homeRoster: RosterEntry[]; awayRoster: RosterEntry[];
  goals: Goal[]; penalties: Penalty[]; goalieShifts: GoalieShift[]; shootout: ShootoutAttempt[];
  resolution: 'regulation' | 'draw' | 'overtime' | 'shootout' | 'technical';
  manualHomeScore: number | null; manualAwayScore: number | null;
  technicalReason: string; notes: string; referee: string; spectators: number | null; sheet?:OfficialSheet;
}

// Optional sheet fields keep all previously published JSON protocols readable.
export interface TeamStaff { headCoach:string; coach:string; manager:string; representative:string; }
export interface OfficialSheet {
  matchNumber:string; city:string; startedAt:string; endedAt:string;
  homeStaff:TeamStaff; awayStaff:TeamStaff; officials:Record<string,string>;
  timeouts:{teamId:number;period:number;time:string}[];
  missedShots:{id:string;teamId:number;playerId:number;goalieId:number;period:number;time:string}[];
  disciplinaryNotes:string; matchNotes:string; injuryNotes:string; protestNotes:string;
}
const officialKeys=['referee2','linesman1','linesman2','timekeeper','announcer','penaltyHome','penaltyAway','scorekeeperHome','scorekeeperAway','goalJudge1','goalJudge2','reserveReferee','reserveLinesman','videoJudge','inspector','secretary','chiefReferee'];
function validateSheetShape(sheet:OfficialSheet):void {
  const object=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v);
  const text=(v:unknown,max=200)=>typeof v==='string'&&v.length<=max;
  ensure(object(sheet),'Некорректный бланк протокола');
  for(const key of ['matchNumber','city','startedAt','endedAt'] as const)ensure(text(sheet[key]),'Проверьте сведения о матче');
  for(const staff of [sheet.homeStaff,sheet.awayStaff]){
    ensure(object(staff),'Проверьте представителей команд');
    for(const key of ['headCoach','coach','manager','representative'] as const)ensure(text(staff[key]),'Слишком длинное имя представителя команды');
  }
  ensure(object(sheet.officials),'Проверьте судейскую бригаду');
  ensure(Object.keys(sheet.officials).every(key=>officialKeys.includes(key)),'Неизвестная должность в судейской бригаде');
  for(const value of Object.values(sheet.officials))ensure(text(value),'Слишком длинное имя судьи');
  for(const key of ['disciplinaryNotes','matchNotes','injuryNotes','protestNotes'] as const)ensure(text(sheet[key],5000),'Замечания не должны превышать 5000 символов');
  for(const key of ['timeouts','missedShots'] as const)ensure(Array.isArray(sheet[key])&&sheet[key].length<=100&&sheet[key].every(object),'Некорректный дополнительный раздел протокола');
}
function validateSheet(p:Protocol,match:MatchInput,rules:Rules,allowed:Map<number,Set<number>>):void {
  for(const goal of p.goals)for(const [teamId,list] of [[match.homeTeamId,goal.homeOnIce],[match.awayTeamId,goal.awayOnIce]] as const){
    if(list===undefined)continue;
    ensure(Array.isArray(list)&&list.length<=6&&new Set(list).size===list.length,'На льду у команды может быть не более шести разных игроков');
    const roster=teamId===match.homeTeamId?p.homeRoster:p.awayRoster;
    ensure(list.every(id=>allowed.get(teamId)?.has(id)&&roster.some(r=>r.playerId===id&&r.played)),'Игрок на льду отсутствует в составе или не участвовал');
  }
  if(!p.sheet)return;
  const s=p.sheet;
  const actual=(value:string)=>{
    if(value==='')return null;
    ensure(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),'Начало и окончание матча укажите датой и временем (МСК)');
    const date=new Date(value+'+03:00');
    ensure(Number.isFinite(+date)&&new Date(+date+3*3600000).toISOString().slice(0,16)===value,'Некорректная дата фактического времени матча');return +date;
  };
  const start=actual(s.startedAt),end=actual(s.endedAt);
  ensure(start===null||end===null||end>=start,'Окончание матча раньше его начала');
  const timed=(e:{teamId:number;period:number;time:string})=>{
    ensure(allowed.has(e.teamId),'Неизвестная команда в дополнительном разделе');
    const window=periodTimeWindow(e.period,rules),time=seconds(e.time,Infinity);
    // Additional sheet events always use elapsed match time, including legacy protocols.
    ensure(time>=window.start&&time<=window.end,`Время ${e.time} не соответствует периоду ${e.period}`);
    ensure(e.period<=rules.periods||['overtime','shootout'].includes(p.resolution),'Тайм-аут или штрафной бросок в ОТ требует соответствующего исхода');
  };
  for(const teamId of [match.homeTeamId,match.awayTeamId])ensure(s.timeouts.filter(t=>t.teamId===teamId).length<=1,'Команда может взять один тайм-аут за матч');
  for(const timeout of s.timeouts)timed(timeout);
  const ids=new Set([...p.goals,...p.penalties].map(e=>e.id));
  for(const shot of s.missedShots){
    ensure(typeof shot.id==='string'&&shot.id.length>0&&shot.id.length<=80&&!ids.has(shot.id),'Идентификатор штрафного броска повторяется');ids.add(shot.id);timed(shot);
    const own=shot.teamId===match.homeTeamId?p.homeRoster:p.awayRoster,other=shot.teamId===match.homeTeamId?p.awayRoster:p.homeRoster;
    ensure(own.some(r=>r.playerId===shot.playerId&&r.played),'Исполнитель штрафного броска не участвовал в матче');
    ensure(other.some(r=>r.playerId===shot.goalieId&&r.position==='G'&&r.played),'Укажите участвовавшего вратаря соперника для штрафного броска');
  }
  if(p.resolution==='technical')ensure(!s.missedShots.length&&!s.timeouts.length,'Технический результат не содержит игровых событий');
}

export interface Result { homeScore: number; awayScore: number; periodScores: {home: number; away: number; label: string}[]; resolution: Protocol['resolution']; winnerId: number | null; }
export interface MatchInput { homeTeamId: number; awayTeamId: number; stage: string; }
export interface TableMatch extends MatchInput { homeScore: number | null; awayScore: number | null; resolution: string | null; status: string; }
export interface Standing { teamId: number; name: string; color: string; abbreviation: string; played: number; wins: number; overtimeWins: number; shootoutWins:number; draws: number; losses: number; overtimeLosses: number; goalsFor: number; goalsAgainst: number; difference: number; points: number; form: string[]; position: number; tieNote: string; averageAge: number; }
export class DomainError extends Error {}
function ensure(value: unknown, message: string): asserts value { if (!value) throw new DomainError(message); }
export function ageOn(birth: string, date: string): number {
  const b = birth.slice(0, 10).split('-').map(Number), d = date.slice(0, 10).split('-').map(Number);
  return d[0] - b[0] - (d[1] < b[1] || (d[1] === b[1] && d[2] < b[2]) ? 1 : 0);
}
export function seconds(value: string, limit = 36000): number {
  ensure(typeof value === 'string' && /^\d{1,4}:\d{2}$/.test(value), 'Время укажите в формате ММ:СС');
  const [m,s] = value.split(':').map(Number);
  ensure(s < 60, 'Секунды укажите от 00 до 59');
  ensure(m * 60 + s <= limit, 'Время выходит за пределы периода'); return m * 60 + s;
}
export function periodTimeWindow(period:number,rules:Rules):{start:number;end:number} {
  ensure(Number.isInteger(period)&&period>=1&&period<=rules.periods+20,'Неверный номер периода');
  const duration=(period<=rules.periods?rules.periodMinutes:rules.overtimeMinutes)*60;
  const start=period<=rules.periods?(period-1)*duration:rules.periods*rules.periodMinutes*60+(period-rules.periods-1)*duration;
  return {start,end:start+duration};
}
function clock(value:number):string {return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;}

// Historical JSON has period-relative event times and no timeBasis field.
// Convert copies for reading; incomplete draft values remain editable.
export function protocolInMatchTime(p:Protocol,rules:Rules):Protocol {
  if(p.timeBasis==='match')return {...p};
  const convert=<T extends {period:number;time:string}>(event:T):T=>{
    try {
      const {start,end}=periodTimeWindow(event.period,rules);
      return {...event,time:clock(start+seconds(event.time,end-start))};
    }catch(error){if(!(error instanceof DomainError))throw error;return {...event};}
  };
  return {...p,timeBasis:'match',goals:p.goals.map(convert),penalties:p.penalties.map(convert)};
}

function protocolInPeriodTime(p:Protocol,rules:Rules):Protocol {
  if(p.timeBasis!=='match')return p;
  const convert=<T extends {period:number;time:string}>(event:T,label:string):T=>{
    try {
      const {start,end}=periodTimeWindow(event.period,rules),time=seconds(event.time,Infinity);
      ensure(time>=start&&time<=end,`Время ${event.time} не соответствует периоду ${event.period}. Допустимо ${clock(start)}–${clock(end)} от начала матча`);
      return {...event,time:clock(time-start)};
    }catch(error){if(!(error instanceof DomainError))throw error;throw new DomainError(`${label}: ${error.message}`);}
  };
  return {...p,timeBasis:'period',goals:p.goals.map((event,index)=>convert(event,`Гол №${index+1}`)),penalties:p.penalties.map((event,index)=>convert(event,`Удаление №${index+1}`))};
}

export function validateRules(input: Rules): Rules {
  ensure(input && typeof input === 'object', 'Правила не заполнены');
  const result = {...input};
  const bounds: Record<string,[number,number]> = {
    periods:[1,5],periodMinutes:[1,60],pointsWin:[0,10],pointsDraw:[0,10],pointsLoss:[0,10],pointsOvertimeLoss:[0,10],
    overtimeMinutes:[1,60],shootoutAttempts:[1,10],quarterWins:[1,4],semiWins:[1,4],finalWins:[1,4],minAge:[0,90],
    maxRoster:[1,60],minSkaters:[1,20],maxSkaters:[1,30],minGoalies:[0,3],maxGoalies:[1,4],
    playoffSkaterGames:[0,100],playoffGoalieGames:[0,100],schoolLimit:[0,60],formerMasterLimit:[0,60],transferLimit:[0,20],rounds:[1,4],
  };
  for (const [key,[min,max]] of Object.entries(bounds)) ensure(Number.isInteger((result as any)[key]) && (result as any)[key]>=min && (result as any)[key]<=max, `Недопустимое значение настройки ${key}`);
  ensure(['festival','standard','custom'].includes(result.profile), 'Неизвестный профиль правил');
  ensure(typeof result.allowDraw === 'boolean' && typeof result.noChecking === 'boolean', 'Неверный тип переключателя правил');
  ensure(result.minSkaters <= result.maxSkaters && result.minGoalies <= result.maxGoalies, 'Минимум состава превышает максимум');
  ensure(result.maxRoster >= result.minSkaters + result.minGoalies, 'Сезонная заявка меньше минимального состава матча');
  ensure(!result.registrationDeadline || /^\d{4}-\d{2}-\d{2}$/.test(result.registrationDeadline), 'Неверный срок дозаявок');
  return Object.fromEntries(Object.entries(result).filter(([key]) => key in FESTIVAL_RULES)) as unknown as Rules;
}
export function roundRobin(ids: number[], legs: number): {homeTeamId:number;awayTeamId:number;round:number}[] {
  ensure(ids.length >= 2 && new Set(ids).size === ids.length, 'Нужны минимум две разные команды');
  const rotation = [...ids]; if (rotation.length % 2) rotation.push(0);
  const base: {homeTeamId:number;awayTeamId:number;round:number}[] = [];
  for(let r=0;r<rotation.length-1;r++) {
    for(let i=0;i<rotation.length/2;i++) {
      const a=rotation[i], b=rotation[rotation.length-1-i]; if(!a||!b) continue;
      base.push({homeTeamId: r%2 ? b:a,awayTeamId:r%2?a:b,round:r+1});
    }
    rotation.splice(1,0,rotation.pop()!);
  }
  return Array.from({length:legs},(_,leg)=>base.map(m=>({homeTeamId:leg%2?m.awayTeamId:m.homeTeamId,awayTeamId:leg%2?m.homeTeamId:m.awayTeamId,round:m.round+leg*(rotation.length-1)}))).flat();
}
export function emptyProtocol(): Protocol {return {detailLevel:'full',homeRoster:[],awayRoster:[],goals:[],penalties:[],goalieShifts:[],shootout:[],resolution:'regulation',manualHomeScore:null,manualAwayScore:null,technicalReason:'',notes:'',referee:'',spectators:null};}
export function validateProtocolShape(p: Protocol): void {
  ensure(p && typeof p === 'object','Протокол не заполнен');
  for(const key of ['homeRoster','awayRoster','goals','penalties','goalieShifts','shootout']) ensure(Array.isArray((p as any)[key]) && (p as any)[key].length <= 500 && (p as any)[key].every((x:unknown)=>x&&typeof x==='object'&&!Array.isArray(x)), `Некорректный раздел ${key}`);
  if(p.sheet!==undefined)validateSheetShape(p.sheet);
  for(const goal of p.goals)for(const list of [goal.homeOnIce,goal.awayOnIce])if(list!==undefined)ensure(Array.isArray(list)&&list.length<=6&&list.every(id=>Number.isInteger(id)&&id>0),'Некорректный состав игроков на льду');
  ensure(p.timeBasis===undefined||['match','period'].includes(p.timeBasis),'Неизвестный формат времени протокола');
  ensure(['full','score_only'].includes(p.detailLevel),'Неизвестный режим протокола');
  ensure(['regulation','draw','overtime','shootout','technical'].includes(p.resolution),'Неизвестный исход матча');
  for(const text of [p.notes,p.referee,p.technicalReason]) ensure(typeof text==='string' && text.length <= 5000,'Текст протокола слишком длинный');
  ensure(p.spectators===null || Number.isInteger(p.spectators) && p.spectators>=0 && p.spectators<=1000000,'Неверное число зрителей');
}
export function resolveProtocol(p: Protocol, match: MatchInput, rules: Rules): Result {
  validateProtocolShape(p);
  p=protocolInPeriodTime(p,rules);
  const scores = Array.from({length:rules.periods},(_,i)=>({label:String(i+1),home:0,away:0}));
  const allowed = new Map<number,Set<number>>();
  ensure(match.homeTeamId !== match.awayTeamId,'Команда не может играть сама с собой');
  const allIds:number[]=[];
  for(const [teamId,roster] of [[match.homeTeamId,p.homeRoster],[match.awayTeamId,p.awayRoster]] as const) {
    const ids=roster.map(x=>x.playerId), numbers=roster.map(x=>x.number);
    ensure(ids.every(x=>Number.isInteger(x)&&x>0) && new Set(ids).size===ids.length,'Игрок повторяется в составе');
    ensure(numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=99) && new Set(numbers).size===numbers.length,'Номера должны быть уникальны: от 1 до 99');
    ensure(roster.every(x=>['G','D','F'].includes(x.position)&&['','C','A'].includes(x.captain)&&typeof x.played==='boolean'),'Проверьте амплуа и отметки состава');
    ensure(roster.filter(x=>x.captain==='C').length<=1 && roster.filter(x=>x.captain==='A').length<=2,'Допускается один капитан и два ассистента');
    if(p.resolution!=='technical'&&p.detailLevel==='full') {
      const goalies=roster.filter(x=>x.position==='G').length, skaters=roster.length-goalies;
      ensure(goalies>=rules.minGoalies && goalies<=rules.maxGoalies,`Вратарей должно быть от ${rules.minGoalies} до ${rules.maxGoalies}`);
      ensure(skaters>=rules.minSkaters && skaters<=rules.maxSkaters,`Полевых игроков должно быть от ${rules.minSkaters} до ${rules.maxSkaters}`);
    }
    allowed.set(teamId,new Set(ids)); allIds.push(...ids);
  }
  ensure(new Set(allIds).size===allIds.length,'Игрок не может быть в составах обеих команд');
  const member=(team:number,id:number|null)=>id!==null&&allowed.get(team)?.has(id);
  const played=(team:number,id:number)=> (team===match.homeTeamId?p.homeRoster:p.awayRoster).some(x=>x.playerId===id&&x.played);
  validateSheet(p,match,rules,allowed);
  const eventIds = [...p.goals,...p.penalties].map(x=>x.id);
  ensure(eventIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=80) && new Set(eventIds).size===eventIds.length,'Идентификаторы событий повторяются');
  if(p.resolution==='technical') {
    ensure(p.technicalReason.trim().length>=5,'Укажите причину технического результата');
    ensure(p.goals.length===0&&p.penalties.length===0&&p.shootout.length===0,'Технический результат вводится отдельно от событий матча');
  }
  for(const g of p.goals) {
    ensure(member(g.teamId,g.scorerId),'Автор гола отсутствует в составе команды');
    ensure(played(g.teamId,g.scorerId),'Автор гола не отмечен как участвовавший');
    const participants=[g.scorerId,g.assist1Id,g.assist2Id].filter((x): x is number=>x!==null);
    ensure(participants.every(x=>member(g.teamId,x)&&played(g.teamId,x)),'Ассистент отсутствует в составе или не участвовал');
    ensure(new Set(participants).size===participants.length,'Автор и ассистенты гола должны быть разными игроками');
    ensure(g.assist2Id===null||g.assist1Id!==null,'Укажите первого ассистента перед вторым');
    if(g.situation==='PS')ensure(g.assist1Id===null&&g.assist2Id===null,'У штрафного броска нет голевых передач');
    ensure(['EV','PP','PP2','SH','SH2','EN','PS'].includes(g.situation),'Неизвестная игровая ситуация');
    ensure(Number.isInteger(g.period)&&g.period>=1&&g.period<=rules.periods+20,'Неверный номер периода');
    seconds(g.time,(g.period>rules.periods?rules.overtimeMinutes:rules.periodMinutes)*60);
    while(scores.length<g.period) scores.push({label:`ОТ${scores.length-rules.periods+1}`,home:0,away:0});
    scores[g.period-1][g.teamId===match.homeTeamId?'home':'away']++;
  }
  for(const e of p.penalties) {
    ensure(allowed.has(e.teamId),'Штраф назначен неизвестной команде');
    ensure(e.playerId===null||member(e.teamId,e.playerId)&&played(e.teamId,e.playerId),'Оштрафованный игрок не участвовал в матче');
    ensure(e.servedById==null||member(e.teamId,e.servedById),'Отбывающий штраф отсутствует в составе');
    ensure(e.kind===undefined||['minutes','penalty_shot'].includes(e.kind),'Неизвестный вид штрафа');
    ensure(e.kind==='penalty_shot'?e.minutes===0:[2,4,5,10,20,25].includes(e.minutes),'Выберите допустимую длительность штрафа');
    ensure(typeof e.code==='string'&&e.code.trim().length>0&&e.code.length<=100,'Укажите нарушение');
    ensure(Number.isInteger(e.period)&&e.period>=1&&e.period<=rules.periods+20,'Неверный период штрафа');
    seconds(e.time,(e.period>rules.periods?rules.overtimeMinutes:rules.periodMinutes)*60);
    if(e.start) seconds(e.start); if(e.end) seconds(e.end);
    if(e.start&&e.end)ensure(seconds(e.end)>=seconds(e.start),'Окончание штрафа раньше начала');
  }
  const lastPeriod=Math.max(rules.periods,...p.goals.map(g=>g.period));
  const actualLength=rules.periods*rules.periodMinutes*60+(p.resolution==='shootout'?rules.overtimeMinutes*60:lastPeriod>rules.periods?(lastPeriod-rules.periods-1)*rules.overtimeMinutes*60+Math.max(0,...p.goals.filter(g=>g.period===lastPeriod).map(g=>seconds(g.time))):0);
  const intervals=new Map<number,{from:number;to:number}[]>();
  for(const s of p.goalieShifts) {
    ensure(allowed.has(s.teamId),'Неизвестная команда в интервалах вратарей');
    const roster=s.teamId===match.homeTeamId?p.homeRoster:p.awayRoster;
    ensure(s.playerId===null||roster.some(x=>x.playerId===s.playerId&&x.position==='G'&&x.played),'Вратарь отсутствует в составе или не участвовал');
    const from=seconds(s.from),to=seconds(s.to); ensure(to>from&&to<=actualLength,'Неверный интервал вратаря');
    const previous=intervals.get(s.teamId)||[]; ensure(!previous.some(x=>from<x.to&&to>x.from),'Интервалы вратарей одной команды пересекаются');
    intervals.set(s.teamId,[...previous,{from,to}]);
  }
  let home=scores.reduce((s,x)=>s+x.home,0),away=scores.reduce((s,x)=>s+x.away,0);
  if(p.detailLevel==='score_only'||p.resolution==='technical') {
    ensure(p.goals.length===0,'В режиме итогового счёта не должно быть событий голов');
    ensure(Number.isInteger(p.manualHomeScore)&&Number.isInteger(p.manualAwayScore)&&p.manualHomeScore!>=0&&p.manualAwayScore!>=0&&p.manualHomeScore!<=100&&p.manualAwayScore!<=100,'Укажите итоговый счёт от 0 до 100');
    home=p.manualHomeScore!;away=p.manualAwayScore!; scores.splice(0);
    if(p.resolution==='technical') ensure((home===5&&away===0)||(home===0&&away===5),'Технический результат первого профиля: 5:0 или 0:5');
  }
  const regulation=scores.slice(0,rules.periods).reduce((s,x)=>({home:s.home+x.home,away:s.away+x.away}),{home:0,away:0});
  if(p.resolution==='draw') ensure(match.stage==='regular'&&rules.allowDraw&&home===away,'Ничья не разрешена или счёт неравный');
  else if(p.resolution==='shootout') {
    ensure(!(rules.profile==='festival'&&match.stage==='regular'),'В регулярке фестиваля сохраняется ничья');
    ensure(match.stage==='regular','В плей-офф этого профиля победитель определяется в овертайме');
    ensure(p.detailLevel==='full'&&home===away,'До серии бросков счёт должен быть равным');
    let hs=0,as=0,hc=0,ac=0;
    for(const a of p.shootout) {
      ensure(a.teamId===match.homeTeamId||a.teamId===match.awayTeamId,'Неизвестная команда в серии бросков');
      ensure(member(a.teamId,a.playerId)&&played(a.teamId,a.playerId),'Исполнитель броска не участвовал в матче');
      const opponent=a.teamId===match.homeTeamId?p.awayRoster:p.homeRoster;
      ensure(opponent.some(x=>x.playerId===a.goalieId&&x.position==='G'&&x.played),'Укажите вратаря соперника');
      ensure(typeof a.scored==='boolean','Укажите результат броска');
      if(a.teamId===match.homeTeamId){hc++;if(a.scored)hs++;}else{ac++;if(a.scored)as++;}
    }
    ensure(Math.abs(hc-ac)<=1&&hc>0&&ac>0&&hs!==as,'Серия бросков не определила победителя');
    const n=rules.shootoutAttempts;
    ensure((hc>=n&&ac>=n&&hc===ac)||(hs>as+Math.max(0,n-ac))||(as>hs+Math.max(0,n-hc)),'Серия бросков ещё не завершена');
    if(hs>as)home++;else away++;
  } else {
    ensure(p.shootout.length===0,'Броски серии возможны только при исходе БП');
    ensure(home!==away,'Выберите ничью или способ определения победителя');
    if(p.resolution==='overtime'&&p.detailLevel==='full') {
      ensure(regulation.home===regulation.away,'Перед овертаймом счёт должен быть равным');
      ensure(scores.slice(rules.periods).reduce((s,x)=>s+x.home+x.away,0)===1,'Овертайм заканчивается первой шайбой');
    } else if(p.detailLevel==='full') ensure(scores.length<=rules.periods,'Гол в овертайме требует исхода ОТ');
  }
  if(match.stage!=='regular') ensure(home!==away,'Матч плей-офф должен определить победителя');
  if(match.stage==='regular'&&rules.profile==='festival') ensure(!['overtime','shootout'].includes(p.resolution),'Регулярка фестиваля не предусматривает ОТ и БП');
  return {homeScore:home,awayScore:away,periodScores:scores,resolution:p.resolution,winnerId:home===away?null:home>away?match.homeTeamId:match.awayTeamId};
}
export function calculateStandings(teams: {id:number;name:string;color:string;abbreviation:string;averageAge?:number}[], matches: TableMatch[], rules: Rules): Standing[] {
  const rows=new Map<number,Standing>(teams.map(t=>[t.id,{teamId:t.id,name:t.name,color:t.color,abbreviation:t.abbreviation,played:0,wins:0,overtimeWins:0,shootoutWins:0,draws:0,losses:0,overtimeLosses:0,goalsFor:0,goalsAgainst:0,difference:0,points:0,form:[],position:0,tieNote:'',averageAge:t.averageAge||0}]));
  const completed=matches.filter(m=>m.status==='completed'&&m.stage==='regular'&&m.homeScore!==null&&m.awayScore!==null);
  for(const m of completed) for(const home of [true,false]) {
    const r=rows.get(home?m.homeTeamId:m.awayTeamId); if(!r)continue;
    const own=(home?m.homeScore:m.awayScore)!,other=(home?m.awayScore:m.homeScore)!; const ot=['overtime','shootout'].includes(m.resolution||'');
    r.played++; r.goalsFor+=own;r.goalsAgainst+=other;r.difference=r.goalsFor-r.goalsAgainst;
    if(own>other){r.wins++;if(m.resolution==='overtime')r.overtimeWins++;if(m.resolution==='shootout')r.shootoutWins++;r.points+=rules.pointsWin;r.form.push('W');}
    else if(own===other){r.draws++;r.points+=rules.pointsDraw;r.form.push('D');}
    else {r.losses++;if(ot)r.overtimeLosses++;r.points+=ot?rules.pointsOvertimeLoss:rules.pointsLoss;r.form.push('L');}
    r.form=r.form.slice(-5);
  }
  function rank(group:Standing[],criterion:number):Standing[]{
    if(group.length<2)return group;
    const ids=new Set(group.map(r=>r.teamId));
    const mini=new Map(group.map(r=>[r.teamId,{points:0,wins:0,diff:0,goals:0}]));
    if(criterion>=1&&criterion<=4) for(const m of completed.filter(x=>ids.has(x.homeTeamId)&&ids.has(x.awayTeamId))) for(const home of [true,false]) {
      const v=mini.get(home?m.homeTeamId:m.awayTeamId)!;const a=(home?m.homeScore:m.awayScore)!,b=(home?m.awayScore:m.homeScore)!;
      v.points+=a>b?rules.pointsWin:a===b?rules.pointsDraw:['overtime','shootout'].includes(m.resolution||'')?rules.pointsOvertimeLoss:rules.pointsLoss;
      v.wins+=a>b?1:0;v.diff+=a-b;v.goals+=a;
    }
    const metric=(r:Standing):number=>rules.profile==='festival' ? [r.points,mini.get(r.teamId)!.points,mini.get(r.teamId)!.wins,mini.get(r.teamId)!.diff,mini.get(r.teamId)!.goals,r.wins,r.difference,r.goalsFor,r.averageAge][criterion] : [r.points,r.wins-r.overtimeWins-r.shootoutWins,r.overtimeWins,r.shootoutWins,r.difference,r.goalsFor][criterion];
    const max=rules.profile==='festival'?8:5;
    const partitions=new Map<number,Standing[]>(); for(const row of group){const v=metric(row);partitions.set(v,[...(partitions.get(v)||[]),row]);}
    const out:Standing[]=[];
    for(const [value,subset] of [...partitions].sort((a,b)=>b[0]-a[0])){
      if(criterion===max) {if(subset.length>1)subset.forEach(x=>x.tieNote='Равенство: требуется решение администратора');out.push(...subset.sort((a,b)=>a.teamId-b.teamId));}
      else out.push(...rank(subset,criterion+1));
    }
    return out;
  }
  return rank([...rows.values()],0).map((r,i)=>({...r,position:i+1}));
}
