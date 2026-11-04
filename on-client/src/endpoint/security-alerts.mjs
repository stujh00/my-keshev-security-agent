// KESHEV Phase 4: local Windows Security event detections, NOT connected XDR incidents.
import {lstat, readFile} from 'node:fs/promises';
import {join} from 'node:path';

const MAX_BYTES=1024*1024;
const MAX_AGE=10*60*1000;
const ids=new Set([4625,4740,1102,4720,4732]);
const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const parseDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const safeText=(value,max=72)=>typeof value==='string'?value.replace(/[\x00-\x1f\x7f]/g,'').slice(0,max):'';
export function detectSecurityEvents(entries) {
  const events=Array.isArray(entries)?entries.filter(x=>isObj(x)&&ids.has(x.eventId)&&Number.isSafeInteger(x.recordId)&&x.recordId>=0&&parseDate(x.at)!==null).slice(0,300):[];
  const sorted=events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const alerts=[];
  const failures=new Map();
  const push=(rule,severity,e,reason,records)=>alerts.push({id:`${rule}-${e.recordId}`,rule,severity,at:e.at,eventId:e.eventId,recordId:e.recordId,reason,evidenceRecordIds:records.slice(0,20)});
  for(const e of sorted){
    if(e.eventId===4625){
      const key=safeText(e.user).toLowerCase()+'|'+safeText(e.ip).toLowerCase();
      const bucket=(failures.get(key)||[]).filter(v=>Date.parse(e.at)-Date.parse(v.at)<=10*60*1000);
      bucket.push(e);failures.set(key,bucket);
      // One alert on threshold crossing; subsequent attempts must first leave the 10-min window.
      if(bucket.length===5)push('REPEATED_LOGON_FAILURE','medium',e,'동일 계정·IP 기준 10분 이내 로그인 실패 5회',bucket.map(x=>x.recordId));
    }else if(e.eventId===4740)push('ACCOUNT_LOCKOUT','medium',e,'Windows 계정 잠금 감사 이벤트', [e.recordId]);
    else if(e.eventId===1102)push('SECURITY_LOG_CLEARED','high',e,'Security 감사 로그 삭제 이벤트', [e.recordId]);
    else if(e.eventId===4720)push('ACCOUNT_CREATED','info',e,'사용자 계정 생성 감사 이벤트', [e.recordId]);
    else if(e.eventId===4732)push('LOCAL_GROUP_MEMBER_ADDED','info',e,'보안 로컬 그룹에 구성원 추가', [e.recordId]);
  }
  return alerts.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,100);
}
export function projectSecuritySnapshot(x,now=Date.now()){
  if(!isObj(x)||x.schemaVersion!==1||x.evidence!=='actual_windows_security_query'||x.sampleData!==false||parseDate(x.collectedAt)===null)return {status:'unavailable',reason:'INVALID_EVIDENCE'};
  const age=now-Date.parse(x.collectedAt);
  const freshness=age < -120000?'future':age>MAX_AGE?'stale':'recent';
  if(!['ok','unavailable','disabled'].includes(x.status))return {status:'unavailable',reason:'INVALID_STATUS',collectedAt:x.collectedAt,freshness};
  if(x.status!=='ok')return {status:x.status,reason:safeText(x.reason)||'READ_FAILED',collectedAt:x.collectedAt,freshness,alerts:[]};
  if(!Array.isArray(x.events)||x.events.length>300)return {status:'unavailable',reason:'INVALID_EVENT_LIST',collectedAt:x.collectedAt,freshness,alerts:[]};
  return {status:'ok',collectedAt:x.collectedAt,freshness,windowHours:24,scannedEvents:x.events.length,limited:x.limited===true,alerts:detectSecurityEvents(x.events),source:'windows_security_event_log',note:'로컬 Windows 감사 로그 기반 규칙 탐지이며 중앙 XDR 사건이나 공격 확정이 아닙니다.'};
}
export async function readLocalSecurityAlerts(){
  if(!process.env.LOCALAPPDATA)return {status:'unavailable',reason:'LOCALAPPDATA_UNAVAILABLE'};
  const file=join(process.env.LOCALAPPDATA,'KeshevEndpoint','measurements','latest-security.json');
  try{
    const st=await lstat(file);
    if(!st.isFile()||st.isSymbolicLink()||st.size===0||st.size>MAX_BYTES)return {status:'unavailable',reason:'INVALID_FILE'};
    const raw=await readFile(file,'utf8');
    if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)return {status:'unavailable',reason:'INVALID_FILE'};
    return projectSecuritySnapshot(JSON.parse(raw));
  }catch(e){return {status:'unavailable',reason:e?.code==='ENOENT'?'NOT_COLLECTED':'READ_FAILED'};}
}
