// KESHEV Phase 7: read-only observation snapshots from an explicitly run local supervisor.
import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const kinds=['pc','security'];
export function parseSupervisor(raw,now=Date.now()){
  if(!raw || raw.schemaVersion!==1 || raw.source!=='windows_process_observation' || typeof raw.collectedAt!=='string')return {state:'unavailable',reason:'INVALID_SCHEMA',collectors:{}};
  const stamp=Date.parse(raw.collectedAt);
  if(!Number.isFinite(stamp)||stamp>now+120000)return {state:'unavailable',reason:'INVALID_TIME',collectors:{}};
  const ageSeconds=Math.max(0,Math.floor((now-stamp)/1000));
  if(ageSeconds>150)return {state:'stale',reason:'OBSERVER_STALE',collectedAt:raw.collectedAt,ageSeconds,collectors:{}};
  const collectors={};
  for(const kind of kinds){
    const item=raw.collectors?.[kind];
    if(!item||!['observed','not_observed','unknown'].includes(item.state)||!Number.isSafeInteger(item.count)||item.count<0||item.count>1000)return {state:'unavailable',reason:'INVALID_COLLECTOR',collectors:{}};
    if((item.state==='observed'&&item.count===0)||(item.state!=='observed'&&item.count!==0))return {state:'unavailable',reason:'INVALID_COUNT',collectors:{}};
    collectors[kind]={state:item.state,count:item.count};
  }
  return {state:'recent',reason:null,collectedAt:raw.collectedAt,ageSeconds,collectors,
    note:'관측 시점의 Windows PowerShell 프로세스 조회 결과입니다. 접근 제한 및 짧게 실행되는 프로세스는 확인되지 않을 수 있습니다.'};
}
export async function readSupervisorStatus(){
  if(!process.env.LOCALAPPDATA)return {state:'unavailable',reason:'NO_LOCALAPPDATA',collectors:{}};
  const file=join(process.env.LOCALAPPDATA,'KeshevEndpoint','measurements','latest-supervisor.json');
  try{
    const st=await lstat(file);
    if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>16384)return {state:'unavailable',reason:'INVALID_FILE',collectors:{}};
    const raw=JSON.parse(await readFile(file,'utf8'));
    return parseSupervisor(raw);
  }catch(e){return {state:'unavailable',reason:e?.code==='ENOENT'?'NO_OBSERVATION':'READ_FAILED',collectors:{}};}
}
