import type {Protocol} from './domain';

// The same paths drive saved-history checks and locks taken before saving a protocol.
const playerPaths:readonly (readonly string[])[]=[
  ['homeRoster','playerId'],['awayRoster','playerId'],
  ['goals','scorerId'],['goals','assist1Id'],['goals','assist2Id'],['goals','homeOnIce'],['goals','awayOnIce'],
  ['penalties','playerId'],['penalties','servedById'],['goalieShifts','playerId'],
  ['shootout','playerId'],['shootout','goalieId'],['sheet','missedShots','playerId'],['sheet','missedShots','goalieId'],
];
export function protocolPlayerIds(protocol:Protocol):number[]{
  const read=(value:any,path:readonly string[]):unknown[]=>{
    if(Array.isArray(value))return value.flatMap(item=>read(item,path));
    if(!path.length)return [value];
    return value&&typeof value==='object'?read(value[path[0]],path.slice(1)):[];
  };
  return [...new Set(playerPaths.flatMap(path=>read(protocol,path)).filter((id):id is number=>Number.isSafeInteger(id)&&(id as number)>0))].sort((a,b)=>a-b);
}
export function playerProtocolNeedles(id:number):string[]{
  return playerPaths.map(path=>{
    let value:any=['homeOnIce','awayOnIce'].includes(path[path.length-1])?[id]:id;
    for(let i=path.length-1;i>=0;i--){
      if(i<path.length-1&&path[i]!=='sheet')value=[value];
      value={[path[i]]:value};
    }
    return JSON.stringify(value);
  });
}
