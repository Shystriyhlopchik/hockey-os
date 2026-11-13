import {DataSource} from 'typeorm';
import {Community,Season,User,Assignment,Team,Player,Tournament,Registration,Match,Revision,News,Audit} from './entities';
import {FESTIVAL_RULES,emptyProtocol,roundRobin,resolveProtocol} from './domain';
import {hashPassword} from './security';
export async function seed(db:DataSource){
  if(await db.manager.count(Community))return;
  const demo=process.env.DEMO_SEED==='true';
  const password=process.env.DEMO_PASSWORD;
  if(!password||password.length<10)throw new Error('Для первой установки задайте DEMO_PASSWORD (от 10 символов)');
  if(process.env.NODE_ENV==='production'&&(demo||password==='Hockey2026!'))throw new Error('В production запрещены демо-наполнение и демонстрационный пароль');
  await db.transaction(async m=>{
    await m.save(Community,m.create(Community,{singleton:true,name:'Городская хоккейная лига',shortName:'ХОККЕЙ ГОРОДА',city:'Чебоксары',description:'Один город. Одна игра. Сообщество тех, кто выбирает лёд.',email:'league@example.com'}));
    const season=await m.save(Season,m.create(Season,{name:'2026 / 2027',startsOn:'2026-10-31',endsOn:'2027-03-31'}));
    const admin=await m.save(User,m.create(User,{username:'admin',displayName:'Администратор',role:'superuser',passwordHash:hashPassword(password),active:true}));
    if(!demo)return;
    const community=await m.save(User,m.create(User,{username:'community',displayName:'Администратор сообщества',role:'community_admin',passwordHash:hashPassword(password),active:true}));
    const organizer=await m.save(User,m.create(User,{username:'organizer',displayName:'Организатор турнира',role:'tournament_admin',passwordHash:hashPassword(password),active:true}));
    const secretary=await m.save(User,m.create(User,{username:'secretary',displayName:'Мария · секретарь',role:'secretary',passwordHash:hashPassword(password),active:true}));
    const teamNames=['Север','Сокол','Волна','Спартак','Метеор','Атлант','Сталь','Динамо','Ветераны','Рубин','Полярник','Локомотив','Барс','Вымпел','Олимп','Факел'];
    const colors=['#1f5970','#d76b38','#2b7b91','#a84044','#526993','#9e823d','#526a62','#356aab'];
    const first=['Александр','Михаил','Андрей','Дмитрий','Иван','Сергей','Алексей','Николай','Владимир','Павел','Евгений','Максим','Роман','Артём','Илья','Олег','Виктор','Кирилл','Денис','Антон','Пётр','Виталий'];
    const middle=['Александрович','Михайлович','Иванович','Сергеевич','Петрович','Владимирович','Николаевич','Андреевич'];
    const last=['Ледов','Снежнов','Соколов','Ветров','Озеров','Морозов','Рощин','Зорин','Белов','Рыбаков','Серов','Поляков','Кедров','Тихонов','Волков','Громов','Березин','Лазарев','Руднев','Зимин','Фролов','Быстров'];
    for(let division=0;division<2;division++){
      const teams:Team[]=[];const roster=new Map<number,any[]>();
      const tournament=await m.save(Tournament,m.create(Tournament,{seasonId:season.id,name:division?'Лига опытных · 40+':'Лига сильных · 18+',slug:division?'festival-40':'festival-18',division:division?'40+':'18+',status:'active',rules:{...FESTIVAL_RULES,minAge:division?40:18,schoolLimit:division?1:2},teamIds:[],description:'Городской фестиваль любительского хоккея. Два круга, затем серии плей-офф. Демонстрационные данные.'}));
      for(let teamIndex=0;teamIndex<8;teamIndex++){
        const team=await m.save(Team,m.create(Team,{name:teamNames[teamIndex+division*8],city:'Чебоксары',abbreviation:teamNames[teamIndex+division*8].slice(0,3).toUpperCase(),color:colors[teamIndex],description:'Любительская хоккейная команда. Демонстрационная карточка.'}));teams.push(team);const entries=[];
        for(let i=0;i<22;i++){
          const p=await m.save(Player,m.create(Player,{firstName:first[(i+teamIndex)%22],lastName:last[(i*3+teamIndex*2)%22]+(teamIndex>3?'ский':''),middleName:middle[division*4+(i+teamIndex)%4],birthDate:`${division?1966+(i+teamIndex)%18:1980+(i+teamIndex)%25}-${String(i%12+1).padStart(2,'0')}-${String(i%27+1).padStart(2,'0')}`,position:i<2?'G':i<9?'D':'F',qualification:i%4===0?'novice':'amateur',insured:true,medicallyCleared:true}));
          await m.save(Registration,m.create(Registration,{tournamentId:tournament.id,teamId:team.id,playerId:p.id,number:i+1,captain:i===9?'C':i===10||i===11?'A':'',active:true}));entries.push({playerId:p.id,number:i+1,position:p.position,captain:i===9?'C':i===10||i===11?'A':'',played:i!==1});
        }roster.set(team.id,entries);
      }
      tournament.teamIds=teams.map(t=>t.id);await m.save(tournament);
      for(const user of [organizer,secretary])await m.save(Assignment,m.create(Assignment,{userId:user.id,tournamentId:tournament.id}));
      const pairs=roundRobin(tournament.teamIds,2);
      for(let i=0;i<pairs.length;i++){
        const pair=pairs[i];const date=new Date(Date.UTC(2026,9,31+Math.floor(i/4)*7,9+(i%4)*2,division?0:0));
        const match=await m.save(Match,m.create(Match,{tournamentId:tournament.id,...pair,startsAt:date,slotMinutes:90,venue:division?'Ледовая арена «Спартак»':'Новое Поколение',stage:'regular',status:'scheduled'}));
        if(i<8){const p=emptyProtocol();p.homeRoster=roster.get(pair.homeTeamId)!;p.awayRoster=roster.get(pair.awayTeamId)!;p.referee='Иван Павлов';p.spectators=45+i*8;
          const hs=[4,2,5,1,3,6,2,4][i],as=[2,2,1,3,2,2,4,1][i];p.resolution=hs===as?'draw':'regulation';
          for(const [tid,count,entries] of [[pair.homeTeamId,hs,p.homeRoster],[pair.awayTeamId,as,p.awayRoster]] as const)for(let j=0;j<count;j++)p.goals.push({id:`demo-${tid}-${j}`,teamId:tid,period:j%3+1,time:`${String(2+(j*3)%12).padStart(2,'0')}:24`,scorerId:entries[9+j%10].playerId,assist1Id:entries[3+j%5].playerId,assist2Id:j%2?null:entries[15+j%5].playerId,situation:j%3===0?'PP':'EV'});
          p.penalties=[{id:'demo-penalty',teamId:pair.awayTeamId,playerId:p.awayRoster[4].playerId,period:1,time:'01:30',minutes:2,code:'Подножка'}];
          p.goalieShifts=[{teamId:pair.homeTeamId,playerId:p.homeRoster[0].playerId,from:'00:00',to:'45:00'},{teamId:pair.awayTeamId,playerId:p.awayRoster[0].playerId,from:'00:00',to:'45:00'}];
          const result=resolveProtocol(p,match as any,tournament.rules);const identities:any={};for(const entry of [...p.homeRoster,...p.awayRoster]){const player=await m.findOneByOrFail(Player,{id:entry.playerId});identities[player.id]={name:`${player.lastName} ${player.firstName} ${player.middleName}`,birthDate:player.birthDate,position:player.position};}
          await m.save(Revision,m.create(Revision,{matchId:match.id,version:1,actorId:secretary.id,protocol:p,result,identities,reason:''}));Object.assign(match,result,{status:'completed',protocolVersion:1,publishedAt:date});await m.save(match);
        }
      }
    }
    for(const article of [{title:'Сезон, который объединяет',category:'События',body:'Городской фестиваль возвращается на лёд. В этом сезоне встречаются команды дивизионов 18+ и 40+. Следите за календарём, поддерживайте свою команду и открывайте новые имена. Это демонстрационная новость — её можно изменить в кабинете.'},{title:'Всё о формате фестиваля',category:'Регламент',body:'Команды играют регулярный этап в два круга. Каждый матч состоит из трёх периодов по 15 минут чистого времени. При равном счёте в регулярке фиксируется ничья. Затем сильнейшие встретятся в сериях плей-офф.'},{title:'Протокол — основа статистики',category:'Лига',body:'После игры секретарь публикует составы, голы, передачи и удаления. На основе этих данных автоматически обновляются таблицы и статистика хоккеистов.'}])await m.save(News,m.create(News,{...article,published:true}));
    await m.save(Audit,m.create(Audit,{actorId:admin.id,tournamentId:null,action:'demo_seed',entity:'community',entityId:1,details:{teams:16,players:352}}));
  });
}
