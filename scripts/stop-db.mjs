import {resolve,join} from 'node:path';
import {existsSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
if(process.platform!=='win32'){console.log('Остановите pnpm db:local сочетанием Ctrl+C в его терминале.');process.exit(0);}
const root=process.cwd(),alias=resolve(tmpdir(),'hockey-os-'+createHash('sha256').update(root).digest('hex').slice(0,12));
if(!existsSync(alias)||realpathSync(alias).toLowerCase()!==realpathSync(root).toLowerCase())throw new Error('Не найден каталог локальной базы этого проекта');
const directory=join(alias,'.local','postgres'),runtime=resolve(tmpdir(),'hockey-os-runtime-18.6');
if(!existsSync(join(directory,'postmaster.pid'))){console.log('Локальная PostgreSQL уже остановлена.');process.exit(0);}
execFileSync(join(runtime,'bin','pg_ctl.exe'),['-D',directory,'-m','fast','-w','stop'],{cwd:runtime,stdio:'inherit',windowsHide:true});
