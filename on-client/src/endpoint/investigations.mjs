// Local investigation archive; separate from connected SDP/XDR incidents.
import {readLocalSecurityAlerts} from './security-alerts.mjs';
import {readFile,writeFile,rename,mkdir,lstat} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const MAX_RECORDS=500, MAX_BYTES=1024*1024;
const clean=(s,max=160)=>typeof s==='string'?s.replace(/[\x00-\x1f\x7f]/g,'').slice(0,max):'';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validId=x=>Number.isSafeInteger(x)&&x>=0;
const allowedRules=new Set(['REPEATED_LOGON_FAILURE','ACCOUNT_LOCKOUT','SECURITY_LOG_CLEARED','ACCOUNT_CREATED','LOCAL_GROUP_MEMBER_ADDED']);
const allowedSeverity=new Set(['high','medium','info']);
export function alertToRecord(a){
 if(!isObject(a)||!allowedRules.has(a.rule)||!allowedSeverity.has(a.severity)||!validId(a.recordId)||!validId(a.eventId)||!Number.isFinite(Date.parse(a.at)))return null;
 const ids=Array.isArray(a.evidenceRecordIds)?a.evidenceRecordIds.filter(validId).slice(0,20):[];
 return {id:`win-security:${a.rule}:${a.recordId}`,source:'windows_security_event_log',rule:a.rule,severity:a.severity,at:new Date(a.at).toISOString(),eventId:a.eventId,recordId:a.recordId,evidenceRecordIds:ids,reason:clean(a.reason),firstSeenAt:null,lastSeenAt:null};
}
export function mergeHistory(oldRecords,alerts,nowIso){
 const items=new Map();
 for(const o of Array.isArray(oldRecords)?oldRecords:[]){
  if(!isObject(o))continue;
  const r=alertToRecord(o);
  if(!r||o.id!==r.id)continue;
  items.set(r.id,{...r,firstSeenAt:clean(o.firstSeenAt,40)||r.at,lastSeenAt:clean(o.lastSeenAt,40)||r.at});
 }
 let added=0;
 for(const a of Array.isArray(alerts)?alerts:[]){
  const r=alertToRecord(a);if(!r)continue;
  const old=items.get(r.id);
  if(!old){added++;items.set(r.id,{...r,firstSeenAt:nowIso,lastSeenAt:nowIso});}
  // An existing detection is a single incident; repeated polling must not duplicate it.
 }
 const records=[...items.values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,MAX_RECORDS);
 return {records,added};
}
async function readHistory(file){
 try{
  const st=await lstat(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size>MAX_BYTES||st.size===0)throw Error('INVALID_HISTORY_FILE');
  const x=JSON.parse(await readFile(file,'utf8'));
  if(!isObject(x)||x.schemaVersion!==1||!Array.isArray(x.records)||x.records.length>MAX_RECORDS)throw Error('INVALID_HISTORY_DATA');
  return x.records;
 }catch(e){if(e.code==='ENOENT')return [];throw e;}
}
// Serializes read-modify-write updates inside the running server process.
let queue=Promise.resolve();
export async function readLocalInvestigations(options={}){
 const base=options.baseDir??(process.env.LOCALAPPDATA&&join(process.env.LOCALAPPDATA,'KeshevEndpoint','investigations'));
 if(!base)return {status:'unavailable',reason:'LOCALAPPDATA_UNAVAILABLE',records:[]};
 const snapshot=options.snapshot??await readLocalSecurityAlerts();
 if(!isObject(snapshot))return {status:'unavailable',reason:'SNAPSHOT_INVALID',records:[]};
 const file=join(base,'history-v1.json');
 const task=async()=>{
  let history;
  try{history=await readHistory(file);}catch{return {status:'unavailable',reason:'HISTORY_READ_FAILED',sourceStatus:snapshot.status||'unavailable',records:[]};}
  const sourceOk=snapshot.status==='ok'&&snapshot.freshness==='recent'&&Array.isArray(snapshot.alerts);
  let added=0;
  if(sourceOk){
   const merged=mergeHistory(history,snapshot.alerts,new Date().toISOString());
   if(merged.added>0){
    const payload=JSON.stringify({schemaVersion:1,updatedAt:new Date().toISOString(),records:merged.records});
    if(Buffer.byteLength(payload,'utf8')>MAX_BYTES)return {status:'unavailable',reason:'HISTORY_SIZE_LIMIT',records:[]};
    const temp=file+'.'+randomUUID()+'.tmp';
    try{await mkdir(dirname(file),{recursive:true});await writeFile(temp,payload,{encoding:'utf8',flag:'wx'});await rename(temp,file);}catch{return {status:'unavailable',reason:'HISTORY_WRITE_FAILED',records:history};}
   }
   history=merged.records;added=merged.added;
  }
  return {status:'ok',sourceStatus:snapshot.status||'unavailable',sourceFreshness:snapshot.freshness||'unknown',sourceReason:snapshot.reason||null,historyCapture:sourceOk?'active':'paused',added,records:history,historyCount:history.length,source:'windows_security_event_log',collectionMode:'read_triggered',note:'조회 시 최신 로컬 보안 탐지 결과만 저장. 이력은 XDR 엔진 사건과 별개이며 실제 침해 판정이 아닙니다.'};
 };
 const p=queue.then(task,task);queue=p.then(()=>{},()=>{});return p;
}
