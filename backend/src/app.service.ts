import {Injectable,BadRequestException,ForbiddenException,NotFoundException,ConflictException} from '@nestjs/common';
import {DataSource,EntityManager,In} from 'typeorm';
import {Community,Season,User,Assignment,Team,Player,Tournament,Registration,Series,Match,Revision,Audit,News} from './entities';
import {Actor,hashPassword} from './security';
import {Rules,Protocol,Role,FESTIVAL_RULES,STANDARD_RULES,DomainError,ageOn,calculateStandings,emptyProtocol,resolveProtocol,roundRobin,validateProtocolShape,validateRules,seconds} from './domain';

const name=(p:Player)=>`${p.lastName} ${p.firstName}${p.middleName?' '+p.middleName:''}`;
const text=(v:unknown,min=1,max=200)=>{if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new BadRequestException(`Текст должен содержать от ${min} до ${max} символов`);return v.trim();};
const number=(v:unknown,min=1,max=10000000)=>{if(!Number.isInteger(v)||(v as number)<min||(v as number)>max)throw new BadRequestException(`Требуется целое число от ${min} до ${max}`);return v as number;};
const ruleCheck=(fn:()=>any)=>{try{return fn();}catch(e){if(e instanceof DomainError)throw new BadRequestException(e.message);throw e;}};
const today=()=>new Date().toISOString().slice(0,10);

@Injectable() export class AppService {
  constructor(public db:DataSource){}
  async entity<T extends {id:number}>(type:new()=>T,id:number,manager=this.db.manager):Promise<T>{const item=await manager.findOneBy(type,{id} as any);if(!item)throw new NotFoundException('Запись не найдена');return item;}
  global(actor:Actor){if(!['superuser','community_admin'].includes(actor.role))throw new ForbiddenException('Нужны права администратора сообщества');}
  async scope(actor:Actor,tournamentId:number,admin=false,manager=this.db.manager){
    await this.entity(Tournament,tournamentId,manager);
    if(['superuser','community_admin'].includes(actor.role))return;
    if(admin&&actor.role!=='tournament_admin')throw new ForbiddenException('Нужны права администратора турнира');
    if(!await manager.existsBy(Assignment,{userId:actor.id,tournamentId}))throw new ForbiddenException('Вы не назначены на этот турнир');
  }
  async audit(actor:Actor|null,action:string,entity:string,entityId:number|null,tournamentId:number|null,details:any={},manager=this.db.manager){
    return manager.save(Audit,manager.create(Audit,{actorId:actor?.id??null,action,entity,entityId,tournamentId,details}));
  }
  async snapshot(actor?:Actor){
    const m=this.db.manager;
    const [community,seasons,allTournaments,teams,allPlayers,allRegs,matches,series,news]=await Promise.all([
      m.find(Community),m.find(Season,{order:{startsOn:'DESC'}}),m.find(Tournament,{order:{id:'ASC'}}),m.find(Team,{order:{name:'ASC'}}),m.find(Player,{order:{lastName:'ASC'}}),m.find(Registration,{where:{active:true}}),m.find(Match,{order:{startsAt:'ASC',id:'ASC'}}),m.find(Series,{order:{id:'ASC'}}),m.find(News,{where:actor?{}:{published:true},order:{createdAt:'DESC'}}),
    ]);
    let tournaments=allTournaments.filter(t=>actor||t.status!=='draft');
    if(actor&&!['superuser','community_admin'].includes(actor.role)){
      const assignments=await m.findBy(Assignment,{userId:actor.id});const ids=new Set(assignments.map(x=>x.tournamentId));tournaments=tournaments.filter(t=>ids.has(t.id));
    }
    const ids=new Set(tournaments.map(t=>t.id)); const registrations=allRegs.filter(r=>ids.has(r.tournamentId));
    const visibleMatches=matches.filter(x=>ids.has(x.tournamentId)&&x.status!=='cancelled');
    const revisions=visibleMatches.some(x=>x.protocolVersion>0)?await m.find(Revision,{where:visibleMatches.filter(x=>x.protocolVersion>0).map(x=>({matchId:x.id,version:x.protocolVersion}))}):[];
    const standings:Record<number,any[]>={};
    for(const t of tournaments){
      const members=teams.filter(x=>t.teamIds.includes(x.id)).map(team=>{const pids=new Set(registrations.filter(r=>r.tournamentId===t.id&&r.teamId===team.id).map(r=>r.playerId));const ages=allPlayers.filter(p=>pids.has(p.id)).map(p=>ageOn(p.birthDate,today()));return {...team,averageAge:ages.length?ages.reduce((a,b)=>a+b,0)/ages.length:0};});
      standings[t.id]=calculateStandings(members,visibleMatches.filter(x=>x.tournamentId===t.id) as any,t.rules);
    }
    const stats=this.statistics(revisions,visibleMatches,allPlayers);
    const players=allPlayers.filter(p=>!actor||['superuser','community_admin'].includes(actor.role)||registrations.some(r=>r.playerId===p.id)).map(p=>actor?{...p,name:name(p)}:{id:p.id,firstName:p.firstName,lastName:p.lastName,middleName:p.middleName,name:name(p),position:p.position,qualification:p.qualification,birthYear:p.birthDate.slice(0,4)});
    const placements:Record<number,{place:number;teamId:number}[]>={};
    for(const t of tournaments){const final=series.find(s=>s.tournamentId===t.id&&s.round==='final'&&s.winnerId);if(!final)continue;placements[t.id]=[{place:1,teamId:final.winnerId!},{place:2,teamId:(final.winnerId===final.team1Id?final.team2Id:final.team1Id)!}];const losers=series.filter(s=>s.tournamentId===t.id&&s.round==='semi'&&s.winnerId).map(s=>s.winnerId===s.team1Id?s.team2Id!:s.team1Id!);const ranking=t.qualificationSnapshot?.ranking||[];losers.sort((a,b)=>ranking.findIndex((x:any)=>x.teamId===a)-ranking.findIndex((x:any)=>x.teamId===b));if(losers.length)placements[t.id].push({place:3,teamId:losers[0]});}
    const response:any={community:community[0],demo:process.env.DEMO_SEED==='true',ruleProfiles:{festival:FESTIVAL_RULES,standard:STANDARD_RULES},seasons,tournaments,teams:actor?teams.filter(x=>['superuser','community_admin'].includes(actor.role)||tournaments.some(t=>t.teamIds.includes(x.id))):teams,players,registrations:registrations.map(r=>actor?r:{id:r.id,playerId:r.playerId,teamId:r.teamId,tournamentId:r.tournamentId,number:r.number,captain:r.captain}),matches:visibleMatches,series:series.filter(s=>ids.has(s.tournamentId)),standings,stats,placements,news,serverTime:new Date().toISOString()};
    if(actor){response.actor=actor;response.users=['superuser','community_admin'].includes(actor.role)?await m.find(User,{order:{id:'ASC'}}):[];response.assignments=['superuser','community_admin'].includes(actor.role)?await m.find(Assignment):[];}
    return response;
  }
  statistics(revisions:Revision[],matches:Match[],players:Player[]){
    const rows=new Map<string,any>(); const matchMap=new Map(matches.map(m=>[m.id,m]));const pmap=new Map(players.map(p=>[p.id,p]));
    const get=(playerId:number,teamId:number,tournamentId:number)=>{const key=`${tournamentId}:${teamId}:${playerId}`;if(!rows.has(key))rows.set(key,{playerId,teamId,tournamentId,name:name(pmap.get(playerId)!),position:pmap.get(playerId)!.position,games:0,goals:0,assists:0,points:0,penaltyMinutes:0,goalieSeconds:0,goalsAgainst:0,goalieTracked:false});return rows.get(key);};
    for(const rev of revisions){const match=matchMap.get(rev.matchId);if(!match||rev.protocol.resolution==='technical'||rev.protocol.detailLevel==='score_only')continue;const p=rev.protocol;
      for(const [team,roster] of [[match.homeTeamId,p.homeRoster],[match.awayTeamId,p.awayRoster]] as const)for(const r of roster)if(r.played){const row=get(r.playerId,team!,match.tournamentId);row.games++;row.name=rev.identities[r.playerId]?.name||row.name;}
      for(const goal of p.goals){get(goal.scorerId,goal.teamId,match.tournamentId).goals++;for(const id of [goal.assist1Id,goal.assist2Id])if(id)get(id,goal.teamId,match.tournamentId).assists++;}
      for(const pen of p.penalties)if(pen.playerId)get(pen.playerId,pen.teamId,match.tournamentId).penaltyMinutes+=pen.minutes;
      for(const shift of p.goalieShifts)if(shift.playerId){const row=get(shift.playerId,shift.teamId,match.tournamentId);row.goalieSeconds+=seconds(shift.to)-seconds(shift.from);row.goalieTracked=true;}
    }
    return [...rows.values()].map(r=>({...r,points:r.goals+r.assists})).sort((a,b)=>b.points-a.points||b.goals-a.goals||a.name.localeCompare(b.name,'ru'));
  }
  async community(actor:Actor,input:any){this.global(actor);const c=(await this.db.manager.find(Community))[0];Object.assign(c,{name:text(input.name),shortName:text(input.shortName,1,20),city:text(input.city),description:text(input.description,0,5000),email:text(input.email,0,200)});await this.db.manager.save(c);await this.audit(actor,'update','community',c.id,null);return c;}
  async tournament(actor:Actor,input:any,id?:number){
    if(id)await this.scope(actor,id,true);else this.global(actor);
    const rules=ruleCheck(()=>validateRules(input.rules));
    const t=id?await this.entity(Tournament,id):new Tournament();
    if(id&&t.status!=='draft'&&JSON.stringify(t.rules)!==JSON.stringify(rules))throw new ConflictException('Правила запущенного турнира зафиксированы. Создайте новый турнир с нужным профилем');
    const teamIds: number[]=input.teamIds;
    if(!Array.isArray(teamIds)||teamIds.length>64||new Set(teamIds).size!==teamIds.length)throw new BadRequestException('Проверьте список команд');
    for(const teamId of teamIds)await this.entity(Team,number(teamId));
    await this.entity(Season,number(input.seasonId));
    if(id&&await this.db.manager.existsBy(Match,{tournamentId:id})&&JSON.stringify([...t.teamIds].sort())!==JSON.stringify([...teamIds].sort()))throw new ConflictException('Нельзя менять участников после формирования календаря');
    Object.assign(t,{name:text(input.name),slug:text(input.slug,2,100),division:text(input.division,1,50),seasonId:input.seasonId,description:text(input.description||'',0,5000),rules,teamIds});
    if(!/^[a-z0-9-]+$/.test(t.slug))throw new BadRequestException('Адрес турнира: латинские буквы, цифры и дефисы');
    t.status=t.status||'draft';t.version=(t.version||0)+1;
    await this.db.manager.save(Tournament,t);await this.audit(actor,id?'update':'create','tournament',t.id,t.id,{rules});return t;
  }
  async season(actor:Actor,input:any){this.global(actor);if(!/^\d{4}-\d{2}-\d{2}$/.test(input.startsOn)||!/^\d{4}-\d{2}-\d{2}$/.test(input.endsOn)||input.endsOn<input.startsOn)throw new BadRequestException('Проверьте даты сезона');const s=await this.db.manager.save(Season,this.db.manager.create(Season,{name:text(input.name),startsOn:input.startsOn,endsOn:input.endsOn}));await this.audit(actor,'create','season',s.id,null);return s;}
  async team(actor:Actor,input:any,id?:number){
    if(!['superuser','community_admin'].includes(actor.role))await this.scope(actor,number(input.tournamentId));
    if(id)for(const t of await this.db.manager.find(Tournament))if(t.teamIds.includes(id))await this.scope(actor,t.id);
    if(!id&&input.tournamentId){const t=await this.entity(Tournament,number(input.tournamentId));if(t.status!=='draft')throw new ConflictException('Новые команды добавляются до запуска турнира');}
    const team=id?await this.entity(Team,id):new Team();
    if(!/^#[a-fA-F0-9]{6}$/.test(input.color))throw new BadRequestException('Некорректный цвет');
    Object.assign(team,{name:text(input.name),city:text(input.city),abbreviation:text(input.abbreviation,1,4),color:input.color,description:text(input.description||'',0,5000)});
    await this.db.manager.save(Team,team);
    if(!id&&input.tournamentId){const t=await this.entity(Tournament,number(input.tournamentId));if(t.status!=='draft')throw new ConflictException('Новые команды добавляются до запуска турнира');t.teamIds=[...t.teamIds,team.id];await this.db.manager.save(t);}
    await this.audit(actor,id?'update':'create','team',team.id,input.tournamentId||null);return team;
  }
  async player(actor:Actor,input:any,id?:number){
    if(input.tournamentId)await this.scope(actor,number(input.tournamentId));else this.global(actor);
    if(id)for(const r of await this.db.manager.findBy(Registration,{playerId:id,active:true}))await this.scope(actor,r.tournamentId);
    const p=id?await this.entity(Player,id):new Player();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)||Number.isNaN(Date.parse(input.birthDate))||new Date(input.birthDate).toISOString().slice(0,10)!==input.birthDate||input.birthDate>today()||input.birthDate<'1920-01-01')throw new BadRequestException('Проверьте дату рождения');
    if(!['G','D','F'].includes(input.position)||!['novice','amateur','school','former_master'].includes(input.qualification))throw new BadRequestException('Выберите амплуа и квалификацию');
    Object.assign(p,{firstName:text(input.firstName),lastName:text(input.lastName),middleName:text(input.middleName||'',0,100),birthDate:input.birthDate,position:input.position,qualification:input.qualification,insured:input.insured===true,medicallyCleared:input.medicallyCleared===true});
    await this.db.transaction(async m=>{await m.save(Player,p);if(!id&&input.registerAfter===true)await this.registration(actor,{tournamentId:input.tournamentId,teamId:input.teamId,playerId:p.id,number:input.number,captain:''},m);await this.audit(actor,id?'update':'create','player',p.id,input.tournamentId||null,{},m);});return p;
  }
  async registration(actor:Actor,input:any,manager?:EntityManager){
    const tid=number(input.tournamentId);await this.scope(actor,tid);
    const apply=async(m:EntityManager)=>{
      const t=await m.findOneOrFail(Tournament,{where:{id:tid},lock:{mode:'pessimistic_write'}});
      if(t.status==='completed'||t.qualificationSnapshot)throw new ConflictException('Составы зафиксированы после запуска плей-офф');
      if(t.rules.registrationDeadline&&today()>t.rules.registrationDeadline)throw new ConflictException('Срок дозаявок закончился');
      const teamId=number(input.teamId),playerId=number(input.playerId);if(!t.teamIds.includes(teamId))throw new BadRequestException('Команда не участвует в турнире');
      const player=await this.entity(Player,playerId,m);const regs=await m.findBy(Registration,{tournamentId:tid,active:true});
      const existing=regs.find(r=>r.playerId===playerId);
      if(existing&&existing.teamId!==teamId&&actor.role==='secretary')throw new ForbiddenException('Переход оформляет администратор турнира');
      if(existing&&existing.teamId!==teamId&&existing.transfers>=t.rules.transferLimit)throw new ConflictException('Лимит переходов исчерпан');
      const num=number(input.number,1,99);if(regs.some(r=>r.teamId===teamId&&r.number===num&&r.playerId!==playerId))throw new ConflictException('Этот номер уже занят');
      const captain=input.captain||'';if(!['','C','A'].includes(captain))throw new BadRequestException('Неверная роль капитана');
      const own=regs.filter(r=>r.teamId===teamId&&r.playerId!==playerId);
      if(own.length>=t.rules.maxRoster)throw new ConflictException('Сезонная заявка заполнена');
      if(captain&&own.filter(r=>r.captain===captain).length>=(captain==='C'?1:2))throw new ConflictException('Лимит капитанов или ассистентов достигнут');
      const season=await this.entity(Season,t.seasonId,m);this.playerEligibility(player,t,season.startsOn);
      const teamPlayers=await m.findBy(Player,{id:In(own.map(r=>r.playerId).length?own.map(r=>r.playerId):[0])});
      if(player.qualification==='school'&&teamPlayers.filter(p=>p.qualification==='school').length>=t.rules.schoolLimit)throw new ConflictException('Исчерпана квота спортшкольников');
      if(player.qualification==='former_master'&&teamPlayers.filter(p=>p.qualification==='former_master').length>=t.rules.formerMasterLimit)throw new ConflictException('Исчерпана квота бывших мастеров');
      let r=existing;
      if(r&&r.teamId!==teamId){r.active=false;await m.save(r);r=m.create(Registration,{transfers:r.transfers+1});}
      if(!r)r=m.create(Registration,{transfers:0});
      Object.assign(r,{tournamentId:tid,teamId,playerId,number:num,captain,active:true});await m.save(r);
      await this.audit(actor,existing&&existing.teamId!==teamId?'transfer':'register','registration',r.id,tid,{teamId,playerId},m);return r;
    };return manager?apply(manager):this.db.transaction(apply);
  }
  playerEligibility(p:Player,t:Tournament,date:string){
    const age=ageOn(p.birthDate,date);
    if(age<t.rules.minAge&&!(t.division==='40+'&&p.position==='G'&&p.qualification==='school'&&age>=36))throw new BadRequestException(`${name(p)}: возраст не соответствует дивизиону`);
    if(p.qualification==='former_master'&&age<46)throw new BadRequestException(`${name(p)}: статус мастера снимается с 46 лет`);
    if(t.rules.profile==='festival'&&t.division==='40+'&&p.qualification==='school'&&!(p.position==='G'&&age>=36))throw new BadRequestException(`${name(p)}: в 40+ спортшкольник допускается только вратарём от 36 лет`);
  }
  async removeRegistration(actor:Actor,id:number){const r=await this.entity(Registration,id);await this.scope(actor,r.tournamentId);const t=await this.entity(Tournament,r.tournamentId);if(t.qualificationSnapshot)throw new ConflictException('Заявки плей-офф зафиксированы');r.active=false;await this.db.manager.save(r);await this.audit(actor,'remove','registration',id,r.tournamentId);return {ok:true};}
  async generateSchedule(actor:Actor,id:number,input:any){await this.scope(actor,id,true);return this.db.transaction(async m=>{
    await m.findOneOrFail(Community,{where:{singleton:true},lock:{mode:'pessimistic_write'}});
    const t=await m.findOneOrFail(Tournament,{where:{id},lock:{mode:'pessimistic_write'}});
    if(await m.existsBy(Match,{tournamentId:id}))throw new ConflictException('Календарь уже существует');
    const pairs=ruleCheck(()=>roundRobin(t.teamIds,t.rules.rounds));const start=new Date(input.startsAt||'2026-11-14T12:00:00+03:00');if(Number.isNaN(+start))throw new BadRequestException('Неверная дата');
    const slot=number(input.slotMinutes||90,60,300),venue=text(input.venue||'Новое Поколение');
    for(let i=0;i<pairs.length;i++) {const pair=pairs[i];const date=new Date(+start+Math.floor(i/4)*7*86400000+(i%4)*slot*60000);await this.checkSlot(m,date,slot,venue,pair.homeTeamId,pair.awayTeamId);await m.save(Match,m.create(Match,{...pair,tournamentId:id,startsAt:date,venue,slotMinutes:slot,stage:'regular'}));}
    await this.audit(actor,'generate_schedule','tournament',id,id,{matches:pairs.length},m);return {count:pairs.length};
  });}
  async launch(actor:Actor,id:number){await this.scope(actor,id,true);return this.db.transaction(async m=>{
    const t=await m.findOneOrFail(Tournament,{where:{id},lock:{mode:'pessimistic_write'}});
    if(t.status!=='draft')throw new ConflictException('Турнир уже запущен');
    if(t.teamIds.length<2)throw new BadRequestException('Нужны минимум две команды');
    const matches=await m.findBy(Match,{tournamentId:id,stage:'regular'});if(matches.length!==roundRobin(t.teamIds,t.rules.rounds).length)throw new BadRequestException('Сначала сформируйте полный календарь');
    for(const match of matches)if(!match.startsAt||!match.venue)throw new BadRequestException('Назначьте даты и площадки всех матчей');
    t.status='active';t.version++;await m.save(t);await this.audit(actor,'launch','tournament',id,id,{},m);return t;
  });}
  scheduleSnapshot(match:Match){return {round:match.round,startsAt:match.startsAt?.toISOString()??null,venue:match.venue,slotMinutes:match.slotMinutes};}
  assertScheduleUnchanged(match:Match,expected:any){
    if(!expected||!(expected.startsAt===null||typeof expected.startsAt==='string')||typeof expected.venue!=='string'||!Number.isInteger(expected.slotMinutes))throw new BadRequestException('Передайте исходное расписание матча');
    if(expected.round!==undefined)number(expected.round,1,1000);
    const date=expected.startsAt===null?null:new Date(expected.startsAt);
    if(date&&Number.isNaN(+date))throw new BadRequestException('Некорректная исходная дата матча');
    if((date?.getTime()??null)!==(match.startsAt?.getTime()??null)||expected.venue!==match.venue||expected.slotMinutes!==match.slotMinutes||(expected.round!==undefined&&expected.round!==match.round))throw new ConflictException(`Расписание матча №${match.id} изменено в другом окне. Откройте календарь заново`);
  }
  async updateSchedule(actor:Actor,id:number,input:any){
    await this.scope(actor,id,true);
    if(!Array.isArray(input?.matches)||!input.matches.length||input.matches.length>500)throw new BadRequestException('Передайте от 1 до 500 изменений матчей');
    const ids=input.matches.map((row:any)=>number(row?.id));
    if(new Set(ids).size!==ids.length)throw new BadRequestException('Матч указан несколько раз');
    return this.db.transaction(async m=>{
      await m.findOneOrFail(Community,{where:{singleton:true},lock:{mode:'pessimistic_write'}});
      const tournament=await m.findOneOrFail(Tournament,{where:{id},lock:{mode:'pessimistic_write'}});
      if(!['draft','active'].includes(tournament.status))throw new ConflictException('Календарь завершённого турнира нельзя менять');
      const current=await m.getRepository(Match).createQueryBuilder('match').setLock('pessimistic_write').where('match.tournamentId=:id',{id}).andWhere('match.id IN (:...ids)',{ids}).orderBy('match.id','ASC').getMany();
      if(current.length!==ids.length)throw new BadRequestException('Все матчи должны принадлежать выбранному турниру');
      const before=new Map(current.map(match=>[match.id,this.scheduleSnapshot(match)]));
      const changes=input.matches.map((row:any)=>{
        const match=current.find(item=>item.id===row.id)!;
        if(match.status!=='scheduled')throw new ConflictException(`Матч №${match.id} уже завершён или отменён. Его расписание менять нельзя`);
        const round=row.round===undefined?match.round:number(row.round,1,1000);
        if(row.round!==undefined&&!Number.isInteger(row.expected?.round))throw new BadRequestException('Передайте исходный тур матча');
        this.assertScheduleUnchanged(match,row.expected);
        if(round!==match.round&&(match.stage!=='regular'||match.seriesId!==null))throw new ConflictException('Матчи плей-офф нельзя переносить в другую серию');
        if(!(row.startsAt===null||typeof row.startsAt==='string'&&row.startsAt.length>0))throw new BadRequestException('Укажите дату матча или null');
        const startsAt=row.startsAt===null?null:new Date(row.startsAt);
        if(startsAt&&Number.isNaN(+startsAt))throw new BadRequestException('Некорректная дата матча');
        return Object.assign(match,{round,startsAt,venue:text(row.venue),slotMinutes:number(row.slotMinutes,60,300)});
      }) as Match[];
      const changedIds=new Set(ids);
      const planned=[...(await m.find(Match,{where:{status:'scheduled'}})).filter(match=>!changedIds.has(match.id)),...changes];
      for(const match of changes)if(match.startsAt)await this.checkSlot(m,match.startsAt,match.slotMinutes,match.venue,match.homeTeamId,match.awayTeamId,match.id,planned);
      await m.save(Match,changes);
      for(const match of changes)await this.audit(actor,'reschedule','match',match.id,id,{before:before.get(match.id),after:this.scheduleSnapshot(match)},m);
      return {count:changes.length,matches:changes};
    });
  }
  async checkSlot(m:EntityManager,date:Date,slot:number,venue:string,home:number|null,away:number|null,exclude?:number,planned?:Match[]){
    const all=planned??await m.find(Match,{where:{status:'scheduled'}});
    const conflict=all.find(x=>x.id!==exclude&&x.startsAt&&+date<+new Date(x.startsAt)+x.slotMinutes*60000&&+date+slot*60000>+new Date(x.startsAt)&&(x.venue.toLowerCase()===venue.toLowerCase()||[x.homeTeamId,x.awayTeamId].some(id=>id!==null&&[home,away].includes(id))));
    if(conflict)throw new ConflictException(`Пересечение с матчем №${conflict.id}: площадка или команда занята`);
  }
  async scheduleMatch(actor:Actor,id:number,input:any){
    const match=await this.entity(Match,id);
    const result=await this.updateSchedule(actor,match.tournamentId,{matches:[{id,round:input?.round,startsAt:input?.startsAt||null,venue:input?.venue,slotMinutes:input?.slotMinutes??90,expected:input?.expected??(input?.round===undefined?this.scheduleSnapshot(match):undefined)}]});
    return result.matches[0];
  }
  async matchDetail(id:number,actor?:Actor){
    const match=await this.entity(Match,id);const t=await this.entity(Tournament,match.tournamentId);if(actor)await this.scope(actor,t.id);else if(t.status==='draft')throw new NotFoundException();
    const revisions=await this.db.manager.find(Revision,{where:{matchId:id},order:{version:'DESC'}});const latest=revisions.find(x=>x.version===match.protocolVersion);
    const payload:any={match,tournament:t,protocol:latest?.protocol||null,identities:latest?Object.fromEntries(Object.entries(latest.identities).map(([id,p])=>[id,actor?p:{name:p.name,position:p.position}])):{},history:actor?revisions.map(r=>({version:r.version,actorId:r.actorId,reason:r.reason,createdAt:r.createdAt})):[]};
    if(actor){const raw=await this.db.getRepository(Match).createQueryBuilder('m').addSelect('m.draft').where('m.id=:id',{id}).getOneOrFail();payload.draft=raw.draft;payload.draftVersion=raw.draftVersion;const regs=await this.db.manager.findBy(Registration,{tournamentId:t.id,active:true});const pids=regs.filter(r=>[match.homeTeamId,match.awayTeamId].includes(r.teamId)).map(r=>r.playerId);const players=await this.db.manager.findBy(Player,{id:In(pids.length?pids:[0])});payload.candidates=regs.filter(r=>pids.includes(r.playerId)).map(r=>({...r,player:{...players.find(p=>p.id===r.playerId),name:name(players.find(p=>p.id===r.playerId)!)}}));}
    return payload;
  }
  async saveProtocol(actor:Actor,id:number,input:any,publish:boolean){
    const match=await this.entity(Match,id);await this.scope(actor,match.tournamentId);
    return this.db.transaction(async m=>{
      const t=await m.findOneOrFail(Tournament,{where:{id:match.tournamentId},lock:{mode:'pessimistic_write'}});
      const current=await m.getRepository(Match).createQueryBuilder('m').addSelect('m.draft').setLock('pessimistic_write').where('m.id=:id',{id}).getOneOrFail();
      if(t.status==='draft'||current.status==='cancelled')throw new ConflictException('Матч недоступен для протокола');
      if(input.expectedDraftVersion!==current.draftVersion||input.expectedProtocolVersion!==current.protocolVersion)throw new ConflictException('Протокол изменён в другом окне. Обновите страницу');
      ruleCheck(()=>validateProtocolShape(input.protocol));const p=input.protocol as Protocol;
      if(!publish){current.draft=p;current.draftVersion++;await m.save(current);await this.audit(actor,'save_draft','match',id,t.id,{},m);return {draftVersion:current.draftVersion,protocolVersion:current.protocolVersion};}
      if(!current.homeTeamId||!current.awayTeamId)throw new BadRequestException('Участники матча ещё не определены');
      if(current.protocolVersion>0&&!input.reason?.trim())throw new BadRequestException('Для исправления укажите причину');
      if(current.stage==='regular'&&t.qualificationSnapshot&&current.protocolVersion>0)throw new ConflictException('Плей-офф уже сформирован. Пересмотр регулярки требует решения администратора');
      if(current.seriesId){const s=await this.entity(Series,current.seriesId,m);if(s.winnerId&&current.status!=='completed')throw new ConflictException('Серия уже завершена');
        const earlier=await m.findBy(Match,{seriesId:s.id});if(earlier.some(x=>x.gameNumber<current.gameNumber&&x.status!=='completed'))throw new ConflictException('Сначала опубликуйте предыдущие игры серии');}
      if(p.resolution==='technical'&&actor.role==='secretary')throw new ForbiddenException('Технический результат устанавливает администратор турнира');
      const result=ruleCheck(()=>resolveProtocol(p,{homeTeamId:current.homeTeamId!,awayTeamId:current.awayTeamId!,stage:current.stage},t.rules));
      const players=await m.find(Player);const identities:Revision['identities']={};const regs=await m.findBy(Registration,{tournamentId:t.id,active:true});
      const oldRevision=current.protocolVersion?await m.findOneBy(Revision,{matchId:id,version:current.protocolVersion}):null;
      for(const [teamId,roster] of [[current.homeTeamId,p.homeRoster],[current.awayTeamId,p.awayRoster]] as const)for(const entry of roster){
        const originalIds=new Set(oldRevision?(teamId===current.homeTeamId?oldRevision.protocol.homeRoster:oldRevision.protocol.awayRoster).map(x=>x.playerId):[]);
        const player=players.find(x=>x.id===entry.playerId);if(!player)throw new BadRequestException('Неизвестный игрок');
        if(!originalIds.has(player.id)&&!regs.some(r=>r.playerId===player.id&&r.teamId===teamId))throw new BadRequestException(`${name(player)} отсутствует в сезонной заявке команды`);
        if(!originalIds.has(player.id))this.playerEligibility(player,t,(current.startsAt||new Date()).toISOString().slice(0,10));
        identities[player.id]=oldRevision?.identities[player.id]||{name:name(player),birthDate:player.birthDate,position:player.position};
        if(entry.position!==identities[player.id].position)throw new BadRequestException(`${name(player)}: амплуа не совпадает с карточкой`);
        if(current.stage!=='regular'&&!originalIds.has(player.id)){
          const regular=await m.findBy(Match,{tournamentId:t.id,stage:'regular',status:'completed'});
          const versions=regular.length?await m.find(Revision,{where:regular.map(x=>({matchId:x.id,version:x.protocolVersion}))}):[];
          const games=versions.filter(v=>v.protocol.resolution!=='technical'&&[...v.protocol.homeRoster,...v.protocol.awayRoster].some(r=>r.playerId===player.id&&r.played)).length;
          const required=player.position==='G'?t.rules.playoffGoalieGames:t.rules.playoffSkaterGames;
          if(games<required)throw new BadRequestException(`${name(player)}: для плей-офф нужно ${required} игр, сыграно ${games}`);
        }
      }
      if(current.protocolVersion===0&&t.rules.profile==='festival')for(const teamId of [current.homeTeamId,current.awayTeamId]){
        const activeIds=new Set(regs.filter(r=>r.teamId===teamId).map(r=>r.playerId));const seasonPlayers=players.filter(x=>activeIds.has(x.id));
        if(seasonPlayers.filter(x=>x.qualification==='school').length>t.rules.schoolLimit)throw new BadRequestException('В сезонной заявке превышена квота спортшкольников');
        if(seasonPlayers.filter(x=>x.qualification==='former_master').length>t.rules.formerMasterLimit)throw new BadRequestException('В сезонной заявке превышена квота бывших мастеров');
      }
      const revision=m.create(Revision,{matchId:id,version:current.protocolVersion+1,actorId:actor.id,protocol:p,result,identities,reason:input.reason||''});
      await m.save(revision);Object.assign(current,result,{status:'completed',protocolVersion:revision.version,draft:null,draftVersion:current.draftVersion+1,publishedAt:new Date()});await m.save(current);
      if(current.seriesId)await this.recalculateSeries(m,current.seriesId);
      await this.audit(actor,current.protocolVersion>1?'correct_protocol':'publish_protocol','match',id,t.id,{version:revision.version,reason:revision.reason,result},m);
      return {draftVersion:current.draftVersion,protocolVersion:current.protocolVersion,result};
    });
  }
  async startPlayoff(actor:Actor,id:number,size:number){await this.scope(actor,id,true);number(size,2,8);if(![2,4,8].includes(size))throw new BadRequestException('Размер сетки: 2, 4 или 8');
    const snapshot=await this.snapshot(actor);const ranking=snapshot.standings[id];
    return this.db.transaction(async m=>{const t=await m.findOneOrFail(Tournament,{where:{id},lock:{mode:'pessimistic_write'}});
      if(t.status!=='active'||t.qualificationSnapshot)throw new ConflictException('Плей-офф уже создан или турнир не запущен');
      if(await m.existsBy(Match,{tournamentId:id,stage:'regular',status:'scheduled'}))throw new ConflictException('Сначала завершите все матчи регулярного этапа');
      if(ranking.length<size)throw new BadRequestException('Недостаточно команд для сетки');
      if(ranking.slice(0,size).some((r:any)=>r.tieNote))throw new ConflictException('Есть равенство команд. Измените настройку посева после решения администратора');
      const final=await m.save(Series,m.create(Series,{tournamentId:id,round:'final',position:1,winsRequired:t.rules.finalWins}));
      if(size===2){final.team1Id=ranking[0].teamId;final.team2Id=ranking[1].teamId;await m.save(final);await this.ensureSeriesMatches(m,final);}
      else{
        const semis=[];for(let i=0;i<2;i++)semis.push(await m.save(Series,m.create(Series,{tournamentId:id,round:'semi',position:i+1,winsRequired:t.rules.semiWins,nextSeriesId:final.id,nextSlot:i+1})));
        if(size===4){for(const [i,pair] of [[0,[0,3]],[1,[1,2]]] as const){semis[i].team1Id=ranking[pair[0]].teamId;semis[i].team2Id=ranking[pair[1]].teamId;await m.save(semis[i]);await this.ensureSeriesMatches(m,semis[i]);}}
        else {const pairs=[[0,7],[3,4],[1,6],[2,5]];for(let i=0;i<4;i++){const s=await m.save(Series,m.create(Series,{tournamentId:id,round:'quarter',position:i+1,winsRequired:t.rules.quarterWins,team1Id:ranking[pairs[i][0]].teamId,team2Id:ranking[pairs[i][1]].teamId,nextSeriesId:semis[Math.floor(i/2)].id,nextSlot:i%2+1}));await this.ensureSeriesMatches(m,s);}}
      }
      t.qualificationSnapshot={createdAt:new Date().toISOString(),ranking:ranking.map((r:any)=>({teamId:r.teamId,position:r.position,points:r.points})),size};await m.save(t);await this.audit(actor,'start_playoff','tournament',id,id,{size},m);return {ok:true};
    });
  }
  async ensureSeriesMatches(m:EntityManager,s:Series){if(!s.team1Id||!s.team2Id)return;for(let i=1;i<=s.winsRequired*2-1;i++){if(await m.existsBy(Match,{seriesId:s.id,gameNumber:i}))continue;const swap=[3,4,6].includes(i);await m.save(Match,m.create(Match,{tournamentId:s.tournamentId,homeTeamId:swap?s.team2Id:s.team1Id,awayTeamId:swap?s.team1Id:s.team2Id,stage:s.round,round:s.position,seriesId:s.id,gameNumber:i,venue:'Новое Поколение'}));}s.status='active';await m.save(s);}
  async recalculateSeries(m:EntityManager,id:number){const s=await this.entity(Series,id,m);const matches=await m.find(Match,{where:{seriesId:id},order:{gameNumber:'ASC'}});s.wins1=matches.filter(x=>x.status==='completed'&&x.winnerId===s.team1Id).length;s.wins2=matches.filter(x=>x.status==='completed'&&x.winnerId===s.team2Id).length;const winner=s.wins1>=s.winsRequired?s.team1Id:s.wins2>=s.winsRequired?s.team2Id:null;
    if(s.nextSeriesId&&winner!==s.winnerId){const downstream=await m.findBy(Match,{seriesId:s.nextSeriesId});if(downstream.some(x=>x.protocolVersion>0||x.draftVersion>0))throw new ConflictException('Следующая серия уже начата. Требуется отдельный пересмотр администратором');}
    if(winner&&matches.filter(x=>x.status==='completed').length>s.winsRequired*2-1)throw new BadRequestException('Слишком много матчей серии');
    s.winnerId=winner;s.status=winner?'completed':'active';await m.save(s);
    if(winner)for(const match of matches.filter(x=>x.status==='scheduled')){match.status='cancelled';await m.save(match);}
    else for(const match of matches.filter(x=>x.status==='cancelled'&&x.protocolVersion===0)){match.status='scheduled';await m.save(match);}
    if(s.nextSeriesId){const next=await this.entity(Series,s.nextSeriesId,m);if(s.nextSlot===1)next.team1Id=winner;else next.team2Id=winner;await m.save(next);await this.ensureSeriesMatches(m,next);}
    if(s.round==='final'){const t=await this.entity(Tournament,s.tournamentId,m);t.status=winner?'completed':'active';await m.save(t);}
  }
  async users(actor:Actor,input:any,id?:number){this.global(actor);const roles:Role[]=['superuser','community_admin','tournament_admin','secretary'];if(!roles.includes(input.role)||actor.role!=='superuser'&&['superuser','community_admin'].includes(input.role))throw new ForbiddenException('Нельзя назначить эту роль');
    const u=id?await this.entity(User,id):new User();if(id&&(u.role==='superuser'||u.role==='community_admin')&&actor.role!=='superuser')throw new ForbiddenException();if(id===actor.id&&(input.active===false||input.role!==actor.role))throw new BadRequestException('Нельзя отключить или понизить собственную учётную запись');
    if(id&&u.role==='superuser'&&(input.role!=='superuser'||input.active===false)&&await this.db.manager.countBy(User,{role:'superuser',active:true})<=1)throw new ConflictException('Нельзя отключить последнего суперпользователя');
    const username=text(input.username,3,60).toLowerCase();if(!/^[a-z0-9._-]+$/.test(username))throw new BadRequestException('Логин: латинские буквы, цифры, точка, дефис');
    const password=input.password;if(!id||password){if(typeof password!=='string'||password.length<10||password.length>128)throw new BadRequestException('Пароль: от 10 до 128 символов');u.passwordHash=hashPassword(password);}
    Object.assign(u,{username,displayName:text(input.displayName),role:input.role,active:input.active!==false});
    const tids=input.tournamentIds||[];if(!Array.isArray(tids)||tids.length>100)throw new BadRequestException('Неверные назначения');for(const tid of tids)await this.entity(Tournament,number(tid));
    await this.db.transaction(async m=>{await m.save(User,u);await m.delete(Assignment,{userId:u.id});for(const tid of new Set<number>(tids))await m.save(Assignment,m.create(Assignment,{userId:u.id,tournamentId:tid}));await this.audit(actor,id?'update':'create','user',u.id,null,{role:u.role,assignments:tids},m);});
    return {id:u.id,username:u.username,displayName:u.displayName,role:u.role,active:u.active};
  }
  async auditLog(actor:Actor){const ids=['superuser','community_admin'].includes(actor.role)?null:(await this.db.manager.findBy(Assignment,{userId:actor.id})).map(a=>a.tournamentId);return this.db.manager.find(Audit,{where:ids?{tournamentId:In(ids.length?ids:[0])}:{},order:{id:'DESC'},take:150});}
  async staff(actor:Actor,id:number,secretaryIds?:number[]){await this.scope(actor,id,true);const users=await this.db.manager.findBy(User,{role:'secretary',active:true});
    if(secretaryIds!==undefined){if(!Array.isArray(secretaryIds)||secretaryIds.length>100||secretaryIds.some(n=>!users.some(u=>u.id===n)))throw new BadRequestException('Выберите действующих секретарей');
      await this.db.transaction(async m=>{await m.findOneOrFail(Tournament,{where:{id},lock:{mode:'pessimistic_write'}});const assignments=await m.findBy(Assignment,{tournamentId:id});const allSecretaries=await m.findBy(User,{role:'secretary'});for(const a of assignments)if(allSecretaries.some(u=>u.id===a.userId))await m.remove(a);for(const userId of new Set(secretaryIds))await m.save(Assignment,m.create(Assignment,{userId,tournamentId:id}));await this.audit(actor,'assign_staff','tournament',id,id,{secretaryIds},m);});
    }
    const assigned=await this.db.manager.findBy(Assignment,{tournamentId:id});return {secretaries:users.map(u=>({id:u.id,displayName:u.displayName,username:u.username})),secretaryIds:assigned.filter(a=>users.some(u=>u.id===a.userId)).map(a=>a.userId)};
  }
  async saveNews(actor:Actor,input:any,id?:number){this.global(actor);const n=id?await this.entity(News,id):new News();Object.assign(n,{title:text(input.title,3,200),body:text(input.body,10,20000),category:text(input.category||'Сообщество',1,50),published:input.published!==false});await this.db.manager.save(News,n);await this.audit(actor,id?'update':'create','news',n.id,null);return n;}
}
