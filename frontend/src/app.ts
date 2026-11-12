import {Component,HostListener,OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {trackPageView} from './analytics';
import {createScheduleRows,scheduleGroups,nearestScheduleGroup,scheduleRowsInGroup,changedScheduleRows,scheduleChanges,applyScheduleBulk} from './schedule-editor';
import {listPublicMatches,sortMatches,upcomingActiveMatches,recentTournamentResults} from './match-calendar';
import {Router,RouterLink,RouterOutlet,NavigationEnd} from '@angular/router';

@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,RouterLink,RouterOutlet],templateUrl:'./app.html'})
export class AppComponent implements OnInit {
  data:any=null;work:any=null;actor:any=null;loading=true;busy=false;error='';notice='';route='';section='';entityId=0;
  tournamentId=Number(localStorage.getItem('hockey_tournament')||1);search='';statusFilter='all';positionFilter='all';teamFilter=0;
  seasonId=0;
  modal='';form:any={};audit:any[]=[];detail:any=null;protocol:any=null;draftVersion=0;protocolVersion=0;dirty=false;revisionReason='';protocolTab='rosters';
  roles:any={superuser:'Суперпользователь',community_admin:'Администратор сообщества',tournament_admin:'Администратор турнира',secretary:'Секретарь'};
  positions:any={G:'Вратарь',D:'Защитник',F:'Нападающий'};
  qualifications:any={novice:'Новичок',amateur:'Любитель',school:'Спортшкольник',former_master:'Бывший мастер'};
  outcomes:any={regulation:'Основное время',draw:'Ничья',overtime:'Овертайм',shootout:'Буллиты',technical:'Технический результат'};
  actions:any={publish_protocol:'Опубликован протокол',correct_protocol:'Исправлен протокол',save_draft:'Сохранён черновик',register:'Игрок заявлен',transfer:'Переход игрока',generate_schedule:'Создан календарь',launch:'Турнир запущен',start_playoff:'Запущен плей-офф',reschedule:'Перенос матча',create:'Создана запись',update:'Изменена запись',remove:'Удалён из заявки',login:'Вход в кабинет',demo_seed:'Демонстрационное наполнение'};
  ruleFields=[['periods','Периодов'],['periodMinutes','Минут в периоде'],['pointsWin','Очков за победу'],['pointsDraw','Очков за ничью'],['pointsLoss','За поражение'],['pointsOvertimeLoss','За поражение в ОТ/БП'],['rounds','Кругов регулярки'],['overtimeMinutes','Минут в овертайме'],['shootoutAttempts','Бросков в серии'],['quarterWins','Побед в ¼ финала'],['semiWins','Побед в ½ финала'],['finalWins','Побед в финале'],['minAge','Минимальный возраст'],['maxRoster','Игроков в сезонной заявке'],['minSkaters','Минимум полевых на матч'],['maxSkaters','Максимум полевых'],['minGoalies','Минимум вратарей'],['maxGoalies','Максимум вратарей'],['schoolLimit','Квота спортшкольников'],['formerMasterLimit','Квота бывших мастеров'],['playoffSkaterGames','Игр для допуска полевого в ПО'],['playoffGoalieGames','Игр для допуска вратаря в ПО'],['transferLimit','Переходов за сезон']];
  nav=[{path:'/',label:'Главная'},{path:'/tournaments',label:'Турниры'},{path:'/calendar',label:'Календарь'},{path:'/teams',label:'Команды'},{path:'/players',label:'Статистика'},{path:'/news',label:'Новости'}];
  constructor(public router:Router){router.events.subscribe(async e=>{if(e instanceof NavigationEnd){trackPageView(e.urlAfterRedirects);this.readRoute();if(this.section==='protocol'&&this.actor)await this.loadProtocol();else if(this.route==='matches')await this.loadPublicMatch();else if(this.section==='audit'&&this.actor)await this.loadAudit();}});}
  async ngOnInit(){this.readRoute();await this.refresh();if(this.section==='protocol'&&this.actor)await this.loadProtocol();if(this.route==='matches')await this.loadPublicMatch();}
  @HostListener('window:beforeunload',['$event']) unload(e:BeforeUnloadEvent){if(this.hasUnsavedChanges){e.preventDefault();e.returnValue='';}}
  readRoute(){const bits=this.router.url.split('?')[0].split('/').filter(Boolean);this.route=bits[0]||'home';this.section=this.route==='office'?(bits[1]||'overview'):'';this.entityId=Number(bits[this.route==='office'?2:1]||0);if(this.route==='tournaments'&&this.entityId)this.selectTournament(this.entityId);this.search='';this.statusFilter='all';this.teamFilter=0;this.error='';this.detail=null;}
  get isOffice(){return this.route==='office';}
  get current(){return this.isOffice&&this.work?this.work:this.data;}
  get tournaments(){return (this.current?.tournaments||[]).filter((t:any)=>this.isOffice||!this.seasonId||t.seasonId===this.seasonId);}
  get seasonName(){return this.data?.seasons.find((s:any)=>s.id===this.tournament?.seasonId)?.name||'2026 / 2027';}
  get winners(){return this.current?.placements?.[this.tournament?.id]||[];}
  selectSeason(id:number){this.seasonId=Number(id);const first=this.tournaments[0];if(first)this.selectTournament(first.id);}
  profileChanged(profile:string){if(this.data.ruleProfiles?.[profile])this.form.rules=structuredClone(this.data.ruleProfiles[profile]);else this.form.rules.profile='custom';}
  get tournament():any{return this.tournaments.find((x:any)=>x.id===this.tournamentId)||this.tournaments[0];}
  get canAdmin(){return this.actor&&this.actor.role!=='secretary';}
  get canGlobal(){return this.actor&&['superuser','community_admin'].includes(this.actor.role);}
  get standings(){return this.current?.standings[this.tournament?.id]||[];}
  get matches():any[]{return (this.current?.matches||[]).filter((m:any)=>m.tournamentId===this.tournament?.id);}
  get publicMatches():any[]{return listPublicMatches(this.data?.matches||[],this.data?.tournaments||[],this.seasonId);}
  get matchFeed():any[]{return !this.isOffice&&['home','calendar'].includes(this.route)?this.publicMatches:this.matches;}
  get filteredMatches(){return sortMatches(this.matchFeed.filter(m=>(this.statusFilter==='all'||m.status===this.statusFilter)&&(!this.teamFilter||[m.homeTeamId,m.awayTeamId].includes(this.teamFilter))&&`${this.teamName(m.homeTeamId)} ${this.teamName(m.awayTeamId)} ${m.venue} ${this.tournamentName(m.tournamentId)}`.toLowerCase().includes(this.search.toLowerCase())));}
  get upcoming(){return this.isOffice?sortMatches(this.matches.filter(m=>m.status==='scheduled'&&m.startsAt)).slice(0,4):upcomingActiveMatches(this.data?.matches||[],this.data?.tournaments||[]);}
  get results():any[]{return recentTournamentResults(this.current?.matches||[],this.tournament?.id);}
  get calendarTeams(){const ids=new Set(this.publicMatches.flatMap(m=>[m.homeTeamId,m.awayTeamId]));return (this.data?.teams||[]).filter((t:any)=>ids.has(t.id));}
  get tournamentTeams(){return (this.current?.teams||[]).filter((t:any)=>this.tournament?.teamIds.includes(t.id));}
  get filteredTeams(){return (this.isOffice&&this.canGlobal?this.work?.teams||[]:this.tournamentTeams).filter((t:any)=>t.name.toLowerCase().includes(this.search.toLowerCase()));}
  nextNumber(teamId:number){const used=new Set((this.work?.registrations||[]).filter((r:any)=>r.teamId===teamId&&r.tournamentId===this.tournament?.id).map((r:any)=>r.number));for(let i=1;i<=99;i++)if(!used.has(i))return i;return 99;}
  get team(){return (this.current?.teams||[]).find((t:any)=>t.id===this.entityId);}
  get player(){return (this.current?.players||[]).find((p:any)=>p.id===this.entityId);}
  get tournamentStats(){return (this.current?.stats||[]).filter((s:any)=>s.tournamentId===this.tournament?.id);}
  get leaders(){return this.tournamentStats.slice(0,4);}
  get stats(){return this.tournamentStats.filter((s:any)=>(!this.teamFilter||s.teamId===this.teamFilter)&&(this.positionFilter==='all'||s.position===this.positionFilter)&&s.name.toLowerCase().includes(this.search.toLowerCase()));}
  get players(){const regs=this.current?.registrations||[];return (this.current?.players||[]).filter((p:any)=>regs.some((r:any)=>r.playerId===p.id&&r.tournamentId===this.tournament?.id&&(!this.teamFilter||r.teamId===this.teamFilter))&&p.name.toLowerCase().includes(this.search.toLowerCase())&&(this.positionFilter==='all'||p.position===this.positionFilter));}
  get totalGoals(){return this.matches.filter(m=>m.status==='completed').reduce((s,m)=>s+(m.homeScore||0)+(m.awayScore||0),0);}
  get completed(){return this.matches.filter(m=>m.status==='completed').length;}
  get series(){return (this.current?.series||[]).filter((s:any)=>s.tournamentId===this.tournament?.id);}
  get title(){return ({overview:'Обзор турнира',matches:'Матчи и протоколы',teams:'Команды и составы',players:'Хоккеисты',tournaments:'Управление турнирами',users:'Пользователи и доступ',audit:'Журнал изменений',settings:'Настройки сообщества',news:'Новости',protocol:'Протокол матча'} as any)[this.section]||'Кабинет';}
  async request(path:string,method='GET',body?:any):Promise<any>{const response=await fetch('/api/'+path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Не удалось выполнить запрос');return data;}
  async refresh(){try{this.data=await this.request('public');try{this.actor=await this.request('auth/me');this.work=await this.request('workspace');}catch{this.actor=null;this.work=null;}if(this.tournaments.length&&!this.tournaments.some((t:any)=>t.id===this.tournamentId))this.tournamentId=this.tournaments[0].id;}catch(e:any){this.error=e.message;}finally{this.loading=false;}}
  selectTournament(id:number){this.tournamentId=Number(id);localStorage.setItem('hockey_tournament',String(id));this.teamFilter=0;}
  teamById(id:number|null){return (this.data?.teams||[]).find((t:any)=>t.id===id)||{name:'Участник не определён',abbreviation:'—',color:'#657d84'};}
  tournamentName(id:number){return this.data?.tournaments?.find((t:any)=>t.id===id)?.name||'Турнир';}
  teamName(id:number|null){return this.teamById(id).name;}
  playerName(id:number){return this.detail?.identities?.[id]?.name||(this.current?.players||[]).find((p:any)=>p.id===id)?.name||'—';}
  playerRegistration(id:number){return (this.current?.registrations||[]).find((r:any)=>r.playerId===id&&r.tournamentId===this.tournament?.id);}
  teamRoster(id:number){return (this.current?.registrations||[]).filter((r:any)=>r.teamId===id&&r.tournamentId===this.tournament?.id).map((r:any)=>({...r,player:(this.current?.players||[]).find((p:any)=>p.id===r.playerId)}));}
  teamStats(id:number){return this.standings.find((r:any)=>r.teamId===id);}
  date(v:any,options:Intl.DateTimeFormatOptions={day:'numeric',month:'long'}){return v?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',...options}).format(new Date(v)):'Дата уточняется';}
  time(v:any){return v?this.date(v,{hour:'2-digit',minute:'2-digit'}):'—';}
  dateTimeInput(v:any){if(!v)return '';return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v)).replace(' ','T');}
  score(m:any){return m.status==='completed'?`${m.homeScore} : ${m.awayScore}`:this.time(m.startsAt);}
  outcome(m:any){return m.resolution==='overtime'?'ОТ':m.resolution==='shootout'?'БП':m.resolution==='technical'?'ТП':'';}
  async run(task:()=>Promise<any>,message='Изменения сохранены'){if(this.busy)return;this.busy=true;this.error='';try{await task();this.notice=message;setTimeout(()=>this.notice='',4500);}catch(e:any){this.error=e.message;}finally{this.busy=false;}}
  async logout(){await this.run(async()=>{await this.request('auth/logout','POST',{});this.actor=null;this.work=null;this.router.navigateByUrl('/');},'Вы вышли из кабинета');}
  login(){this.modal='login';this.form={username:'',password:''};this.error='';}
  get calendarGroups(){return scheduleGroups(this.form.rows||[]);}
  get calendarRows(){return scheduleRowsInGroup(this.form.rows||[],this.form.groupKey);}
  get calendarChangeCount(){return changedScheduleRows(this.form.rows||[]).length;}
  get hasUnsavedChanges(){return this.dirty||(this.modal==='calendar'&&this.calendarChangeCount>0);}
  hasTournamentMatches(id:number){return (this.work?.matches||[]).some((match:any)=>match.tournamentId===id);}
  hasEditableSchedule(id=this.tournament?.id){const tournament=this.work?.tournaments.find((t:any)=>t.id===id);return !!tournament&&['draft','active'].includes(tournament.status)&&(this.work?.matches||[]).some((match:any)=>match.tournamentId===id&&match.status==='scheduled');}
  async editCalendar(item?:any){await this.run(async()=>{
    const id=item?.id||this.tournament?.id;if(!id)throw new Error('Выберите турнир');
    this.work=await this.request('workspace');
    const tournament=this.work.tournaments.find((t:any)=>t.id===id);
    if(!tournament||!this.hasEditableSchedule(id))throw new Error('В турнире нет матчей, доступных для изменения расписания');
    const rows=createScheduleRows(sortMatches(this.work.matches.filter((match:any)=>match.tournamentId===id)));
    this.form={tournamentId:id,tournamentName:tournament.name,rows,groupKey:nearestScheduleGroup(rows),bulkDate:'',bulkVenue:''};
    this.modal='calendar';
  },'');}
  applyCalendarBulk(){try{applyScheduleBulk(this.form.rows,this.form.groupKey,this.form.bulkDate,this.form.bulkVenue);this.error='';}catch(error:any){this.error=error.message;}}
  closeModal(){if(this.busy)return;if(this.modal==='calendar'&&this.calendarChangeCount&&!confirm('Есть несохранённые изменения календаря. Закрыть без сохранения?'))return;this.modal='';this.error='';}
  open(kind:string,item?:any){if(kind==='calendar'){void this.editCalendar(item);return;}this.error='';this.modal=kind;const t=this.tournament;
    if(kind==='team')this.form=item?{...item,tournamentId:t?.id}:{name:'',city:'Чебоксары',abbreviation:'',color:'#1f5970',description:'',tournamentId:t?.status==='draft'?t.id:null};
    else if(kind==='player')this.form=item?{...item,tournamentId:t?.id}:{firstName:'',lastName:'',middleName:'',birthDate:'',position:'F',qualification:'amateur',insured:false,medicallyCleared:false,tournamentId:t?.id,teamId:this.teamFilter||this.tournamentTeams[0]?.id,number:1,registerAfter:true};
    else if(kind==='registration')this.form={tournamentId:t.id,teamId:this.teamFilter||this.tournamentTeams[0]?.id,playerId:item?.id||this.work.players[0]?.id,number:1,captain:''};
    else if(kind==='tournament'){const rules=item?.rules||this.data.ruleProfiles?.festival||this.data.tournaments[0]?.rules;this.form=item?structuredClone(item):{name:'Новый турнир',slug:'tournament-'+Date.now(),division:'18+',seasonId:this.data.seasons[0]?.id,description:'',teamIds:[],rules:structuredClone(rules)};}
    else if(kind==='user')this.form=item?{...item,password:'',tournamentIds:this.work.assignments.filter((a:any)=>a.userId===item.id).map((a:any)=>a.tournamentId)}:{username:'',displayName:'',password:'',role:'secretary',active:true,tournamentIds:[]};
    else if(kind==='schedule')this.form={id:item?.id||t.id,startsAt:item?.tournamentId?this.dateTimeInput(item.startsAt):'2026-11-14T12:00',venue:item?.venue||'Новое Поколение',slotMinutes:item?.slotMinutes||90,isMatch:!!item?.tournamentId,expected:item?.tournamentId?{round:item.round,startsAt:item.startsAt,venue:item.venue,slotMinutes:item.slotMinutes}:undefined};
    else if(kind==='playoff')this.form={id:t.id,size:Math.min(8,t.teamIds.length)};
    else if(kind==='settings')this.form={...this.work.community};
    else if(kind==='news')this.form=item?{...item}:{title:'',body:'',category:'Сообщество',published:true};
    else if(kind==='season')this.form={name:'2027 / 2028',startsOn:'2027-09-01',endsOn:'2028-05-31'};
    else if(kind==='staff'){this.form={id:item.id,secretaries:[],secretaryIds:[]};void this.run(async()=>Object.assign(this.form,await this.request(`workspace/tournaments/${item.id}/staff`)),'');}
    if((kind==='player'&&!item)||kind==='registration')this.form.number=this.nextNumber(this.form.teamId);
  }
  toggleList(list:number[],id:number,checked:boolean){if(checked&&!list.includes(id))list.push(id);if(!checked)list.splice(list.indexOf(id),1);}
  async saveForm(){await this.run(async()=>{
    const f=this.form,k=this.modal;
    if(k==='login'){this.actor=await this.request('auth/login','POST',f);await this.refresh();this.modal='';await this.router.navigateByUrl('/office');return;}
    if(k==='schedule'){const startsAt=f.startsAt?f.startsAt+':00+03:00':null;await this.request(f.isMatch?`workspace/matches/${f.id}`:`workspace/tournaments/${f.id}/schedule`,f.isMatch?'PATCH':'POST',{...f,startsAt});}
    else if(k==='calendar'){const changes=scheduleChanges(f.rows);if(!changes.length)throw new Error('Расписание не изменено');await this.request(`workspace/tournaments/${f.tournamentId}/schedule`,'PATCH',{matches:changes});}
    else if(k==='playoff')await this.request(`workspace/tournaments/${f.id}/playoff`,'POST',{size:f.size});
    else if(k==='registration')await this.request('workspace/registrations','POST',f);
    else if(k==='settings')await this.request('workspace/community','PATCH',f);
    else if(k==='season')await this.request('workspace/seasons','POST',f);
    else if(k==='staff')await this.request(`workspace/tournaments/${f.id}/staff`,'PATCH',{secretaryIds:f.secretaryIds});
    else{
      const plural:any={team:'teams',player:'players',tournament:'tournaments',user:'users',news:'news'};
      await this.request(`workspace/${plural[k]}${f.id?'/'+f.id:''}`,f.id?'PATCH':'POST',f);
    }
    this.modal='';await this.refresh();
  },this.modal==='login'?'Вы вошли в кабинет':'Изменения сохранены');}
  async launchTournament(t:any){await this.run(async()=>{await this.request(`workspace/tournaments/${t.id}/launch`,'POST',{});await this.refresh();},'Турнир запущен');}
  async removeRegistration(r:any){if(!confirm('Исключить игрока из сезонной заявки? Старые протоколы сохранятся.'))return;await this.run(async()=>{await this.request(`workspace/registrations/${r.id}`,'DELETE');await this.refresh();});}
  async loadAudit(){await this.run(async()=>this.audit=await this.request('workspace/audit'),'');}
  async loadPublicMatch(){await this.run(async()=>this.detail=await this.request(`matches/${this.entityId}`),'');}
  async loadProtocol(){await this.run(async()=>{
    this.detail=await this.request(`workspace/matches/${this.entityId}`);const d=this.detail;this.selectTournament(d.tournament.id);this.draftVersion=d.draftVersion;this.protocolVersion=d.match.protocolVersion;
    this.protocol=structuredClone(d.draft||d.protocol||{timeBasis:'match',detailLevel:'full',homeRoster:[],awayRoster:[],goals:[],penalties:[],goalieShifts:[],shootout:[],resolution:'regulation',manualHomeScore:null,manualAwayScore:null,technicalReason:'',notes:'',referee:'',spectators:null});
    if(!d.draft&&!d.protocol)for(const candidate of d.candidates)this.toggleRoster(candidate.teamId,candidate,true);
    this.dirty=false;this.revisionReason='';this.protocolTab='rosters';
  },'');}
  candidates(teamId:number){return (this.detail?.candidates||[]).filter((c:any)=>c.teamId===teamId);}
  roster(teamId:number):any[]{return teamId===this.detail?.match.homeTeamId?this.protocol?.homeRoster||[]:this.protocol?.awayRoster||[];}
  rosterContains(teamId:number,id:number){return this.roster(teamId).some(x=>x.playerId===id);}
  rosterEntry(teamId:number,id:number){return this.roster(teamId).find(x=>x.playerId===id);}
  toggleRoster(teamId:number,c:any,checked:boolean){const list=this.roster(teamId);if(checked&&!list.some(x=>x.playerId===c.playerId))list.push({playerId:c.playerId,number:c.number,position:c.player.position,captain:c.captain,played:c.player.position!=='G'||!list.some(x=>x.position==='G'&&x.played)});if(!checked){const index=list.findIndex(x=>x.playerId===c.playerId);if(index>=0)list.splice(index,1);}this.dirty=true;}
  rosterOptions(teamId:number){return this.roster(teamId).map(x=>({...x,name:this.playerName(x.playerId)}));}
  get protocolTeams(){return this.detail?[this.detail.match.homeTeamId,this.detail.match.awayTeamId]:[];}
  matchTimeRange(period:number){
    const rules=this.detail?.tournament.rules;
    if(!rules||!Number.isInteger(period)||period<1||period>rules.periods+20)return 'Выберите период';
    const duration=period<=rules.periods?rules.periodMinutes:rules.overtimeMinutes;
    const start=period<=rules.periods?(period-1)*duration:rules.periods*rules.periodMinutes+(period-rules.periods-1)*duration;
    return `${String(start).padStart(2,'0')}:00–${String(start+duration).padStart(2,'0')}:00`;
  }
  get protocolTimeHint(){const rules=this.detail?.tournament.rules;return 'Время от начала матча, ММ:СС. '+(rules?Array.from({length:rules.periods},(_,index)=>`${index+1}-й период: ${this.matchTimeRange(index+1)}`).join('; ')+'. ':'')+'В овертайме общий отсчёт продолжается.';}
  addGoal(){const teamId=this.detail.match.homeTeamId;this.protocol.goals.push({id:crypto.randomUUID(),teamId,period:1,time:'00:00',scorerId:this.roster(teamId).find(x=>x.position!=='G')?.playerId||null,assist1Id:null,assist2Id:null,situation:'EV'});this.dirty=true;}
  addPenalty(){this.protocol.penalties.push({id:crypto.randomUUID(),teamId:this.detail.match.homeTeamId,playerId:null,servedById:null,period:1,time:'00:00',minutes:2,code:'Подножка',start:'',end:''});this.dirty=true;}
  addGoalie(){const teamId=this.detail.match.homeTeamId;this.protocol.goalieShifts.push({teamId,playerId:this.roster(teamId).find(x=>x.position==='G')?.playerId||null,from:'00:00',to:String(this.detail.tournament.rules.periods*this.detail.tournament.rules.periodMinutes)+':00'});this.dirty=true;}
  addShootout(){const teamId=this.protocol.shootout.length%2?this.detail.match.awayTeamId:this.detail.match.homeTeamId;const opponent=teamId===this.detail.match.homeTeamId?this.detail.match.awayTeamId:this.detail.match.homeTeamId;this.protocol.shootout.push({teamId,playerId:this.roster(teamId).find(x=>x.position!=='G')?.playerId||null,goalieId:this.roster(opponent).find(x=>x.position==='G')?.playerId||null,scored:false});this.dirty=true;}
  removeEvent(list:any[],index:number){list.splice(index,1);this.dirty=true;}
  protocolScore(teamId:number){return this.protocol?.detailLevel==='score_only'||this.protocol?.resolution==='technical'?(teamId===this.detail.match.homeTeamId?this.protocol.manualHomeScore:this.protocol.manualAwayScore)??'—':this.protocol?.goals.filter((g:any)=>g.teamId===teamId).length||0;}
  async saveProtocol(publish=false){await this.run(async()=>{const result=await this.request(`workspace/matches/${this.entityId}/${publish?'publish':'draft'}`,'POST',{protocol:this.protocol,expectedDraftVersion:this.draftVersion,expectedProtocolVersion:this.protocolVersion,reason:this.revisionReason});this.draftVersion=result.draftVersion;this.protocolVersion=result.protocolVersion;this.dirty=false;await this.refresh();if(publish){this.detail=await this.request(`workspace/matches/${this.entityId}`);this.revisionReason='';}},publish?'Протокол опубликован. Таблица и статистика обновлены':'Черновик сохранён');}
  print(){window.print();}
}
