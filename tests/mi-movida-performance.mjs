import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const element={content:'',addEventListener(){},close(){},setAttribute(){}};
let calls=0;
const context=vm.createContext({
 document:{querySelector:()=>element,addEventListener(){}},
 window:{addEventListener(){}},URL,AbortController,setTimeout,clearTimeout,
 fetch:async()=>{calls++;return {ok:true,status:200,json:async()=>({data:{items:[]}})};},
 console
});
vm.runInContext(readFileSync('mi-movida/app.js','utf8').replace(/^boot\(\);$/m,''),context);
await vm.runInContext(`(async()=>{
 state.session={authenticated:true};
 await Promise.all([api('/api/me/activity'),api('/api/me/activity')]);
 await api('/api/me/activity');
})()`,context);
assert.equal(calls,1,'Concurrent and repeated reads share a request');
vm.runInContext('resetReadCache()',context);
await vm.runInContext("api('/api/me/activity')",context);
assert.equal(calls,2,'Refresh invalidates the cache');
await vm.runInContext(`(async()=>{
 await api('/api/session');await api('/api/session');
})()`,context);
assert.equal(calls,4,'Session validation is never cached');
vm.runInContext('clearPrivateState()',context);
assert.equal(vm.runInContext('responseCache.size+pendingReads.size',context),0,'Logout clears private reads');
let resolveSlow;
context.fetch=async url=>{
 calls++;
 if(url==='/api/me/learning')await new Promise(resolve=>{resolveSlow=resolve;});
 return {ok:true,status:200,json:async()=>({data:{items:[]}})};
};
vm.runInContext(`state.session={authenticated:true};state.route='inicio';state.loadId=1;var snapshots=[];
 renderCurrent=()=>snapshots.push(JSON.parse(JSON.stringify(state.cache.inicio)));
 var panel=loadRoute('inicio',1);`,context);
await new Promise(resolve=>setImmediate(resolve));
assert.ok(vm.runInContext("snapshots.some(s=>s.xp?.value&&s.learning?.pending)",context),'Fast blocks render while Moodle is pending');
resolveSlow();
await vm.runInContext('panel',context);
assert.ok(vm.runInContext("snapshots.at(-1).learning.value",context));
console.log('Rendimiento: deduplicación, caché, actualización, cierre y carga progresiva validados.');
