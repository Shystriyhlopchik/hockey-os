import 'reflect-metadata';
import {Module,Catch,ExceptionFilter,ArgumentsHost,HttpException} from '@nestjs/common';
import {NestFactory,APP_GUARD} from '@nestjs/core';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ConfigModule} from '@nestjs/config';
import {JwtModule} from '@nestjs/jwt';
import {DataSource} from 'typeorm';
import {json,static as staticFiles} from 'express';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {ENTITIES} from './entities';
import {Initial1794139200000} from './migrations/initial';
import {PlayerIdentity1794614400000} from './migrations/player-identity';
import {AppService} from './app.service';
import {AppController} from './app.controller';
import {SessionGuard} from './security';
import {seed} from './seed';
@Catch() class Errors implements ExceptionFilter {
  catch(e:any,host:ArgumentsHost){const res=host.switchToHttp().getResponse();const status=e instanceof HttpException?e.getStatus():e.code==='23505'?409:e.code==='23503'||e.code==='23514'?400:500;
    if(status===500)console.error(e);
    res.status(status).json({statusCode:status,message:e instanceof HttpException?e.message:status===409?'Такая запись уже существует':status===400?'Данные не прошли проверку':'Внутренняя ошибка сервера'});
  }
}
@Module({imports:[ConfigModule.forRoot({isGlobal:true,envFilePath:[resolve(process.cwd(),'.env'),resolve(process.cwd(),'../.env')]}),
  TypeOrmModule.forRootAsync({useFactory:()=>({type:'postgres' as const,url:process.env.DATABASE_URL,entities:ENTITIES,migrations:[Initial1794139200000,PlayerIdentity1794614400000],migrationsRun:true,synchronize:false,retryAttempts:3,retryDelay:1000})}),
  JwtModule.registerAsync({useFactory:()=>{if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)throw new Error('JWT_SECRET должен содержать минимум 32 символа');return {secret:process.env.JWT_SECRET,signOptions:{expiresIn:'8h'}};}})],
  controllers:[AppController],providers:[AppService,{provide:APP_GUARD,useClass:SessionGuard}]}) class AppModule {}
async function bootstrap(){
  const app=await NestFactory.create(AppModule,{bodyParser:false});app.setGlobalPrefix('api');app.use(json({limit:'1mb'}));
  app.getHttpAdapter().getInstance().disable('x-powered-by');app.use((req:any,res:any,next:any)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');next();});app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();await seed(app.get(DataSource));
  const frontend=resolve(__dirname,'../../frontend/dist/hockey/browser');
  if(existsSync(resolve(frontend,'index.html'))){const server=app.getHttpAdapter().getInstance();server.use(staticFiles(frontend));server.get('/{*path}',(req:any,res:any,next:any)=>{if(req.path==='/api'||req.path.startsWith('/api/'))return next();res.sendFile(resolve(frontend,'index.html'));});}
  await app.listen(Number(process.env.PORT||4100),process.env.HOST||'127.0.0.1');console.log(`Hockey OS: http://localhost:${process.env.PORT||4100}`);
}
bootstrap().catch(e=>{console.error('Не удалось запустить Hockey OS:',e.message);process.exit(1);});
