#!/usr/bin/env node
// Optional KESHEV one-click local CPU AI launcher. No changes to existing KESHEV source.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import os from 'node:os';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const main=path.join(dir,'Launch-Keshev.mjs');
const ollamaRoot='http://127.0.0.1:11434';
const localApp=process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local');
const aiConfig=path.join(localApp,'KeshevEndpoint','ai-local.json');
export function cpuEnvironment(env){return {...env,CUDA_VISIBLE_DEVICES:'-1',GGML_VK_VISIBLE_DEVICES:'-1',OLLAMA_VULKAN:'false',OLLAMA_NO_CLOUD:'1',OLLAMA_HOST:'127.0.0.1:11434'};}
export function getOllamaProgram(env,exists=fs.existsSync){
 const candidates=[path.join(env.LOCALAPPDATA||'', 'Programs','Ollama','ollama.exe'),path.join(env.ProgramFiles||'','Ollama','ollama.exe')].filter(p=>p&&path.isAbsolute(p));
 return candidates.find(exists)||'ollama.exe';
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function listening(){
 const controller=new AbortController();const t=setTimeout(()=>controller.abort(),1200);
 try{const r=await fetch(ollamaRoot+'/api/tags',{signal:controller.signal});return r.ok;}catch{return false;}finally{clearTimeout(t)}
}
function portInUse(){return new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(true));s.listen({host:'127.0.0.1',port:11434,exclusive:true},()=>s.close(()=>resolve(false)));});}
function killOwned(child){if(!child?.pid)return;const r=spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:7000,encoding:'utf8'});if(r.status!==0)console.warn('[WARN] Ollama child cleanup needs manual verification.');}
function closeOnDemand(){return new Promise(resolve=>{
 const timer=setInterval(()=>{if(process.exitCode!==undefined){clearInterval(timer);resolve();}},300);
 timer.unref?.();
})}
async function run(){
 if(process.platform!=='win32')throw Error('Windows 전용 실행기입니다.');
 if(!fs.existsSync(main))throw Error('기존 Launch-Keshev.mjs 파일을 찾을 수 없습니다.');
 if(!fs.existsSync(aiConfig))console.warn('[WARN] ai-local.json 설정 없음. KESHEV AI 상태를 먼저 확인하세요.');
 if(await listening()||await portInUse())throw Error('11434 포트에서 다른 Ollama/프로세스가 실행 중입니다. GPU 실행 여부를 보장할 수 없어 중단합니다. 기존 Ollama를 정상 종료한 후 다시 시작하세요. 다른 프로세스를 강제 종료하지 않았습니다.');
 const exe=getOllamaProgram(process.env);const env=cpuEnvironment(process.env);
 console.log('[INFO] CPU-only Ollama startup (CUDA/Vulkan GPU off, Ollama cloud disabled).');
 const ollama=spawn(exe,['serve'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
 let ollamaExited=false;ollama.once('exit',(c)=>{ollamaExited=true;console.log('[OLLAMA] exited: '+c)});
 ollama.once('error',e=>{console.error('[OLLAMA] '+e.message);ollamaExited=true});
 for(const stream of ['stdout','stderr'])ollama[stream]?.on('data',d=>{for(const line of String(d).split(/\r?\n/)){if(line&&(/error|warn|listening|cpu|fail|ready/i.test(line)))console.log('[OLLAMA] '+line.slice(0,350))}});
 let ready=false;for(let i=0;i<70;i++){if(ollamaExited)break;if(await listening()){ready=true;break;}await delay(350)}
 if(!ready){killOwned(ollama);throw Error('Ollama CPU 서버 시작 실패. 케셰브는 시작하지 않았습니다.');}
 console.log('[OK] Ollama CPU API responsive. Starting KESHEV...');
 let shutting=false;
 const keshev=spawn(process.execPath,[main,'start'],{cwd:dir,stdio:'inherit',env:process.env,windowsHide:false});
 const cleanup=()=>{if(shutting)return;shutting=true;killOwned(ollama)};
 process.on('SIGINT',()=>{console.log('\n[INFO] KESHEV 종료 요청.');keshev.kill('SIGINT');});
 process.on('SIGTERM',()=>{keshev.kill('SIGTERM')});
 keshev.once('error',e=>{console.error('[FAIL] KESHEV start:',e.message);cleanup();process.exitCode=1});
 const exitCode=await new Promise(resolve=>keshev.once('exit',(code)=>resolve(code??1)));
 cleanup();console.log('[INFO] CPU Ollama owned by this launcher stopped.');process.exitCode=exitCode;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(e=>{console.error('[FAIL] '+e.message);process.exitCode=1});
