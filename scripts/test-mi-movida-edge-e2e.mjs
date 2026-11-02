import assert from 'node:assert/strict';
const base='http://127.0.0.1:54321/functions/v1/mi-movida-api';
const origin='https://www.movidasst.com';
async function api(route,{method='GET',body,token}={}){
 const response=await fetch(base+route,{method,headers:{Origin:origin,...(body?{'content-type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const json=await response.json();
 return {status:response.status,body:json};
}
const fail=(step,actual,expected)=>{throw new Error(step+': expected '+expected+' but received HTTP '+actual.status+' / '+String(actual.body?.error?.code||'unknown'));};
const health=await api('/health');
assert.equal(health.status,200);
assert.equal(health.body?.data?.member_access,'restricted');
const anonymous=await api('/api/me/profile');
assert.equal(anonymous.status,401);
const incorrect=await api('/api/session/bootstrap',{method:'POST',body:{document:'DEMO001',member_code:'X9X9X'}});
assert.equal(incorrect.status,401);
const login=await api('/api/session/bootstrap',{method:'POST',body:{document:'DEMO001',member_code:'A1B2C'}});
if(login.status!==200)fail('login sintético',login,200);
const token=login.body?.data?.access_token;
assert.ok(typeof token==='string'&&token.length>80,'session token absent');
const session=await api('/api/session',{token});
if(session.status!==200||!session.body?.data?.authenticated)fail('validación de sesión',session,200);
const profile=await api('/api/me/profile',{token});
if(profile.status!==200||String(profile.body?.data?.id)!=='900001')fail('perfil del integrante ficticio',profile,200);
const logout=await api('/api/session/logout',{method:'POST',token});
if(logout.status!==200)fail('revocación de sesión',logout,200);
const revoked=await api('/api/session',{token});
assert.ok(revoked.body?.data?.authenticated===false,'revoked session must not authenticate');
console.log('Ingreso, perfil, revocación y denegación sin JWT: OK con datos ficticios');
