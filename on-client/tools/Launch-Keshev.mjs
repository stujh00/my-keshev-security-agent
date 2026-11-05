#!/usr/bin/env node
// KESHEV unified local operator. No privilege escalation, services, scheduled tasks or outbound upload.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const agent=path.join(root,'agent');
const tools=path.join(root,'tools');
const native=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'ALEPH','KeshevNativeHost','native.json');
const runtime=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'KeshevEndpoint','launcher');
const sessionPath=path.join(runtime,'session.json');
const webPort=5190;
const webUrl=`http://127.0.0.1:${webPort}/`;
export function serverArgs(nativePath){return fs.existsSync(nativePath)?['-Port',String(webPort),'-NativeHostConfig',nativePath]:['-Port',String(webPort),'-NoNativeHost'];}
const specs=[
 {name:'server',file:path.join(tools,'start-alekov.ps1'),args:serverArgs(native)},
 {name:'pc',file:path.join(agent,'Run-KeshevEndpoint.ps1'),args:['-Watch']},
 {name:'supervisor',file:path.join(agent,'Watch-KeshevSupervisor.ps1'),args:[]},
];
const securityFile=path.join(agent,'Collect-KeshevSecurity.ps1');

let securityRequestInFlight=false;
// Hold off repeat requests while Windows and Supervisor discover the newly elevated process.
// An elevation timeout is ambiguous: do not try again automatically in this launcher session.
let securityLaunchPendingUntil=0;
export function securityElevationGate({inFlight=false,now=Date.now(),pendingUntil=0}={}){
 if(inFlight)return 'ELEVATION_IN_PROGRESS';
 if(now<pendingUntil)return 'ELEVATION_PENDING_VERIFICATION';
 return null;
}
// Fixed allowlisted elevation target. Never accept process names, script paths or arguments from HTTP.
function securityElevationCommand(){
 const encodedPath=Buffer.from(securityFile,'utf8').toString('base64');
 return `
$ErrorActionPreference='Stop'
$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'))
if(-not(Test-Path -LiteralPath $p -PathType Leaf)){Write-Host 'KESHEV_COLLECTOR_MISSING';exit 2}
try {
  $arguments='-NoProfile -ExecutionPolicy Bypass -File "' + $p.Replace('"','') + '" -Watch'
  $child=Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -Verb RunAs -ArgumentList $arguments -PassThru -ErrorAction Stop
  if(-not $child -or -not $child.Id){throw 'NO_ELEVATED_PROCESS'}
  Write-Host 'KESHEV_ELEVATION_REQUEST_ACCEPTED'
  exit 0
} catch {
  $nativeCode=0
  try {$nativeCode=[int]$_.Exception.NativeErrorCode} catch {}
  $win32Code=0
  try {$win32Code=([int64]$_.Exception.HResult -band 65535)} catch {}
  if($nativeCode -eq 1223 -or $win32Code -eq 1223 -or $_.Exception.Message -match 'canceled by the user|cancelled by the user|operation was canceled|operation was cancelled|1223'){Write-Host 'KESHEV_UAC_CANCELLED'}
  else {Write-Host 'KESHEV_ELEVATION_FAILED'}
  exit 1
}`;
}
async function requestSecurityElevation(){
 const gate=securityElevationGate({inFlight:securityRequestInFlight,pendingUntil:securityLaunchPendingUntil});
 if(gate)return {ok:false,code:gate};
 if(!fs.existsSync(securityFile))return {ok:false,code:'SECURITY_COLLECTOR_MISSING'};
 const scan=scanSecurityProcesses();
 if(scan.state!=='not_observed')return {ok:false,code:scan.state==='observed'?'ALREADY_RUNNING':'PROCESS_UNVERIFIABLE'};
 securityRequestInFlight=true;
 try{
   return await new Promise(resolve=>{
     let stdout='',stderr='',settled=false;
     const finish=out=>{
       if(settled)return;
       settled=true;clearTimeout(timer);
       if(out.ok)securityLaunchPendingUntil=Date.now()+120000;
       // Timeout cannot prove the user declined; prevent further elevation in this session.
       if(out.code==='ELEVATION_TIMEOUT')securityLaunchPendingUntil=Number.POSITIVE_INFINITY;
       securityRequestInFlight=false;resolve(out);
     };
     const command=securityElevationCommand();
     const encoded=Buffer.from(command,'utf16le').toString('base64');
     const child=spawn(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',encoded],
       {cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
     const timer=setTimeout(()=>{try{child.kill()}catch{}finish({ok:false,code:'ELEVATION_TIMEOUT'})},100000);
     child.stdout?.on('data',d=>{stdout=(stdout+String(d)).slice(-4000)});
     child.stderr?.on('data',d=>{stderr=(stderr+String(d)).slice(-4000)});
     child.on('error',()=>finish({ok:false,code:'ELEVATION_LAUNCH_FAILED'}));
     child.on('exit',code=>finish(code===0&&stdout.includes('KESHEV_ELEVATION_REQUEST_ACCEPTED')?
       {ok:true,code:'UAC_LAUNCHED_NOT_VERIFIED'}:{ok:false,code:stdout.includes('KESHEV_UAC_CANCELLED')?'UAC_DECLINED':'ELEVATION_FAILED'}));
   });
 }catch{securityRequestInFlight=false;return {ok:false,code:'ELEVATION_FAILED'}}
}
function scanSecurityProcesses(){
 const ps=`$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Depth 3 -Compress`;
 const p=spawnSync(powershell,['-NoProfile','-NonInteractive','-Command',ps],{encoding:'utf8',timeout:12000,maxBuffer:3e6,windowsHide:true});
 if(p.status!==0||p.error)return {state:'unknown'};
 try{
   let items=JSON.parse(p.stdout.trim()||'[]');if(!Array.isArray(items))items=[items];
   if(items.some(x=>/Collect-KeshevSecurity\.ps1/i.test(String(x.CommandLine||''))))return {state:'observed'};
   return {state:items.some(x=>!x.CommandLine)?'unknown':'not_observed'};
 }catch{return {state:'unknown'}}
}
const powershell='powershell.exe';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
export function validSession(o){return Boolean(o&&o.version===1&&Number.isInteger(o.port)&&o.port>=1024&&o.port<=65535&&typeof o.token==='string'&&/^[0-9a-f-]{36}$/i.test(o.token)&&Number.isInteger(o.pid)&&o.pid>0)}
export function procMatch(command){const s=String(command||'');return /(?:[\\/\s"'])(?:Run-KeshevEndpoint|Start-KeshevAutoCollect|Watch-KeshevSupervisor)\.ps1(?=[\s"']|$)/i.test(s)}
function fileCheck(){for(const s of specs)if(!fs.existsSync(s.file))throw Error(`필수 파일 없음: ${s.file}`);}
function jsonRead(p){try{return JSON.parse(fs.readFileSync(p,'utf8'));}catch{return null;}}
function statusMessage(){const data=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'KeshevEndpoint','measurements');for(const [name,file] of [['PC Heartbeat','latest-heartbeat-pc.json'],['Security Heartbeat','latest-heartbeat-security.json'],['Supervisor','latest-supervisor.json']]){const value=jsonRead(path.join(data,file));const at=value?.collectedAt||value?.timestamp||value?.lastAt;console.log(`  ${name}: ${at||'기록 없음'} (최근 기록이 실행 중임을 증명하지는 않음)`);}console.log('  Security 수집기: 자동 시작하지 않음 (관리자 권한 필요)');}
async function freePort(port){return new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve(false));server.listen({host:'127.0.0.1',port,exclusive:true},()=>server.close(()=>resolve(true)));});}
async function httpAlive(url){try{const r=await fetch(url,{signal:AbortSignal.timeout(1200)});return r.status>=200&&r.status<500;}catch{return false;}}
async function controlRequest(session,kind){return new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port:session.port});let output='';let ended=false;const finish=(val)=>{if(ended)return;ended=true;socket.destroy();resolve(val)};socket.setTimeout(2200,()=>finish(null));socket.on('error',()=>finish(null));socket.on('connect',()=>socket.write(JSON.stringify({token:session.token,kind})+'\n'));socket.on('data',d=>{output+=String(d);if(output.includes('\n')){try{finish(JSON.parse(output.trim()));}catch{finish(null)}}});socket.on('end',()=>finish(null));});}
function scanProcesses(){const ps=`$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process -Filter \"Name = 'powershell.exe' OR Name = 'pwsh.exe'\" | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Depth 3 -Compress`;
 const p=spawnSync(powershell,['-NoProfile','-NonInteractive','-Command',ps],{encoding:'utf8',timeout:12000,maxBuffer:3e6,windowsHide:true});if(p.status!==0||p.error)return {warning:'프로세스 목록 조회 불가',matched:[],hidden:0};try{let rows=JSON.parse(p.stdout.trim()||'[]');if(!Array.isArray(rows))rows=[rows];return {warning:null,matched:rows.filter(x=>procMatch(x.CommandLine)),hidden:rows.filter(x=>!x.CommandLine).length};}catch{return {warning:'프로세스 목록 해석 불가',matched:[],hidden:0}}}
function killOwned(pid){if(!Number.isInteger(pid)||pid<1)return;const p=spawnSync('taskkill.exe',['/PID',String(pid),'/T','/F'],{encoding:'utf8',windowsHide:true,timeout:5000});if(p.error)console.warn('종료 요청 오류:',p.error.message);}
function startChild(spec,session){const child=spawn(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',spec.file,...spec.args],{cwd:root,windowsHide:false,stdio:['ignore','pipe','pipe'],env:spec.name==='server'?{...process.env,KESHEV_LAUNCHER_CONTROL_PORT:String(session.port),KESHEV_LAUNCHER_CONTROL_TOKEN:session.token}:process.env});for(const kind of ['stdout','stderr'])child[kind].on('data',buffer=>{for(const line of String(buffer).split(/\r?\n/)){if(line)console.log(`[${spec.name}] ${line}`);}});return child;}
async function start(){if(process.platform!=='win32')throw Error('Windows에서만 실행할 수 있습니다.');fileCheck();fs.mkdirSync(runtime,{recursive:true});const prior=jsonRead(sessionPath);if(validSession(prior)){const res=await controlRequest(prior,'status');if(res?.ok)throw Error(`이미 통합 실행기가 동작 중입니다 (PID ${prior.pid}).`);console.warn('이전 실행 기록이 남아 있습니다. 활성 실행기가 아니므로 새 세션을 시작합니다.');}
 if(!(await freePort(webPort)))throw Error(`포트 ${webPort} 사용 중입니다. 이전 웹서버를 종료한 뒤 다시 실행하세요. 다른 프로세스는 종료하지 않았습니다.`);
 const scan=scanProcesses();if(scan.matched.length)throw Error(`기존 PC 수집기 또는 Supervisor가 보입니다 (PID: ${scan.matched.map(x=>x.ProcessId).join(', ')}). 중복 방지를 위해 시작을 중단합니다.`);
 if(scan.warning)console.warn('[주의] '+scan.warning);if(scan.hidden)console.warn(`[주의] 명령줄 확인 불가 PowerShell ${scan.hidden}개: 숨겨진 수집기 중복 여부는 판단할 수 없습니다.`);
 const children=[];let shutting=false;let controller;let ownSession;
 async function shutdown(reason){if(shutting)return;shutting=true;console.log(`\nKESHEV 종료: ${reason}`);for(const x of [...children].reverse()){if(x.child.pid){console.log(`종료: ${x.name} (PID ${x.child.pid})`);killOwned(x.child.pid);}}if(controller)controller.close();const existing=jsonRead(sessionPath);if(existing?.token===ownSession?.token){try{fs.unlinkSync(sessionPath);}catch{}}console.log('케셰브 통합 실행기 종료 완료. Security 수집기는 별도 관리됩니다.');process.exitCode=0;}
 process.on('SIGINT',()=>void shutdown('Ctrl+C'));process.on('SIGTERM',()=>void shutdown('SIGTERM'));
 controller=net.createServer(socket=>{let s='';socket.setEncoding('utf8');socket.setTimeout(1500,()=>socket.destroy());socket.on('data',chunk=>{s+=chunk;if(s.length>2048){socket.destroy();return;}if(!s.includes('\n'))return;let req;try{req=JSON.parse(s.trim());}catch{socket.end('{"ok":false}\n');return;}if(req.token!==ownSession.token){socket.end('{"ok":false}\n');return;}if(req.kind==='security-start'){
   socket.setTimeout(108000,()=>socket.destroy());
   if(shutting){socket.end(JSON.stringify({ok:false,code:'LAUNCHER_SHUTTING_DOWN'})+'\n');return;}
   void requestSecurityElevation().then(result=>{if(!socket.destroyed)socket.end(JSON.stringify(result)+'\n')});return;
  }
  if(req.kind!=='status'&&req.kind!=='stop'){socket.end('{"ok":false,"code":"UNSUPPORTED_ACTION"}\n');return;}
  socket.end(JSON.stringify({ok:true,pid:process.pid,kind:req.kind})+'\n');if(req.kind==='stop')setImmediate(()=>void shutdown('종료 파일 요청'));});});
 await new Promise((resolve,reject)=>{controller.once('error',reject);controller.listen(0,'127.0.0.1',resolve)});
 ownSession={version:1,port:controller.address().port,token:randomUUID(),pid:process.pid,createdAt:new Date().toISOString()};
 fs.writeFileSync(sessionPath,JSON.stringify(ownSession,null,2),{encoding:'utf8',mode:0o600});
 try{for(const spec of specs){if(shutting)break;const child=startChild(spec,ownSession);children.push({name:spec.name,child});console.log(`시작: ${spec.name} (PID ${child.pid||'확인 불가'})`);child.once('error',e=>{console.error(`${spec.name}: ${e.message}`);void shutdown('프로세스 오류')});child.once('exit',(code)=>{if(!shutting){console.error(`${spec.name} 프로세스가 종료됐습니다 (code=${code}).`);void shutdown('프로세스 조기 종료');}});await sleep(350);}
  let alive=false;for(let i=0;i<25&&!shutting;i++){if(await httpAlive(webUrl)){alive=true;break;}await sleep(400);}if(!alive&&!shutting)throw Error('웹서버 응답 확인 실패: '+webUrl);
  if(!shutting){console.log('\n케셰브 통합 실행 완료: '+webUrl);console.log('PC 수집기 + Supervisor 실행 중 / Security 수집기는 자동 시작하지 않음');statusMessage();console.log('이 창에서 Ctrl+C로 종료하거나 Stop-Keshev.cmd를 실행하세요.');try{spawn('explorer.exe',[webUrl],{stdio:'ignore',detached:true}).unref()}catch{console.log('브라우저에서 직접 열기: '+webUrl)}}
 }catch(e){console.error('시작 실패:',e.message);await shutdown('시작 실패');process.exitCode=1;}
}
async function stop(){const session=jsonRead(sessionPath);if(!validSession(session)){console.log('현재 통합 실행 기록이 없습니다. 외부 프로세스는 종료하지 않습니다.');return;}const r=await controlRequest(session,'stop');if(r?.ok)console.log(`종료 요청 전달 완료 (통합 실행기 PID ${r.pid}).`);else console.log('활성 통합 실행기가 확인되지 않습니다. 저장된 PID로 강제 종료하지 않았습니다.');}
async function status(){const s=jsonRead(sessionPath);const r=validSession(s)?await controlRequest(s,'status'):null;console.log(r?.ok?`통합 실행기 실행 중 (PID ${r.pid})`:'통합 실행기 실행 확인 안 됨');statusMessage();}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const command=process.argv[2]||'start';try{if(command==='start')await start();else if(command==='stop')await stop();else if(command==='status')await status();else throw Error('사용법: start | stop | status')}catch(e){console.error('STOP:',e.message);process.exitCode=1;}}
