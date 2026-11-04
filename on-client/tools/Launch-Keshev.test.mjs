import test from 'node:test';
import assert from 'node:assert/strict';
import {validSession,procMatch} from './Launch-Keshev.mjs';
test('validates session format and rejects malformed control requests',()=>{
 const s={version:1,port:31337,pid:24,token:'12345678-1234-1234-1234-123456789abc'};
 assert.equal(validSession(s),true);
 for(const change of [{port:0},{pid:0},{token:'bad'},{version:2}])assert.equal(validSession({...s,...change}),false);
});
test('recognizes true PC and supervisor script paths',()=>{
 assert.ok(procMatch('powershell -File "C:\\test\\Run-KeshevEndpoint.ps1" -Watch'));
 assert.ok(procMatch('powershell -File C:\\test\\Start-KeshevAutoCollect.ps1'));
 assert.ok(procMatch('powershell -File "C:\\test\\Watch-KeshevSupervisor.ps1"'));
});
test('does not confuse security worker with managed PC and supervisor',()=>{
 assert.equal(procMatch('powershell -File C:\\test\\Collect-KeshevSecurity.ps1 -Watch'),false);
 assert.equal(procMatch('notanagent Run-KeshevEndpoint.ps1.bak'),false);
});
