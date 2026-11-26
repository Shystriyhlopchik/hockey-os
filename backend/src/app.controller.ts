import {FileInterceptor} from '@nestjs/platform-express';
import {mediaBody,MAX_IMAGE_BYTES} from './media/media.service';
import type {ImageUpload} from './media/media.service';
import {goalSituationLabel,penaltyStart,OFFICIAL_ROLES} from '../../shared/protocol-details.js';
import {goalieSummary,formatGoalieTime} from '../../shared/goalie-statistics.js';
import {Controller,Get,Post,Patch,Delete,Body,Param,Req,Res,ParseIntPipe,UnauthorizedException,HttpCode,UseInterceptors,UploadedFile} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import type {Response} from 'express';
import {AppService} from './app.service';
import {AuthRequest,Public,verifyPassword} from './security';
import {User,Revision,Match,Team} from './entities';
import {Workbook} from 'exceljs';
import {sortProtocolRoster,chronologicalProtocolGoals} from './domain';

@Controller() export class AppController {
  private attempts=new Map<string,{count:number;until:number}>();
  constructor(private app:AppService,private jwt:JwtService){}
  @Public() @Get('health') async health(){await this.app.db.query('SELECT 1');return {status:'ok',application:'hockey-os'};}
  @Public() @Get('public') snapshot(){return this.app.snapshot();}
  @Public() @Get('matches/:id') detail(@Param('id',ParseIntPipe) id:number){return this.app.matchDetail(id);}
  @Public() @Post('auth/login') @HttpCode(200) async login(@Body() body:any,@Req() req:AuthRequest,@Res({passthrough:true}) res:Response){
    const key=req.ip||'local',now=Date.now();let a=this.attempts.get(key);if(!a||a.until<now){a={count:0,until:now+60000};this.attempts.set(key,a);}if(this.attempts.size>1000)for(const[k,v]of this.attempts)if(v.until<now)this.attempts.delete(k);
    if(++a.count>10)throw new UnauthorizedException('Слишком много попыток. Повторите через минуту');
    if(typeof body.username!=='string'||typeof body.password!=='string'||body.password.length>128)throw new UnauthorizedException('Неверный логин или пароль');
    const u=await this.app.db.getRepository(User).createQueryBuilder('u').addSelect('u.passwordHash').where('u.username=:username AND u.active=true',{username:body.username.toLowerCase().trim()}).getOne();
    if(!u||!verifyPassword(body.password,u.passwordHash))throw new UnauthorizedException('Неверный логин или пароль');
    const token=await this.jwt.signAsync({sub:u.id});res.cookie('hockey_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/api',maxAge:8*60*60*1000});
    await this.app.audit(u,'login','user',u.id,null);return {id:u.id,displayName:u.displayName,username:u.username,role:u.role};
  }
  @Get('auth/me') me(@Req() req:AuthRequest){return req.actor;}
  @Post('auth/logout') logout(@Res({passthrough:true}) res:Response){res.clearCookie('hockey_session',{path:'/api'});return {ok:true};}
  @Get('workspace') workspace(@Req() r:AuthRequest){return this.app.snapshot(r.actor);}
  @Get('workspace/matches/:id') privateDetail(@Param('id',ParseIntPipe) id:number,@Req() r:AuthRequest){return this.app.matchDetail(id,r.actor);}
  @Post('workspace/matches/:id/draft') draft(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.saveProtocol(r.actor,id,b,false);}
  @Post('workspace/matches/:id/publish') publish(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.saveProtocol(r.actor,id,b,true);}
  @Patch('workspace/matches/:id') match(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.scheduleMatch(r.actor,id,b);}
  @Post('workspace/tournaments') createTournament(@Body() b:any,@Req() r:AuthRequest){return this.app.tournament(r.actor,b);}
  @Patch('workspace/tournaments/:id') tournament(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.tournament(r.actor,b,id);}
  @Post('workspace/tournaments/:id/schedule') schedule(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.generateSchedule(r.actor,id,b);}
  @Patch('workspace/tournaments/:id/schedule') updateSchedule(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.updateSchedule(r.actor,id,b);}
  @Post('workspace/tournaments/:id/launch') launch(@Param('id',ParseIntPipe) id:number,@Req() r:AuthRequest){return this.app.launch(r.actor,id);}
  @Post('workspace/tournaments/:id/playoff') playoff(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.startPlayoff(r.actor,id,b.size);}
  @Post('workspace/seasons') season(@Body() b:any,@Req() r:AuthRequest){return this.app.season(r.actor,b);}
  @Post('workspace/teams') @UseInterceptors(FileInterceptor('image',{limits:{fileSize:MAX_IMAGE_BYTES,files:1,fields:1,fieldSize:1024*1024}})) createTeam(@Body() b:any,@Req() r:AuthRequest,@UploadedFile() file?:ImageUpload){return this.app.team(r.actor,mediaBody(b),undefined,file);}
  @Patch('workspace/teams/:id') @UseInterceptors(FileInterceptor('image',{limits:{fileSize:MAX_IMAGE_BYTES,files:1,fields:1,fieldSize:1024*1024}})) team(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest,@UploadedFile() file?:ImageUpload){return this.app.team(r.actor,mediaBody(b),id,file);}
  @Post('workspace/players/check-name') @HttpCode(200) checkPlayerName(@Body() b:any,@Req() r:AuthRequest){return this.app.checkPlayerName(r.actor,b);}
  @Post('workspace/players') @UseInterceptors(FileInterceptor('image',{limits:{fileSize:MAX_IMAGE_BYTES,files:1,fields:1,fieldSize:1024*1024}})) createPlayer(@Body() b:any,@Req() r:AuthRequest,@UploadedFile() file?:ImageUpload){return this.app.player(r.actor,mediaBody(b),undefined,file);}
  @Patch('workspace/players/:id') @UseInterceptors(FileInterceptor('image',{limits:{fileSize:MAX_IMAGE_BYTES,files:1,fields:1,fieldSize:1024*1024}})) player(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest,@UploadedFile() file?:ImageUpload){return this.app.player(r.actor,mediaBody(b),id,file);}
  @Get('workspace/players/:id/deletion') checkPlayerDeletion(@Param('id',ParseIntPipe) id:number,@Req() r:AuthRequest){return this.app.checkPlayerDeletion(r.actor,id);}
  @Delete('workspace/players/:id') removePlayer(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.removePlayer(r.actor,id,b);}
  @Post('workspace/registrations') registration(@Body() b:any,@Req() r:AuthRequest){return this.app.registration(r.actor,b);}
  @Delete('workspace/registrations/:id') remove(@Param('id',ParseIntPipe) id:number,@Req() r:AuthRequest){return this.app.removeRegistration(r.actor,id);}
  @Post('workspace/users') createUser(@Body() b:any,@Req() r:AuthRequest){return this.app.users(r.actor,b);}
  @Patch('workspace/users/:id') user(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.users(r.actor,b,id);}
  @Patch('workspace/community') community(@Body() b:any,@Req() r:AuthRequest){return this.app.community(r.actor,b);}
  @Get('workspace/audit') audit(@Req() r:AuthRequest){return this.app.auditLog(r.actor);}
  @Get('workspace/tournaments/:id/staff') staff(@Param('id',ParseIntPipe) id:number,@Req() r:AuthRequest){return this.app.staff(r.actor,id);}
  @Patch('workspace/tournaments/:id/staff') assignStaff(@Param('id',ParseIntPipe) id:number,@Body() b:any,@Req() r:AuthRequest){return this.app.staff(r.actor,id,b.secretaryIds);}
  @Public() @Get('matches/:id/export.xlsx') async export(@Param('id',ParseIntPipe) id:number,@Res() res:Response){return this.exportWorkbook(id,res);}
  @Get('workspace/matches/:id/export.xlsx') async exportStaff(@Param('id',ParseIntPipe) id:number,@Res() res:Response,@Req() r:AuthRequest){return this.exportWorkbook(id,res,r.actor);}
  private async exportWorkbook(id:number,res:Response,actor?:AuthRequest['actor']){
    const data=await this.app.matchDetail(id,actor);const match=data.match as Match;
    if(!data.protocol)throw new UnauthorizedException('Официальный протокол ещё не опубликован');
    const teams=await this.app.db.manager.find(Team);const team=(id:number|null)=>teams.find(t=>t.id===id)?.name||'—';
    const wb=new Workbook();wb.creator='Хоккей города';const sheet=wb.addWorksheet('Протокол',{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0}});
    sheet.columns=[{width:12},{width:32},{width:16},{width:20},{width:24},{width:24},{width:24}];
    sheet.addRow(['ОФИЦИАЛЬНЫЙ ПРОТОКОЛ МАТЧА']);sheet.mergeCells(1,1,1,7);sheet.getRow(1).font={bold:true,size:17};
    sheet.addRow([data.tournament.name]);sheet.addRow([`Матч № ${id}`,match.startsAt?new Date(match.startsAt).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'',match.venue]);
    sheet.addRow([team(match.homeTeamId),`${match.homeScore} : ${match.awayScore}`,team(match.awayTeamId),`Версия ${match.protocolVersion}`]);
    sheet.addRow(['Период','Хозяева','Гости']);for(const s of match.periodScores||[])sheet.addRow([s.label,s.home,s.away]);
    const p=data.protocol as any;const identity=(id:number|null)=>id?data.identities[id]?.name||'—':'—';
    if(p.bestPlayerId)sheet.addRow(['Лучший игрок матча',identity(p.bestPlayerId)]);
    for(const [tid,roster] of [[match.homeTeamId,p.homeRoster],[match.awayTeamId,p.awayRoster]]){
      sheet.addRow([]);sheet.addRow([team(tid)]);sheet.addRow(['Номер','Игрок','Амплуа','К / А','Участвовал']);for(const r of sortProtocolRoster<any>(roster))sheet.addRow([r.number,identity(r.playerId),r.position,r.captain,r.played?'Да':'Нет']);
    }
    sheet.addRow([]);sheet.addRow(['ГОЛЫ']);sheet.getColumn(8).width=32;sheet.getColumn(9).width=32;
    sheet.addRow(['Период','Время матча','Команда','Автор','Ассистент 1','Ассистент 2','Ситуация','На льду · А','На льду · Б']);for(const g of chronologicalProtocolGoals<any>(p.goals))sheet.addRow([g.period,g.time,team(g.teamId),identity(g.scorerId),identity(g.assist1Id),identity(g.assist2Id),goalSituationLabel(g),(g.homeOnIce||[]).map(identity).join(', '),(g.awayOnIce||[]).map(identity).join(', ')]);
    sheet.addRow([]);sheet.addRow(['УДАЛЕНИЯ']);sheet.addRow(['Период','Назначено (при отличии)','Команда','Игрок','Минуты','Нарушение','Отбывал','Начало','Окончание']);for(const e of p.penalties)sheet.addRow([e.period,e.time!==penaltyStart(e)?e.time:'',team(e.teamId),identity(e.playerId),e.kind==='penalty_shot'?'ШБ':e.minutes,e.code,identity(e.servedById),penaltyStart(e),e.end||'']);
    const back=wb.addWorksheet('Дополнения',{pageSetup:{paperSize:9,fitToPage:true,fitToWidth:1,fitToHeight:0}});back.columns=[{width:26},{width:38},{width:30},{width:30},{width:25}];
    back.addRow(['ВРАТАРИ']);back.addRow(['Команда','Вратарь','Начало','Окончание']);for(const g of p.goalieShifts)back.addRow([team(g.teamId),g.playerId?identity(g.playerId):'Пустые ворота',g.from,g.to]);
    const keeperStats=goalieSummary(p,{homeTeamId:match.homeTeamId!,awayTeamId:match.awayTeamId!},data.tournament.rules);
    back.addRow([]);back.addRow(['СТАТИСТИКА ВРАТАРЕЙ']);back.addRow(['Команда','Вратарь','Время на льду','Пропущено шайб']);
    for(const keeper of keeperStats.rows)back.addRow([team(keeper.teamId),identity(keeper.playerId),keeper.complete?formatGoalieTime(keeper.seconds):'Нет данных',keeper.complete?keeper.goalsAgainst:'Нет данных']);
    back.addRow([]);back.addRow(['СЕРИЯ БРОСКОВ']);for(const s of p.shootout)back.addRow([team(s.teamId),identity(s.playerId),identity(s.goalieId),s.scored?'Гол':'Нет гола']);
    back.addRow([]);back.addRow(['Главный судья',p.referee]);back.addRow(['Зрители',p.spectators]);back.addRow(['Замечания',p.notes]);if(p.resolution==='technical')back.addRow(['Техническое решение',p.technicalReason]);
    if(p.sheet){
      const s=p.sheet;back.addRow([]);back.addRow(['СВЕДЕНИЯ С БУМАЖНОГО БЛАНКА']);
      for(const [label,value] of [['Номер на бланке',s.matchNumber],['Город',s.city],['Фактическое начало · МСК',s.startedAt],['Фактическое окончание · МСК',s.endedAt]])back.addRow([label,value]);
      for(const [key,tid] of [['homeStaff',match.homeTeamId],['awayStaff',match.awayTeamId]]){
        back.addRow([]);back.addRow(['ПРЕДСТАВИТЕЛИ КОМАНДЫ',team(tid as number)]);
        for(const [field,label] of [['headCoach','Главный тренер'],['coach','Тренер'],['manager','Начальник команды'],['representative','Представитель команды']])back.addRow([label,s[String(key)]?.[field]||'']);
      }
      back.addRow([]);back.addRow(['ТАЙМ-АУТЫ']);back.addRow(['Команда','Период','Время матча']);for(const t of s.timeouts||[])back.addRow([team(t.teamId),t.period,t.time]);
      back.addRow([]);back.addRow(['НЕРЕАЛИЗОВАННЫЕ ШТРАФНЫЕ БРОСКИ']);back.addRow(['Команда','Период','Время матча','Исполнитель','Вратарь']);for(const shot of s.missedShots||[])back.addRow([team(shot.teamId),shot.period,shot.time,identity(shot.playerId),identity(shot.goalieId)]);
      back.addRow([]);back.addRow(['СУДЕЙСКАЯ БРИГАДА']);
      for(const [field,label] of OFFICIAL_ROLES)if(s.officials?.[field]?.trim())back.addRow([label,s.officials[field]]);
      back.addRow([]);back.addRow(['ЗАМЕЧАНИЯ НА ОБОРОТЕ']);
      for(const [field,label] of [['disciplinaryNotes','Дисциплинарные нарушения и пункты регламента'],['matchNotes','Замечания главного судьи и инспектора'],['protestNotes','Уведомления о подаче протеста']])back.addRow([label,s[field]||'']);
      if(actor)back.addRow(['Уведомления врачей о травмах · служебные',s.injuryNotes||'']);
    }
    sheet.addRow([]);sheet.addRow(['ШТРАФНОЕ ВРЕМЯ ПО ПЕРИОДАМ']);sheet.addRow(['Период','Хозяева, мин','Гости, мин']);
    const penaltyPeriods=new Set<number>([...Array.from({length:data.tournament.rules.periods},(_,i)=>i+1),...p.penalties.map((pen:any)=>pen.period)]);
    for(const period of [...penaltyPeriods].sort((a,b)=>a-b))sheet.addRow([period,p.penalties.filter((pen:any)=>pen.period===period&&pen.teamId===match.homeTeamId).reduce((n:number,pen:any)=>n+pen.minutes,0),p.penalties.filter((pen:any)=>pen.period===period&&pen.teamId===match.awayTeamId).reduce((n:number,pen:any)=>n+pen.minutes,0)]);

    for(const s of [sheet,back]){s.views=[{state:'frozen',ySplit:4}];s.eachRow(row=>{row.alignment={vertical:'middle',wrapText:true};row.height=Math.max(23,row.height||0);if(row.number%2===0)row.eachCell(c=>c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF0F4F5'}});});}
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="hockey-match-${id}-v${match.protocolVersion}.xlsx"`);await wb.xlsx.write(res);res.end();
  }
}
