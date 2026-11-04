// Phase 7.2: snapshot health is evidence of a completed collection, not process liveness.
import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const kinds=['pc','security'];
export function assessHeartbeat(raw,kind,now=Date.now()){
  const fail=(reason)=>({state:'unavailable',reason,kind,processState:'unverified'});
  if(!raw||raw.schemaVersion!==1||raw.source!=='keshev_collector_heartbeat'||raw.kind!==kind)return fail('INVALID_SCHEMA');
  if(!['ok','unavailable','failed'].includes(raw.status))return fail('INVALID_STATUS');
  if(!Number.isSafeInteger(raw.expectedIntervalSeconds)||raw.expectedIntervalSeconds<60||raw.expectedIntervalSeconds>86400)return fail('INVALID_INTERVAL');
  if(!Number.isSafeInteger(raw.processId)||raw.processId<1)return fail('INVALID_PID');
  if(typeof raw.collectedAt!=='string'||raw.collectedAt.length>64)return fail('INVALID_TIME');
  const date=Date.parse(raw.collectedAt);
  if(!Number.isFinite(date)||date>now+120000)return fail('INVALID_TIME');
  const ageSeconds=Math.max(0,Math.floor((now-date)/1000));
  const maxAge=raw.expectedIntervalSeconds*2+120;
  const stale=now-date>maxAge*1000;
  const reason=raw.status==='ok'?null:typeof raw.reason==='string'?raw.reason.slice(0,64):'COLLECTION_FAILED';
  return {state:stale?'stale':raw.status==='ok'?'recent':'problem',kind,status:raw.status,
    collectedAt:raw.collectedAt,ageSeconds,expectedIntervalSeconds:raw.expectedIntervalSeconds,
    reason:stale?'HEARTBEAT_STALE':reason,processId:raw.processId,processState:'unverified'};
}
export async function readCollectorHeartbeats(){
  const out={source:'local_collector_heartbeat',note:'수집기가 마지막으로 남긴 기록입니다. PID는 실행 중임을 증명하지 않습니다.',collectors:{}};
  for(const kind of kinds){
    if(!process.env.LOCALAPPDATA){out.collectors[kind]={state:'unavailable',reason:'NO_LOCALAPPDATA'};continue;}
    const f=join(process.env.LOCALAPPDATA,'KeshevEndpoint','measurements',`latest-heartbeat-${kind}.json`);
    try{
      const stat=await lstat(f);
      if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>8192){out.collectors[kind]={state:'unavailable',reason:'INVALID_FILE'};continue;}
      out.collectors[kind]=assessHeartbeat(JSON.parse(await readFile(f,'utf8')),kind);
    }catch(error){out.collectors[kind]={state:'unavailable',reason:error?.code==='ENOENT'?'NO_HEARTBEAT':'READ_FAILED'};}
  }
  return out;
}
