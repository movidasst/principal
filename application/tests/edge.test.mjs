import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,normalizeDocument} from '../../backend/edge/_shared/integrante-access.ts';
import {createGateway} from '../server/security.mjs';
const env=name=>({SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-service',MM_RATE_LIMIT_SECRET:'synthetic-rate-secret',MM_ALLOWED_ORIGINS:'http://localhost:4174'}[name]);
test('Edge compatibility rejects origins, methods and invalid input before any source call',async()=>{
 let calls=0;const handler=createHandler('session',{env,fetchImpl:async()=>{calls++;throw Error('unexpected');}});
 assert.equal((await handler(new Request('https://edge.invalid',{method:'POST',headers:{Origin:'https://evil.invalid'}}))).status,403);
 assert.equal((await handler(new Request('https://edge.invalid'))).status,405);
 assert.equal((await handler(new Request('https://edge.invalid',{method:'POST',body:JSON.stringify({documento:'001',codigo:'bad'})}))).status,401);
 assert.equal(calls,0);assert.equal(normalizeDocument(' ａｂ００１ '),'AB001');
});
test('Edge returns minimal legacy contract and links only existing technical identity',async()=>{
 const calls=[];const handler=createHandler('session',{env,fetchImpl:async(url,options)=>{
  calls.push([url,options]);const path=new URL(url).pathname;
  const data=path.endsWith('mi_movida_rate_limit')?{allowed:true}:path.endsWith('mi_movida_auth_lookup')?{integrante_id:42,auth_email:'integrante-42@auth.movidasst.com',auth_user_id:'synthetic-user'}:path.endsWith('/integrantes')?[{id:42,nombres:'Persona',pais_iso2:'VE'}]:path.endsWith('generate_link')?{user:{id:'synthetic-user'},properties:{hashed_token:'one-use-proof'}}:null;
  return Response.json(data);
 }});
 const r=await handler(new Request('https://edge.invalid',{method:'POST',headers:{Origin:'http://localhost:4174'},body:JSON.stringify({cedula:'00042',codigo:'ABCDE'})}));
 assert.equal(r.status,200);const data=await r.json();assert.equal(data.token_hash,'one-use-proof');assert.equal(data.integrante.id,42);assert.ok(!JSON.stringify(data).includes('ABCDE'));
 const lookup=JSON.parse(calls.find(([u])=>u.endsWith('mi_movida_auth_lookup'))[1].body);assert.equal(lookup.p_document,'00042');assert.equal(lookup.p_country,'VE');
 assert.equal(calls.filter(([u])=>u.endsWith('mi_movida_link_auth')).length,1);
});
test('gateway refuses nontechnical/admin Auth reuse before privileged request',async()=>{
 let calls=0;const g=createGateway({url:'https://synthetic.invalid',key:'test-public',serviceKey:'test-service',fetchImpl:async()=>{calls++;}});
 await assert.rejects(g.authenticate({integrante_id:42,auth_email:'admin@example.invalid'}),e=>e.status===409);assert.equal(calls,0);
});
test('gateway exchanges private proof, respects user JWT and sanitizes upstream errors',async()=>{
 const calls=[];const g=createGateway({url:'https://synthetic.invalid',key:'test-public',serviceKey:'test-service',fetchImpl:async(url,o)=>{
  calls.push([new URL(url).pathname,o]);if(new URL(url).pathname.endsWith('generate_link'))return Response.json({properties:{hashed_token:'private-proof'}});
  if(new URL(url).pathname.endsWith('/verify'))return Response.json({access_token:'test-access',refresh_token:'test-refresh',user:{id:'user-42'}});
  if(new URL(url).pathname.endsWith('denied'))return Response.json({code:'42501',message:'private database detail'},{status:403});
  return Response.json(null);
 }});
 await g.authenticate({integrante_id:42,auth_email:'integrante-42@auth.movidasst.com',auth_user_id:'user-42'});
 assert.equal(calls[0][1].headers.Authorization,'Bearer test-service');assert.equal(calls[1][1].headers.Authorization,'Bearer test-public');
 await assert.rejects(g.rpc('denied',{},'user-jwt'),e=>e.status===403&&e.message==='forbidden');assert.equal(calls.at(-1)[1].headers.Authorization,'Bearer user-jwt');
});
