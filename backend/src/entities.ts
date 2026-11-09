import {Entity,PrimaryGeneratedColumn,Column,CreateDateColumn,UpdateDateColumn,Index} from 'typeorm';
import type {Role,Position,Qualification,Rules,Protocol,Result} from './domain';
export class Base { @PrimaryGeneratedColumn() id:number; @CreateDateColumn({type:'timestamptz'}) createdAt:Date; @UpdateDateColumn({type:'timestamptz'}) updatedAt:Date; }
@Entity('communities') export class Community extends Base {
  @Column({unique:true,default:true}) singleton:boolean;
  @Column() name:string; @Column() shortName:string; @Column() city:string;
  @Column({type:'text',default:''}) description:string; @Column({default:''}) email:string;
}
@Entity('seasons') export class Season extends Base { @Column() name:string; @Column({type:'date'}) startsOn:string; @Column({type:'date'}) endsOn:string; }
@Entity('users') export class User extends Base {
  @Column({unique:true}) username:string; @Column() displayName:string;
  @Column({select:false}) passwordHash:string; @Column({type:'varchar'}) role:Role;
  @Column({default:true}) active:boolean;
}
@Entity('assignments') @Index(['userId','tournamentId'],{unique:true}) export class Assignment extends Base {
  @Column() userId:number; @Column() tournamentId:number;
}
@Entity('teams') export class Team extends Base {
  @Column() name:string; @Column() city:string; @Column() abbreviation:string;
  @Column({default:'#17475b'}) color:string; @Column({type:'text',default:''}) description:string;
}
@Entity('players') export class Player extends Base {
  @Column() firstName:string; @Column() lastName:string; @Column({default:''}) middleName:string;
  @Column({type:'date'}) birthDate:string; @Column({type:'varchar'}) position:Position;
  @Column({type:'varchar'}) qualification:Qualification;
  @Column({default:false}) insured:boolean; @Column({default:false}) medicallyCleared:boolean;
}
@Entity('tournaments') export class Tournament extends Base {
  @Column() seasonId:number; @Column() name:string; @Column({unique:true}) slug:string;
  @Column({default:'18+'}) division:string; @Column({default:'draft'}) status:string;
  @Column({type:'jsonb'}) rules:Rules; @Column({type:'jsonb',default:()=>"'[]'"}) teamIds:number[];
  @Column({type:'text',default:''}) description:string;
  @Column({type:'jsonb',nullable:true}) qualificationSnapshot:any|null;
  @Column({type:'int',default:1}) version:number;
}
@Entity('registrations') export class Registration extends Base {
  @Column() tournamentId:number; @Column() teamId:number; @Column() playerId:number;
  @Column() number:number; @Column({default:''}) captain:string;
  @Column({default:true}) active:boolean; @Column({default:0}) transfers:number;
}
@Entity('series') export class Series extends Base {
  @Column() tournamentId:number; @Column() round:string; @Column() position:number;
  @Column({type:'int',nullable:true}) team1Id:number|null; @Column({type:'int',nullable:true}) team2Id:number|null;
  @Column() winsRequired:number; @Column({default:0}) wins1:number; @Column({default:0}) wins2:number;
  @Column({type:'int',nullable:true}) winnerId:number|null; @Column({default:'pending'}) status:string;
  @Column({type:'int',nullable:true}) nextSeriesId:number|null; @Column({type:'int',nullable:true}) nextSlot:number|null;
}
@Entity('matches') export class Match extends Base {
  @Column() tournamentId:number; @Column({type:'int',nullable:true}) homeTeamId:number|null; @Column({type:'int',nullable:true}) awayTeamId:number|null;
  @Column({default:'regular'}) stage:string; @Column({default:1}) round:number;
  @Column({type:'timestamptz',nullable:true}) startsAt:Date|null; @Column({default:90}) slotMinutes:number;
  @Column({default:'Новое Поколение'}) venue:string; @Column({default:'scheduled'}) status:string;
  @Column({type:'int',nullable:true}) homeScore:number|null; @Column({type:'int',nullable:true}) awayScore:number|null;
  @Column({type:'varchar',nullable:true}) resolution:string|null;
  @Column({type:'jsonb',nullable:true}) periodScores:Result['periodScores']|null;
  @Column({type:'int',nullable:true}) winnerId:number|null; @Column({type:'int',nullable:true}) seriesId:number|null;
  @Column({default:1}) gameNumber:number; @Column({default:0}) protocolVersion:number;
  @Column({type:'jsonb',nullable:true,select:false}) draft:Protocol|null;
  @Column({default:0}) draftVersion:number; @Column({type:'timestamptz',nullable:true}) publishedAt:Date|null;
}
@Entity('protocol_revisions') @Index(['matchId','version'],{unique:true}) export class Revision extends Base {
  @Column() matchId:number; @Column() version:number; @Column() actorId:number;
  @Column({type:'jsonb'}) protocol:Protocol; @Column({type:'jsonb'}) result:Result;
  @Column({type:'jsonb'}) identities:Record<string,{name:string;birthDate:string;position:Position}>;
  @Column({type:'text',default:''}) reason:string;
}
@Entity('audit') export class Audit extends Base {
  @Column({type:'int',nullable:true}) actorId:number|null; @Column({type:'int',nullable:true}) tournamentId:number|null;
  @Column() action:string; @Column() entity:string; @Column({type:'int',nullable:true}) entityId:number|null;
  @Column({type:'jsonb',default:()=>"'{}'"}) details:any;
}
@Entity('news') export class News extends Base {
  @Column() title:string; @Column({type:'text'}) body:string; @Column({default:'Сообщество'}) category:string;
  @Column({default:true}) published:boolean;
}
export const ENTITIES=[Community,Season,User,Assignment,Team,Player,Tournament,Registration,Series,Match,Revision,Audit,News];
