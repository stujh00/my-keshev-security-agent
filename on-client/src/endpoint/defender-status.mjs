// KESHEV Phase 9. Read-only Defender Operational log evidence; not XDR incidents.
import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&/^\d{4}-\d\d-\d\dT/.test(x);
const ids=new Map([[1116,{kind:'detection',title:'Defender 위협 탐지 이벤트'}],[1117,{kind:'action',title:'Defender 조치 수행 이벤트'}],[1118,{kind:'action_failed',title:'Defender 조치 실패 이벤트'}],[1119,{kind:'action_critical',title:'Defender 중요 조치 이벤트'}],[5007,{kind:'configuration',title:'Defender 설정 변경 이벤트'}]]);
const unavailable=(reason)=>({status:'unavailable',reason,source:'windows_defender_operational',freshness:'unknown',events:[],counts:{detection:0,action:0,action_failed:0,action_critical:0,configuration:0}});
export function projectDefender(raw,now=Date.now()){
  if(!raw||raw.schemaVersion!==1||raw.source!=='windows_defender_operational'||raw.sampleData!==false||!validTime(raw.collectedAt)||!['ok','disabled','unavailable'].includes(raw.status))return unavailable('INVALID_SCHEMA');
  const age=now-Date.parse(raw.collectedAt);
  const freshness=age < -120000?'future':age>10*60*1000?'stale':'recent';
  if(raw.status!=='ok')return {...unavailable(typeof raw.reason==='string'?raw.reason.slice(0,50):'READ_FAILED'),status:raw.status,collectedAt:raw.collectedAt,freshness};
  if(!Array.isArray(raw.events)||raw.events.length>200)return unavailable('INVALID_EVENTS');
  const counts={detection:0,action:0,action_failed:0,action_critical:0,configuration:0};
  const events=[];
  for(const entry of raw.events){
    if(!entry||!Number.isSafeInteger(entry.eventId)||!ids.has(entry.eventId)||!Number.isSafeInteger(entry.recordId)||entry.recordId<0||!validTime(entry.at))return unavailable('INVALID_EVENT');
    const info=ids.get(entry.eventId);counts[info.kind]++;
    // Phase 11: only bounded evidence from genuine 5007 events; old snapshots remain valid.
    const oldValue=entry.oldValue,newValue=entry.newValue;
    const validEvidence=value=>typeof value==='string'&&value.length>0&&value.length<=400&&!/[\x00-\x1f\x7f]/.test(value);
    const evidence=entry.eventId===5007&&validEvidence(oldValue)&&validEvidence(newValue)?{oldValue,newValue}:{};
    events.push({eventId:entry.eventId,recordId:entry.recordId,at:entry.at,kind:info.kind,title:info.title,...evidence});
  }
  events.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  return {status:'ok',source:raw.source,freshness,collectedAt:raw.collectedAt,counts,events:events.slice(0,30),limited:raw.limited===true,windowHours:24,note:'실제 Windows Defender Operational 감사 이벤트입니다. 중앙 XDR 사건 또는 침해 확정이 아닙니다.'};
}
export function projectOperationalWarnings(endpoint){
  const pc=endpoint?.pc;
  if(pc?.status!=='ok'||pc.freshness!=='recent')return {status:'unavailable',reason:'PC_MEASUREMENT_NOT_RECENT',warnings:[]};
  const warnings=[];
  if(typeof pc.memoryPercent==='number'&&pc.memoryPercent>=90&&pc.memoryPercent<=100)warnings.push({id:'MEMORY_HIGH',kind:'operational',severity:'warning',message:'메모리 사용률 90% 이상',value:pc.memoryPercent,unit:'%'});
  if(typeof pc.diskFreePercent==='number'&&pc.diskFreePercent<10&&pc.diskFreePercent>=0)warnings.push({id:'DISK_SPACE_LOW',kind:'operational',severity:'warning',message:'C: 드라이브 여유 공간 10% 미만',value:pc.diskFreePercent,unit:'%'});
  return {status:'ok',collectedAt:pc.collectedAt,warnings,note:'운영 경고는 보안 탐지 또는 침해 판단과 구분합니다.'};
}
export async function readDefenderStatus(){
  if(!process.env.LOCALAPPDATA)return unavailable('LOCALAPPDATA_UNAVAILABLE');
  const file=join(process.env.LOCALAPPDATA,'KeshevEndpoint','measurements','latest-defender.json');
  try{
    const st=await lstat(file);
    if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>100000)return unavailable('INVALID_FILE');
    return projectDefender(JSON.parse(await readFile(file,'utf8')));
  }catch(e){return unavailable(e?.code==='ENOENT'?'NOT_COLLECTED':'READ_FAILED')}
}
