import './setup.mjs';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
process.loadEnvFile('.env');
const root=process.cwd(),children=[];
const start=(file,args=[],cwd=root)=>{const p=spawn(process.execPath,[file,...args],{cwd,env:process.env,stdio:'inherit',windowsHide:true});children.push(p);p.on('exit',code=>{if(code&&!stopping){console.error(`Процесс завершился с кодом ${code}`);stop(code);}});return p;};
let stopping=false;function stop(code=0){if(stopping)return;stopping=true;for(const p of children)p.kill('SIGTERM');setTimeout(()=>process.exit(code),500).unref();}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
async function ready(){try{const require=createRequire(resolve('backend/package.json'));const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:1000});await c.connect();await c.end();return true;}catch{return false;}}
if(!await ready()){
  start(resolve('scripts/local-db.mjs'));
  for(let i=0;i<60&&!await ready();i++)await new Promise(r=>setTimeout(r,500));
  if(!await ready()){stop(1);throw new Error('PostgreSQL не запустилась. Проверьте журнал выше или выполните pnpm db:up');}
}
const build=start(resolve('backend/node_modules/typescript/bin/tsc'),['-p','tsconfig.json'],resolve('backend'));
if(await new Promise(r=>build.on('exit',r))!==0)process.exit(1);
start(resolve('backend/dist/main.js'));
start(resolve('frontend/node_modules/@angular/cli/bin/ng.js'),['serve','--host','127.0.0.1','--port','4300'],resolve('frontend'));
console.log('Хоккей города: http://localhost:4300');
