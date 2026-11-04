// Phase 13.1: local-only portable deployment profile. Never initiates remote connections.
import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';

export const DEFAULT_PROFILE=Object.freeze({schemaVersion:1,mode:'local',managementServer:null,ai:{provider:'local_ollama',endpoint:'http://127.0.0.1:11434'}});
export function validateProfile(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 if(Object.keys(raw).sort().join(',')!=='ai,managementServer,mode,schemaVersion')return null;
 if(raw.schemaVersion!==1||raw.mode!=='local'||raw.managementServer!==null)return null;
 const ai=raw.ai;
 if(!ai||typeof ai!=='object'||Array.isArray(ai)||Object.keys(ai).sort().join(',')!=='endpoint,provider'||ai.provider!=='local_ollama')return null;
 // Deliberately refuse LAN, public, file:, redirects-to-hostnames and credentials.
 if(typeof ai.endpoint!=='string'||!/^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(ai.endpoint))return null;
 const url=new URL(ai.endpoint);const port=Number(url.port);
 if(port<1||port>65535||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;
 return {schemaVersion:1,mode:'local',managementServer:null,ai:{provider:'local_ollama',endpoint:ai.endpoint}};
}
export async function readDeploymentProfile(){
 const root=process.env.LOCALAPPDATA;
 if(!root)return {valid:true,configured:false,profile:DEFAULT_PROFILE,reason:'DEFAULT_LOCAL'};
 const file=join(root,'KeshevEndpoint','deployment.json');
 try{
  const st=await lstat(file);
  if(!st.isFile()||st.isSymbolicLink()||st.size>2048||st.size<2)return {valid:false,configured:true,profile:null,reason:'DEPLOYMENT_CONFIG_INVALID'};
  const parsed=validateProfile(JSON.parse(await readFile(file,'utf8')));
  if(!parsed)return {valid:false,configured:true,profile:null,reason:'DEPLOYMENT_CONFIG_INVALID'};
  return {valid:true,configured:true,profile:parsed,reason:'LOCAL_ONLY'};
 }catch(e){
  if(e?.code==='ENOENT')return {valid:true,configured:false,profile:DEFAULT_PROFILE,reason:'DEFAULT_LOCAL'};
  return {valid:false,configured:true,profile:null,reason:'DEPLOYMENT_CONFIG_INVALID'};
 }
}
export async function deploymentPublicStatus(){
 const state=await readDeploymentProfile();
 return {mode:state.valid?'local':'invalid',profileConfigured:state.configured,aiProvider:state.valid?'local_ollama':null,aiEndpoint:state.valid?state.profile.ai.endpoint:null,managementConnected:false,centralEnrollmentSupported:false,reason:state.reason,remoteUpload:false};
}
