import {Component,Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {OFFICIAL_FIELDS,STAFF_FIELDS,SITUATIONS,periodSummary} from './protocol-sheet';

@Component({selector:'app-protocol-sheet',standalone:true,imports:[CommonModule],templateUrl:'./protocol-sheet.component.html'})
export class ProtocolSheetComponent {
  @Input() isDraft=true;
  @Input() protocol:any; @Input() match:any; @Input() tournament:any; @Input() teams:any[]=[]; @Input() players:any[]=[]; @Input() identities:any={};
  outcomes:Record<string,string>={regulation:'Основное время',draw:'Ничья',overtime:'Овертайм',shootout:'Броски для определения победителя',technical:'Технический результат'};
  officials=OFFICIAL_FIELDS; staffFields=STAFF_FIELDS;
  get summary(){return periodSummary(this.protocol,this.match,this.tournament.rules);}
  team(id:number){return this.teams.find(t=>t.id===id)?.name||'—';}
  name(id:number|null){return this.identities[id||0]?.name||this.players.find(p=>p.id===id)?.name||'—';}
  number(id:number|null){return [...this.protocol.homeRoster,...this.protocol.awayRoster].find(r=>r.playerId===id)?.number??'—';}
  get sides(){return [{id:this.match.homeTeamId,key:'homeRoster',staff:'homeStaff',letter:'А'},{id:this.match.awayTeamId,key:'awayRoster',staff:'awayStaff',letter:'Б'}];}
  situation(code:string){return SITUATIONS.find(([key])=>key===code)?.[1]||code;}
  onIce(ids:number[]|undefined){return ids?.map(id=>this.number(id)).join(', ')||'—';}
  date(value:string|null){return value?new Date(value).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'}):'Не назначено';}
  actual(value:string){return value?value.replace('T',' '):'—';}
}
