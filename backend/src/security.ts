import {CanActivate,ExecutionContext,Injectable,UnauthorizedException,ForbiddenException,SetMetadata} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {JwtService} from '@nestjs/jwt';
import {DataSource} from 'typeorm';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import type {Request} from 'express';
import {User} from './entities';
export const Public=()=>SetMetadata('public',true);
export function hashPassword(password:string):string {const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function verifyPassword(password:string,hash:string):boolean {try {const [salt,key]=hash.split(':');return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));}catch{return false;}}
export type Actor=Pick<User,'id'|'username'|'displayName'|'role'>;
export type AuthRequest=Request&{actor:Actor};
@Injectable() export class SessionGuard implements CanActivate {
  constructor(private reflector:Reflector,private jwt:JwtService,private db:DataSource){}
  async canActivate(context:ExecutionContext):Promise<boolean>{
    const req=context.switchToHttp().getRequest<AuthRequest>();
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){
      const allowed=[process.env.FRONTEND_ORIGIN||'http://localhost:4300','http://127.0.0.1:4300',`http://localhost:${process.env.PORT||4100}`,`http://127.0.0.1:${process.env.PORT||4100}`];
      if(!allowed.includes(req.headers.origin))throw new ForbiddenException('Недопустимый источник запроса');
    }
    if(this.reflector.getAllAndOverride<boolean>('public',[context.getHandler(),context.getClass()]))return true;
    const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('hockey_session='))?.slice(15);
    if(!cookie)throw new UnauthorizedException('Войдите в служебный кабинет');
    try {
      const token=await this.jwt.verifyAsync(cookie);
      const user=await this.db.getRepository(User).findOneBy({id:token.sub,active:true});
      if(!user)throw new Error();req.actor={id:user.id,username:user.username,displayName:user.displayName,role:user.role};return true;
    } catch {throw new UnauthorizedException('Сессия завершилась. Войдите снова');}
  }
}
