// Local-only, read-only projection of KESHEV Windows measurements.
// This is NOT SDP identity, ZTNA access evidence or an XDR detection engine.
import { readFile, lstat } from 'node:fs/promises';
import { join } from 'node:path';

const baseDir = join(process.env.LOCALAPPDATA || '', 'KeshevEndpoint', 'measurements');
const MAX_BYTES = 256 * 1024;
const MAX_AGE_MS = 10 * 60 * 1000;
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const count = x => Number.isSafeInteger(x) && x >= 0 && x <= 1000000 ? x : null;
const pct = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100 ? x : null;
const freeGb = x => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x < 1e9 ? x : null;
const kind = x => x === 'ok' || x === 'partial' ? x : 'unavailable';
const metric = (x, key, valid) => isObj(x) && x.status === 'ok' ? valid(x[key]) : null;
const time = x => {
  if(typeof x !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(x)) return null;
  const ms=Date.parse(x);return Number.isFinite(ms) ? ms : null;
};
const freshness = collectedAt => {
  const ms=time(collectedAt);
  if(ms===null)return 'unverifiable';
  const age=Date.now()-ms;
  return age < -2*60*1000 ? 'future' : age > MAX_AGE_MS ? 'stale' : 'recent';
};

async function readSnapshot(filename) {
  if(!process.env.LOCALAPPDATA)return {status:'unavailable',reason:'LOCALAPPDATA_UNAVAILABLE'};
  const path=join(baseDir,filename);
  try {
    const info=await lstat(path);
    if(!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES || info.size === 0) return {status:'unavailable',reason:'INVALID_FILE'};
    const raw=await readFile(path,'utf8');
    if(Buffer.byteLength(raw,'utf8')>MAX_BYTES)return {status:'unavailable',reason:'INVALID_FILE'};
    const obj=JSON.parse(raw);
    if(!isObj(obj) || obj.schemaVersion!==1 || obj.evidence!=='actual_windows_query' || obj.sampleData!==false || time(obj.collectedAt)===null)
      return {status:'unavailable',reason:'INVALID_EVIDENCE'};
    return {status:'ok',data:obj};
  } catch(e) {
    return {status:'unavailable',reason:e?.code==='ENOENT'?'NOT_COLLECTED':'READ_FAILED'};
  }
}
const safeText = s => typeof s==='string' ? s.slice(0,96) : 'unknown';
const eventStats = x => isObj(x) && x.status==='ok' ? {warning:count(x.warningCount),error:count(x.errorCount)} : {warning:null,error:null};

export async function readLocalEndpointTelemetry() {
  const [pcFile,networkFile]=await Promise.all([readSnapshot('latest-pc.json'),readSnapshot('latest-connection.json')]);
  const projectPc = item => {
    if(item.status!=='ok')return {status:'unavailable',reason:item.reason};
    const x=item.data;
    return {status:'ok',collectedAt:x.collectedAt,freshness:freshness(x.collectedAt),
      cpuPercent:metric(x.cpu,'percent',pct),memoryPercent:metric(x.memory,'percent',pct),
      diskFreeGB:metric(x.diskC,'freeGB',freeGb),diskFreePercent:metric(x.diskC,'freePercent',pct)};
  };
  const projectConnection = item => {
    if(item.status!=='ok')return {status:'unavailable',reason:item.reason};
    const x=item.data;
    const adapters=isObj(x.network)&&x.network.status==='ok'&&Array.isArray(x.network.adapters)
      ? x.network.adapters.slice(0,32).filter(isObj).map(a=>({name:safeText(a.name),status:safeText(a.status),linkSpeed:safeText(a.linkSpeed)})) : [];
    const firewall=isObj(x.firewall)&&x.firewall.status==='ok'&&Array.isArray(x.firewall.profiles)
      ? x.firewall.profiles.slice(0,8).filter(isObj).map(p=>({name:safeText(p.name),enabled:typeof p.enabled==='boolean'?p.enabled:null})) : [];
    const e=isObj(x.windowsEvents)?x.windowsEvents:{};
    return {status:'ok',collectedAt:x.collectedAt,freshness:freshness(x.collectedAt),
      networkStatus:kind(x.network?.status),adapters,
      firewallStatus:kind(x.firewall?.status),firewall,
      windowsEventStatus:kind(e.status),windowHours:x.windowHours===24?24:null,
      system:eventStats(e.system),application:eventStats(e.application)};
  };
  return {source:'local_windows_measurement',realtime:false,autoCollection:false,pc:projectPc(pcFile),connection:projectConnection(networkFile)};
}
