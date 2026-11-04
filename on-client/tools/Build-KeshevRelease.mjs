#!/usr/bin/env node
// Phase 14.2 - builds a preview without modifying the original project.
// No network, telemetry, secrets, registry writes or elevation.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(process.env.KESHEV_REPO||path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'ALEPH','Workbench','projects','케셰브-방어전'));
const source=path.join(repo,'on-client');
const resultDir=path.resolve(process.env.KESHEV_RELEASE_DIR||path.join(process.env.USERPROFILE||os.homedir(),'Downloads','KESHEV-Portable-Release'));
const includeDirs=new Set(['agent','public','src','student','tools']);
const allowedSingle=new Set(['package.json']);
const excludedFiles=/^(?:\.env(?:\..*)?|native\.json|.*\.(?:pfx|p12|pem|key|cer|crt|p7b|p8|p11|log|sqlite|db)|.*(?:\.before-|\.backup|\.bak|\.tmp|~$).*)$/i;
const excludedDirs=new Set(['.git','node_modules','measurements','logs','telemetry','credentials','secrets','backups','.next','dist','build']);
function allow(relative,isDir){
  const parts=relative.split(/[\\/]+/).filter(Boolean);
  if(!parts.length)return false;
  if(parts.some(p=>excludedDirs.has(p.toLowerCase())))return false;
  if(parts.some(p=>excludedFiles.test(p)))return false;
  if(isDir)return includeDirs.has(parts[0]);
  if(parts.length===1)return allowedSingle.has(parts[0]);
  return includeDirs.has(parts[0]);
}
function assertNode(){
  if(process.platform!=='win32'||process.arch!=='x64')throw Error('현재 빌더는 Windows x64만 지원합니다.');
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major!==24||minor<19)throw Error(`Node.js 24.19 이상 24.x가 필요합니다. 현재 ${process.version}`);
  if(path.basename(process.execPath).toLowerCase()!=='node.exe')throw Error('Node.exe 실행 환경을 확인할 수 없습니다.');
}
async function getNodeLicense(){
  const local=[path.join(path.dirname(process.execPath),'LICENSE'),path.join(path.dirname(process.execPath),'LICENSE.md'),path.join(path.dirname(process.execPath),'..','LICENSE'),path.join(scriptDir,'NODE-LICENSE.txt')].find(p=>fs.statSync(p,{throwIfNoEntry:false})?.isFile());
  if(local)return fs.readFileSync(local);
  const url=`https://raw.githubusercontent.com/nodejs/node/v${process.versions.node}/LICENSE`;
  console.log('[INFO] Local Node license missing. Retrieving official Node.js license only: '+url);
  const response=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!response.ok)throw Error('Node.js 라이선스를 확인할 수 없습니다. 공식 Node.js 버전의 LICENSE를 도구 폴더에 NODE-LICENSE.txt로 저장한 뒤 다시 시도하세요.');
  const content=Buffer.from(await response.arrayBuffer());
  if(content.length<1000||content.length>2000000||!content.toString('utf8',0,350).includes('Node.js'))throw Error('Node.js 라이선스 응답 내용이 예상과 다릅니다. 중단합니다.');
  return content;
}
function walk(dir,rel='',found=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const next=rel?path.join(rel,ent.name):ent.name;
    if(!allow(next,ent.isDirectory()))continue;
    if(ent.isSymbolicLink())throw Error(`링크 파일/폴더가 있어 중단: ${next}`);
    if(ent.isDirectory())walk(path.join(dir,ent.name),next,found);
    else if(ent.isFile())found.push(next);
    else throw Error(`일반 파일이 아님: ${next}`);
  }
  return found;
}
const winStart=`@echo off\r\nsetlocal\r\nchcp 65001 >nul\r\nset "PATH=%~dp0runtime;%PATH%"\r\n"%~dp0runtime\\node.exe" "%~dp0on-client\\tools\\Launch-Keshev.mjs" start\r\nif errorlevel 1 pause\r\n`;
const winStop=`@echo off\r\nsetlocal\r\nchcp 65001 >nul\r\nset "PATH=%~dp0runtime;%PATH%"\r\n"%~dp0runtime\\node.exe" "%~dp0on-client\\tools\\Launch-Keshev.mjs" stop\r\npause\r\n`;
const verifyJs=String.raw`import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const base=path.dirname(fileURLToPath(import.meta.url));
try {
 const info=JSON.parse(fs.readFileSync(path.join(base,'BUILD-REPORT.json'),'utf8'));
 const runtime=path.join(base,'runtime','node.exe');
 if(!fs.existsSync(runtime))throw Error('Bundled runtime missing');
 const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 if(hash(runtime)!==info.nodeSha256)throw Error('Node runtime hash mismatch');
 let checked=0;
 for(const [file,digest] of Object.entries(info.fileHashes||{})){
  const full=path.resolve(base,...file.split('/'));
  if(!full.startsWith(base+path.sep))throw Error('Unsafe manifest path');
  if(!fs.existsSync(full)||hash(full)!==digest)throw Error('File missing/changed: '+file);
  checked++;
 }
 if(!checked)throw Error('No file manifest');
 const version=spawnSync(runtime,['--version'],{encoding:'utf8',windowsHide:true,timeout:5000});
 if(version.status!==0||version.stdout.trim()!==info.nodeVersion)throw Error('Bundled runtime launch failed');
 console.log('[OK] Bundled Node.js: '+version.stdout.trim());
 console.log('[OK] App source files verified: '+checked);
 console.log('[INFO] Course submission commit: '+(info.sourceGitCommit||'unknown'));
 console.log('[INFO] Tracked files modified at build: '+String(info.sourceTrackedFilesDirty));
 console.log('[INFO] This proves local package integrity, NOT another-PC compatibility or Windows EXE installation.');
} catch(e){console.error('[STOP] '+e.message);process.exitCode=1;}
`;
const verifyCmd='@echo off\r\nsetlocal\r\n"%~dp0runtime\\node.exe" "%~dp0Verify-Portable.mjs"\r\necho.\r\npause\r\n';
const guide=`KESHEV Phase 14.3 - PORTABLE RELEASE CANDIDATE\r\n\r\nThis is NOT a Windows setup installer. It is a preview folder bundled with Node.js.\r\nWindows x64 only. The destination PC does not need separate Node.js installation.\r\n\r\n1. Double-click Start-Keshev.cmd.\r\n2. Open http://127.0.0.1:5190/ in the browser.\r\n3. Double-click Stop-Keshev.cmd to stop.\r\n\r\nWindows PowerShell and Windows event sources are still required.\r\nSecurity event collection may need separate Administrator permissions.\r\nNative Host/enterprise ZTNA remains disconnected without authorized infrastructure.\r\nOllama and language models are NOT included.\r\nDo not copy private native.json, credentials, certificates or local event snapshots.\r\n\r\nImportant: This package is built from your local working tree, which may contain uncommitted edits.\r\nIt is NOT guaranteed to be the GitHub submission commit. Compare and commit sources before final release.\r\nDo not upload the resulting package before reviewing all code and license terms.\r\n`;
try{
  assertNode();
  const required=['package.json','tools/Launch-Keshev.mjs','tools/start-alekov.ps1','tools/Start-Keshev.cmd','src/server.mjs','src/ai/credential-vault.mjs','agent/Run-KeshevEndpoint.ps1','student/extension.mjs'];
  for(const f of required)if(!fs.statSync(path.join(source,f),{throwIfNoEntry:false})?.isFile())throw Error('필수 소스 없음: '+f);
  const launcher=fs.readFileSync(path.join(source,'tools','Launch-Keshev.mjs'),'utf8');
  if(!launcher.includes('serverArgs(native)')||!launcher.includes("'-NoNativeHost'"))throw Error('Phase 14.1 수정이 확인되지 않습니다. 원본을 보존하고 중단합니다.');
  const pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
  if(Object.keys(pkg.dependencies||{}).length||Object.keys(pkg.optionalDependencies||{}).length)throw Error('패키지 런타임 의존성이 있으므로 현재 빌더는 안전하게 복사할 수 없습니다.');
  if(fs.existsSync(resultDir))throw Error('출력 폴더가 이미 있습니다. 기존 결과를 보존하기 위해 덮어쓰지 않습니다: '+resultDir);
  const paths=walk(source);
  if(!paths.length)throw Error('복사할 파일 없음');
  const staging=resultDir+'.building-'+process.pid;
  fs.mkdirSync(staging,{recursive:false});
  try{
    for(const rel of paths){
      const from=path.join(source,rel),to=path.join(staging,'on-client',rel);
      fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);
    }
    fs.mkdirSync(path.join(staging,'runtime'));
    fs.copyFileSync(process.execPath,path.join(staging,'runtime','node.exe'));
    // Preserve Node.js redistributable license. If needed fetch only from official source.
    fs.writeFileSync(path.join(staging,'runtime','LICENSE'),await getNodeLicense());
    fs.writeFileSync(path.join(staging,'Start-Keshev.cmd'),winStart,'utf8');
    fs.writeFileSync(path.join(staging,'Stop-Keshev.cmd'),winStop,'utf8');
    fs.writeFileSync(path.join(staging,'README-PORTABLE.txt'),guide,'utf8');
    fs.writeFileSync(path.join(staging,'Verify-Portable.mjs'),verifyJs,'utf8');
    fs.writeFileSync(path.join(staging,'Verify-Portable.cmd'),verifyCmd,'utf8');
    const version=spawnSync(process.execPath,['--version'],{encoding:'utf8',timeout:5000});
    const gitHead=spawnSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8',timeout:5000,windowsHide:true});
    const gitDirty=spawnSync('git',['-C',repo,'status','--porcelain','--untracked-files=no'],{encoding:'utf8',timeout:5000,windowsHide:true});
    const fileHashes={};
    for(const rel of paths){fileHashes['on-client/'+rel.replaceAll('\\','/')]=createHash('sha256').update(fs.readFileSync(path.join(staging,'on-client',rel))).digest('hex');}
    const report={phase:'14.3',type:'portable-release-candidate',nodeVersion:version.stdout.trim(),fileCount:paths.length,sourceGitCommit:gitHead.status===0?gitHead.stdout.trim():null,sourceTrackedFilesDirty:gitDirty.status===0?Boolean(gitDirty.stdout.trim()):null,fileHashes,nodeSha256:createHash('sha256').update(fs.readFileSync(process.execPath)).digest('hex'),time:new Date().toISOString(),note:'Source may be dirty or include untracked files; compare commit before course submission and final EXE'};
    fs.writeFileSync(path.join(staging,'BUILD-REPORT.json'),JSON.stringify(report,null,2),'utf8');
    fs.renameSync(staging,resultDir);
    console.log('[OK] Portable preview built: '+resultDir);
    console.log('[OK] Files copied: '+paths.length);
    console.log('[OK] Runtime: '+version.stdout.trim());
    console.log('[NOTICE] No Ollama, native.json or event measurements included by design.');
    console.log('[NEXT] First run Verify-Portable.cmd; then Stop existing KESHEV and run Start-Keshev.cmd.');
    if(report.sourceTrackedFilesDirty!==false)console.log('[NOTICE] Source has changes or git status unknown. Do NOT claim this matches a submitted commit.');
  }catch(err){fs.rmSync(staging,{recursive:true,force:true});throw err;}
}catch(err){console.error('[STOP] '+err.message);process.exitCode=1;}
