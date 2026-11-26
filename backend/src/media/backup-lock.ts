import 'reflect-metadata';
import {DataSource} from 'typeorm';
import {MEDIA_BACKUP_LOCK} from './media-lock';

async function holdBackupLock():Promise<void>{
  const db=new DataSource({type:'postgres',url:process.env.DATABASE_URL,logging:false,extra:{connectionTimeoutMillis:10000}});
  await db.initialize();const connection=db.createQueryRunner();
  let timeout:ReturnType<typeof setTimeout>|undefined;
  try{
    await connection.connect();await connection.query("SET lock_timeout='30s'");await connection.query('SELECT pg_advisory_lock($1,$2)',[...MEDIA_BACKUP_LOCK]);
    process.stdout.write('LOCKED\n');
    await new Promise<void>((resolve,reject)=>{
      timeout=setTimeout(()=>reject(new Error('Истекло время ожидания резервного копирования')),15*60*1000);
      process.stdin.once('data',()=>resolve());process.stdin.once('end',()=>resolve());process.stdin.resume();
    });
  }finally{
    if(timeout)clearTimeout(timeout);
    await connection.query('SELECT pg_advisory_unlock($1,$2)',[...MEDIA_BACKUP_LOCK]).catch(()=>{});
    await connection.release();await db.destroy();process.stdin.pause();
  }
}
holdBackupLock().catch(()=>{console.error('Не удалось удержать блокировку резервного копирования изображений');process.exitCode=1;});
