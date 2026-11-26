import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,mkdir,writeFile,readdir,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const root=process.cwd(),require=createRequire(resolve('backend/package.json'));
const {Client}=require('pg'),sharp=require('sharp');
const source=new URL(process.env.MEDIA_TEST_DATABASE_URL||'');
assert.ok(['127.0.0.1','localhost'].includes(source.hostname));assert.equal(source.port,'15445','Use the isolated media PostgreSQL');
source.pathname='/postgres';const admin=new Client({connectionString:source.href});await admin.connect();
const database='hockey_media_test_'+Date.now();await admin.query(`CREATE DATABASE "${database}"`);
const url=new URL(source);url.pathname='/'+database;
const temp=await mkdtemp(join(tmpdir(),'hockey-media-test-')),uploads=join(temp,'uploads'),port=4134,base=`http://127.0.0.1:${port}/`;
const db=new Client({connectionString:url.href});await db.connect();
let server,log='',passed=0;const cookies={};
const ok=message=>{passed++;console.log('✓ '+message);};
function start(){
  server=spawn(process.execPath,[resolve(root,'backend/dist/main.js')],{cwd:temp,env:{...process.env,DATABASE_URL:url.href,NODE_ENV:'test',DEMO_SEED:'true',DEMO_PASSWORD:'MediaTest2026!',JWT_SECRET:'media-test-only-session-key-at-least-32-characters',FRONTEND_ORIGIN:base.slice(0,-1),HOST:'127.0.0.1',PORT:String(port),UPLOAD_DIR:uploads},stdio:['ignore','pipe','pipe'],windowsHide:true});
  server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
}
async function stop(){if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}}
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(base+'api/health')).ok)return;}catch{}if(server.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,150));}throw Error(log);}
async function api(path,method='GET',body,who='admin',status=200){
  const form=body instanceof FormData;
  const response=await fetch(base+'api/'+path,{method,headers:{...(!form?{'Content-Type':'application/json'}:{}),...(cookies[who]?{Cookie:cookies[who]}:{})},body:body===undefined?undefined:form?body:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,status,`${method} ${path}: ${JSON.stringify(data)}`);return data;
}
async function login(who){const r=await fetch(base+'api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:who,password:'MediaTest2026!'})});assert.equal(r.status,200);cookies[who]=r.headers.get('set-cookie').split(';')[0];}
function multipart(data,buffer,mime='image/png'){const body=new FormData();body.append('data',JSON.stringify(data));body.append('image',new Blob([buffer],{type:mime}),'original-user-file.png');return body;}
const fileCount=async kind=>(await readdir(join(uploads,kind)).catch(()=>[])).length;
const getPlayer=async id=>(await api('workspace')).players.find(p=>p.id===id);
const updatePlayer=(p,data,buffer,who='admin',status=200,mime='image/png')=>api('workspace/players/'+p.id,'PATCH',buffer?multipart({...p,...data},buffer,mime):{...p,...data},who,status);
const updateTeam=(team,data,buffer,who='admin',status=200)=>api('workspace/teams/'+team.id,'PATCH',buffer?multipart({...team,...data},buffer):{...team,...data},who,status);
async function asset(path,status=200){const r=await fetch(base.slice(0,-1)+path);assert.equal(r.status,status,path);return r;}
try{
  start();await ready();for(const who of ['admin','secretary','organizer','community'])await login(who);
  const initial=await api('workspace'),t1=initial.tournaments[0],t2=initial.tournaments[1],statsBefore=(await api('public')).stats;
  assert.equal(initial.players[0].photoUrl,null);assert.equal(initial.teams[0].logoUrl,null);ok('Миграция добавляет пустые изображения, существующие карточки и статистика сохранены');
  const ranked=initial.stats.find(p=>p.tournamentId===t1.id&&p.position!=='G'&&p.points>0);
  let player=initial.players.find(p=>p.id===ranked.playerId),team=initial.teams.find(t=>t.id===ranked.teamId);
  const foreign=initial.players.find(p=>initial.registrations.some(r=>r.playerId===p.id&&r.tournamentId===t2.id));
  await api('workspace/users','POST',{username:'media_secretary',displayName:'Секретарь одной лиги',password:'MediaTest2026!',role:'secretary',active:true,tournamentIds:[t1.id]},'admin',201);await login('media_secretary');
  const png=await sharp({create:{width:1200,height:1500,channels:4,background:{r:220,g:30,b:50,alpha:0.5}}}).png().toBuffer();
  await updatePlayer(player,{tournamentId:t1.id,imageAction:'replace',expectedImageUrl:null},png,'anonymous',401);
  await updatePlayer(foreign,{tournamentId:t1.id,imageAction:'replace',expectedImageUrl:null},png,'media_secretary',403);
  assert.equal(await fileCount('players'),0);ok('Анонимный пользователь и секретарь чужого турнира не могут загружать фотографии');
  player=await updatePlayer(player,{tournamentId:t1.id,imageAction:'replace',expectedImageUrl:null},png,'media_secretary');
  const firstPhoto=player.photoUrl;assert.match(firstPhoto,/^\/uploads\/players\/[\da-f-]+\.webp$/);const photoResponse=await asset(firstPhoto);assert.match(photoResponse.headers.get('content-type'),/image\/webp/);assert.match(photoResponse.headers.get('cache-control'),/immutable/);
  const metadata=await sharp(Buffer.from(await photoResponse.arrayBuffer())).metadata();assert.equal(metadata.width,800);assert.equal(metadata.height,1000);
  assert.equal((await api('public')).players.find(p=>p.id===player.id).photoUrl,firstPhoto);assert.equal((await api('public')).stats.find(p=>p.playerId===player.id).photoUrl,firstPhoto);
  const strip=rows=>rows.map(({photoUrl,...row})=>row);assert.deepEqual(strip((await api('public')).stats),strip(statsBefore));ok('Фотография нормализуется, доступна в карточке и статистике, игровые показатели не меняются');
  const jpeg=await sharp(png).jpeg().toBuffer();player=await updatePlayer(player,{imageAction:'replace',expectedImageUrl:player.photoUrl},jpeg,'community',200,'image/jpeg');assert.notEqual(player.photoUrl,firstPhoto);await asset(firstPhoto,404);assert.equal(await fileCount('players'),1);ok('Замена создаёт новый адрес и удаляет прежний файл после сохранения');
  const activePhoto=player.photoUrl;const stale=initial.players.find(p=>p.id===player.id);
  await updatePlayer(stale,{description:'ignored',photoUrl:'https://foreign.example/photo.png'});player=await getPlayer(player.id);assert.equal(player.photoUrl,activePhoto);ok('Сохранение текстовых полей старой формы не перезаписывает фото; произвольный URL не принимается');
  await updatePlayer(player,{imageAction:'replace',expectedImageUrl:firstPhoto},png,'admin',409);assert.equal(await fileCount('players'),1);
  const concurrent=await Promise.all([1,2].map(()=>fetch(base+'api/workspace/players/'+player.id,{method:'PATCH',headers:{Cookie:cookies.admin},body:multipart({...player,imageAction:'replace',expectedImageUrl:player.photoUrl},png)})));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);player=await getPlayer(player.id);assert.equal(await fileCount('players'),1);await asset(activePhoto,404);ok('Две параллельные замены допускают одну версию, устаревшая не удаляет актуальное фото');
  const replacedPhoto=player.photoUrl;player=await updatePlayer(player,{tournamentId:t1.id,imageAction:'remove',expectedImageUrl:player.photoUrl},undefined,'organizer');assert.equal(player.photoUrl,null);await asset(replacedPhoto,404);assert.equal(await fileCount('players'),0);ok('Удаление фотографии сохраняет игрока, заявки и статистику');
  const invalid=Buffer.from('<svg><script>alert(1)</script></svg>');await updatePlayer(player,{imageAction:'replace',expectedImageUrl:null},invalid,'admin',400,'image/svg+xml');await updatePlayer(player,{imageAction:'replace',expectedImageUrl:null},png.subarray(0,32),'admin',400);await updatePlayer(player,{imageAction:'replace',expectedImageUrl:null},png,'admin',400,'image/jpeg');await updatePlayer(player,{imageAction:'replace',expectedImageUrl:null},Buffer.alloc(5*1024*1024+1),'admin',413);assert.equal(await fileCount('players'),0);ok('Повреждённые изображения, SVG, неверный MIME и файлы свыше 5 МБ отвергаются без сохранения');
  const crossInput={lastName:'Медиа',firstName:'Общий',middleName:'Игрок',birthDate:'1970-01-01',position:'F',qualification:'amateur',insured:true,medicallyCleared:true};
  const cross=await api('workspace/players','POST',crossInput,'admin',201);
  for(const [t,tid] of [[t1,t1.teamIds[0]],[t2,t2.teamIds[0]]])await api('workspace/registrations','POST',{tournamentId:t.id,teamId:tid,playerId:cross.id,number:99,captain:''},'admin',201);
  await updatePlayer(cross,{tournamentId:t1.id,imageAction:'replace',expectedImageUrl:null},png,'media_secretary',403);
  const shared=await updatePlayer(cross,{tournamentId:t1.id,imageAction:'replace',expectedImageUrl:null},png,'secretary');const publicCross=(await api('public')).players.filter(p=>p.id===cross.id);assert.equal(publicCross.length,1);assert.equal(publicCross[0].photoUrl,shared.photoUrl);ok('Общий игрок обеих лиг получает одно фото; изменение требует прав на все его действующие заявки');
  const beforeRollback=await fileCount('players'),beforePlayers=(await api('workspace')).players.length;
  await api('workspace/players','POST',multipart({...crossInput,lastName:'Откат',firstName:'Загрузки',middleName:'Проверочный',tournamentId:t1.id,teamId:t1.teamIds[0],number:1,registerAfter:true,imageAction:'replace',expectedImageUrl:null},png),'admin',409);
  assert.equal(await fileCount('players'),beforeRollback);assert.equal((await api('workspace')).players.length,beforePlayers);ok('Ошибка сезонной заявки откатывает и создание игрока, и загруженный файл');
  const unused=await api('workspace/players','POST',multipart({...crossInput,lastName:'Удаляемая',firstName:'Фотография',middleName:'Тестовая',imageAction:'replace',expectedImageUrl:null},png),'admin',201);
  const info=await api(`workspace/players/${unused.id}/deletion`);await api(`workspace/players/${unused.id}`,'DELETE',{expectedVersion:info.version});await asset(unused.photoUrl,404);ok('Удаление разрешённой карточки игрока также очищает её фотографию');
  team=await updateTeam(team,{tournamentId:t1.id,imageAction:'replace',expectedImageUrl:null},png,'media_secretary');let pub=await api('public');assert.equal(pub.teams.find(t=>t.id===team.id).logoUrl,team.logoUrl);assert.equal(pub.standings[t1.id].find(t=>t.teamId===team.id).logoUrl,team.logoUrl);
  const logo=await sharp(Buffer.from(await (await asset(team.logoUrl)).arrayBuffer())).metadata();assert.ok(logo.width<=512&&logo.height<=512);assert.equal(logo.hasAlpha,true);ok('Логотип доступен в каталоге и таблицах, сохраняет прозрачность и пропорции');
  const oldLogo=team.logoUrl;team=await updateTeam(team,{imageAction:'remove',expectedImageUrl:oldLogo},undefined,'community');assert.equal(team.logoUrl,null);await asset(oldLogo,404);ok('Удаление логотипа возвращает команду к стандартной эмблеме');
  const assetDir=process.env.MEDIA_TEST_ASSET_DIR||join(temp,'fixtures');await mkdir(assetDir,{recursive:true});
  const portrait=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#1c3448"/><stop offset="1" stop-color="#11171d"/></linearGradient></defs><rect width="800" height="1000" fill="url(#bg)"/><path d="M0 890L800 200M0 1000L800 310" stroke="#e31b36" stroke-width="8" opacity=".4"/><path d="M100 1000L140 655Q400 495 660 655L710 1000" fill="#b91c37"/><path d="M140 695L660 695M120 815L685 815" stroke="#eee" stroke-width="36"/><ellipse cx="400" cy="365" rx="155" ry="185" fill="#cb9d80"/><path d="M245 340Q235 135 420 165Q590 180 550 355L505 300L475 210Q345 215 260 345" fill="#352b29"/><text x="400" y="955" text-anchor="middle" font-family="sans-serif" font-size="150" font-weight="bold" fill="white">24</text></svg>')).png().toBuffer();
  const emblem=await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="560"><path d="M30 45L256 10L482 45V285Q480 430 256 535Q32 430 30 285Z" fill="#e5243f" stroke="white" stroke-width="12"/><path d="M62 75L256 40L450 75V280Q445 400 256 495Q67 400 62 280Z" fill="#143a52"/><path d="M110 360L400 140M110 140L400 360" stroke="white" stroke-width="20" opacity=".45"/><text x="256" y="315" text-anchor="middle" font-family="sans-serif" font-size="145" font-weight="bold" fill="white">ХК</text></svg>')).png().toBuffer();
  await writeFile(join(assetDir,'test-player.png'),portrait);await writeFile(join(assetDir,'test-team.png'),emblem);
  player=await updatePlayer(player,{imageAction:'replace',expectedImageUrl:null},portrait);team=await updateTeam(team,{imageAction:'replace',expectedImageUrl:null},emblem);
  const catalog=await api('workspace/teams','POST',multipart({name:'Медиа тест',city:'Чебоксары',abbreviation:'МЕД',color:'#123456',description:'',imageAction:'replace',expectedImageUrl:null},emblem),'admin',201);assert.ok(catalog.logoUrl);ok('Изображения поддерживаются и при создании карточки, и при последующем редактировании');
  await stop();start();await ready();await asset(player.photoUrl);await asset(team.logoUrl);assert.equal((await api('public')).players.find(p=>p.id===player.id).photoUrl,player.photoUrl);ok('Перезапуск приложения сохраняет фотографии, логотипы и ссылки в БД');
  const locker=spawn(process.execPath,[resolve(root,'backend/dist/media/backup-lock.js')],{cwd:temp,env:{...process.env,DATABASE_URL:url.href},stdio:['pipe','pipe','pipe'],windowsHide:true});
  try{
    await new Promise((resolve,reject)=>{let text='';const timeout=setTimeout(()=>reject(Error('Backup helper did not become ready')),10000);locker.stdout.on('data',b=>{text+=b;if(text.includes('LOCKED\n')){clearTimeout(timeout);resolve();}});locker.once('exit',code=>{clearTimeout(timeout);if(!text.includes('LOCKED\n'))reject(Error('Backup helper exited '+code));});});
    const count=await fileCount('players');await updatePlayer(player,{imageAction:'replace',expectedImageUrl:player.photoUrl},portrait,'admin',409);assert.equal(await fileCount('players'),count);
    await api('public');const detail=await updatePlayer(player,{firstName:player.firstName});assert.equal(detail.photoUrl,player.photoUrl);
  }finally{const exited=once(locker,'exit');locker.stdin.end('release\n');await exited;}
  player=await updatePlayer(player,{imageAction:'replace',expectedImageUrl:player.photoUrl},portrait);
  ok('Блокировка резервной копии защищает ссылки на файлы; чтение и текстовое редактирование работают, после копирования замена снова доступна');
  await mkdir(join(uploads,'news'),{recursive:true});await writeFile(join(uploads,'news','test-cover.txt'),'fixture');const archive=join(temp,'uploads.tar.gz');execFileSync('tar',['-czf',archive,'-C',uploads,'.']);const listing=execFileSync('tar',['-tf',archive],{encoding:'utf8'});assert.match(listing,/players\//);assert.match(listing,/teams\//);assert.match(listing,/news\//);ok('Общий архив хранилища включает новости, фотографии игроков и логотипы команд');
  console.log(`Passed ${passed} media integration checks. Player ${player.id}, team ${team.id}.`);
  if(process.argv.includes('--preview')){
    const stopFile=process.env.MEDIA_TEST_STOP_FILE;if(stopFile)await rm(stopFile,{force:true});
    console.log(`PREVIEW_READY ${base}office/players player /players/${player.id} team /teams/${team.id}`);
    await new Promise(resolve=>{const interval=setInterval(async()=>{if(stopFile){try{await access(stopFile);clearInterval(interval);resolve();}catch{}}},300);for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearInterval(interval);resolve();});});
  }
}finally{await stop();await db.end();await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();assert.ok(temp.startsWith(join(tmpdir(),'hockey-media-test-')));await rm(temp,{recursive:true,force:true});}
