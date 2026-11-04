// Phase 6: informational monitoring only. Snapshot recency is NOT process liveness.
import {readLocalEndpointTelemetry} from './local-telemetry.mjs';
import {readSupervisorStatus} from './supervisor-status.mjs';
import {readCollectorHeartbeats} from './collector-heartbeats.mjs';
import {readDefenderStatus,projectOperationalWarnings} from './defender-status.mjs';
import {readLocalSecurityAlerts} from './security-alerts.mjs';
import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';

export function assessSnapshot(item,now=Date.now()){
  const status=item?.status==='ok'?'ok':item?.status==='disabled'?'disabled':'unavailable';
  const at=typeof item?.collectedAt==='string'?item.collectedAt:null;
  const t=at===null?NaN:Date.parse(at);
  const valid=Number.isFinite(t);
  const ageSeconds=valid?Math.max(0,Math.floor((now-t)/1000)):null;
  const freshness=valid?(t-now>120000?'future':now-t>600000?'stale':'recent'):'unverifiable';
  return {status,freshness,collectedAt:valid?at:null,ageSeconds,reason:status==='ok'?null:String(item?.reason||'UNAVAILABLE').slice(0,64),processState:'unknown'};
}
export async function projectAgentOperations({endpoint,security,historyCount}={},now=Date.now()){
  const pc=assessSnapshot(endpoint?.pc,now),connection=assessSnapshot(endpoint?.connection,now),audit=assessSnapshot(security,now);
  return {source:'local_measurement_files',processObservation:false,pollIntervalSeconds:60,expectedCollectionSeconds:300,
    collectors:{pc,connection,security:audit},
    investigations:{status:Number.isSafeInteger(historyCount)&&historyCount>=0?'ok':'unknown',count:Number.isSafeInteger(historyCount)&&historyCount>=0?historyCount:null},
    note:'최종 수집 시각만 확인했습니다. 프로세스 실행 여부나 5분 주기 동작은 이 API로 판단할 수 없습니다.'};
}
async function readHistoryCount(){
  if(!process.env.LOCALAPPDATA)return null;
  const file=join(process.env.LOCALAPPDATA,'KeshevEndpoint','investigations','history-v1.json');
  try{
    const st=await lstat(file);if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>1048576)return null;
    const raw=JSON.parse(await readFile(file,'utf8'));
    if(raw?.schemaVersion!==1||!Array.isArray(raw.records)||raw.records.length>500)return null;
    return raw.records.length;
  }catch(e){if(e?.code==='ENOENT')return 0;return null;}
}
export async function readAgentOperations(){
  const [endpoint,security,historyCount]=await Promise.all([readLocalEndpointTelemetry(),readLocalSecurityAlerts(),readHistoryCount()]);
  const result=await projectAgentOperations({endpoint,security,historyCount});
  result.supervisor=await readSupervisorStatus();
  result.heartbeats=await readCollectorHeartbeats();
  result.defender=await readDefenderStatus();
  result.operationalWarnings=projectOperationalWarnings(endpoint);
  result.processObservation=result.supervisor.state==='recent';
  return result;
}
