import {existsSync,mkdirSync,symlinkSync,realpathSync,cpSync,writeFileSync,unlinkSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
if(existsSync('.env'))process.loadEnvFile('.env');
const require=createRequire(resolve('backend/package.json'));
const {Client}=require('pg');
const url=new URL(process.env.DATABASE_URL||'postgresql://hockey:hockey_local_2026@127.0.0.1:55440/hockey_os');
if(!['127.0.0.1','localhost'].includes(url.hostname))throw new Error('Переносимая база предназначена только для loopback');
const root=process.cwd(),taskKey=createHash('sha256').update(root).digest('hex').slice(0,12);
let pg,stop;
if(process.platform==='win32'){
  // Data stays in the workspace; Windows PostgreSQL needs ASCII binary paths.
  const runtime=resolve(tmpdir(),'hockey-os-runtime-18.6');
  const packageRequire=createRequire(createRequire(import.meta.url).resolve('embedded-postgres'));
  const binaries=packageRequire('@embedded-postgres/windows-x64');
  if(!existsSync(join(runtime,'bin','postgres.exe')))cpSync(dirname(dirname(binaries.postgres)),runtime,{recursive:true,dereference:true});
  const alias=resolve(tmpdir(),'hockey-os-'+taskKey);
  if(!existsSync(alias))symlinkSync(root,alias,'junction');
  if(realpathSync(alias).toLowerCase()!==realpathSync(root).toLowerCase())throw new Error('Каталог базы указывает на другой проект');
  const directory=join(alias,'.local','postgres');mkdirSync(directory,{recursive:true});
  if(!existsSync(join(directory,'PG_VERSION'))){
    const passwordFile=join(alias,'.local','initdb-password');writeFileSync(passwordFile,decodeURIComponent(url.password),{mode:0o600});
    try{execFileSync(join(runtime,'bin','initdb.exe'),['-D',directory,'-U',decodeURIComponent(url.username),'--pwfile='+passwordFile,'-A','scram-sha-256','--encoding=UTF8','--locale=C'],{cwd:runtime,stdio:'pipe',windowsHide:true});}
    finally{unlinkSync(passwordFile);}
  }
  pg=spawn(join(runtime,'bin','postgres.exe'),['-D',directory,'-p',url.port,'-h','127.0.0.1'],{cwd:runtime,stdio:['ignore','pipe','pipe'],windowsHide:true});
  pg.stderr.on('data',data=>{const value=String(data);if(/FATAL|PANIC/.test(value))process.stderr.write(value);});
  pg.on('error',e=>{console.error(e.message);process.exitCode=1;});
  stop=async()=>{execFileSync(join(runtime,'bin','pg_ctl.exe'),['-D',directory,'-m','fast','-w','stop'],{cwd:runtime,stdio:'pipe',windowsHide:true});};
}else{
  const {default:EmbeddedPostgres}=await import('embedded-postgres');const directory=resolve('.local/postgres');mkdirSync(resolve('.local'),{recursive:true});
  pg=new EmbeddedPostgres({databaseDir:directory,user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),port:Number(url.port),persistent:true,autoRehydrateSymlinks:true,initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:message=>console.error(String(message).trim())});
  if(!existsSync(join(directory,'PG_VERSION')))await pg.initialise();await pg.start();stop=()=>pg.stop();
}
let admin;
for(let i=0;i<50;i++){try{admin=new Client({connectionString:new URL('/postgres',url).href,connectionTimeoutMillis:1000});await admin.connect();break;}catch{await admin?.end().catch(()=>{});admin=null;await new Promise(r=>setTimeout(r,200));}}
if(!admin)throw new Error('PostgreSQL не запустилась');
const dbName=url.pathname.slice(1);if(!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName))throw new Error('Неверное имя базы');
if(!(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[dbName])).rowCount)await admin.query(`CREATE DATABASE "${dbName}"`);
await admin.end();console.log(`PostgreSQL готова: ${url.hostname}:${url.port}/${dbName}`);
let closing=false;async function close(){if(closing)return;closing=true;await stop();process.exitCode=0;}
process.on('SIGINT',close);process.on('SIGTERM',close);
