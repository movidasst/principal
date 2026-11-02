import {normalizeMemberDocument} from './auth.ts';
import {handle} from './index.ts';
const testEnv=(key:string)=>key==='MM_ENABLE_MEMBER_READS'?'false':undefined;
Deno.test('Mi Movida Edge rechaza otros orígenes',async()=>{
 const res=await handle(new Request('https://test.supabase.co/functions/v1/mi-movida-api/health',{headers:{Origin:'https://otro.example'}}),testEnv);
 if(res.status!==403)throw new Error('expected 403');
});
Deno.test('Mi Movida Edge no devuelve datos privados con flag apagado',async()=>{
 const res=await handle(new Request('https://test.supabase.co/functions/v1/mi-movida-api/api/me/profile',{headers:{Origin:'https://www.movidasst.com',Authorization:'Bearer fake'}}),testEnv);
 if(res.status!==503)throw new Error('expected 503');
 if(res.headers.get('cache-control')?.includes('no-store')!==true)throw new Error('no-store required');
});
Deno.test('Mi Movida Edge preflight restringido',async()=>{
 const res=await handle(new Request('https://test.supabase.co/functions/v1/mi-movida-api/api/me/xp',{method:'OPTIONS',headers:{Origin:'https://www.movidasst.com'}}),testEnv);
 if(res.status!==204||res.headers.get('access-control-allow-origin')!=='https://www.movidasst.com')throw new Error('CORS invalid');
});

Deno.test('Mi Movida Edge no habilita escrituras por defecto',async()=>{
 const res=await handle(new Request('https://test.supabase.co/functions/v1/mi-movida-api/api/me/profile',{method:'PATCH',headers:{Origin:'https://www.movidasst.com','Content-Type':'application/json'},body:'{}'}),key=>key==='MM_ENABLE_MEMBER_READS'?'true':undefined);
 if(res.status!==503)throw new Error('PATCH should remain disabled');
});

Deno.test('Ranking y credencial pública deshabilitados por defecto',async()=>{
 const env=(_:string)=>undefined;
 for(const route of ['/api/public/ranking','/api/public/credential/11111111-1111-4111-8111-111111111111']){
  const res=await handle(new Request('https://test.supabase.co/functions/v1/mi-movida-api'+route,{headers:{Origin:'https://www.movidasst.com'}}),env);
  if(res.status!==503)throw new Error('Public read should be disabled: '+route);
 }
});

Deno.test('Cédula de Mi Movida compatible con validador actual',()=>{
 for(const [input,expected] of [['V-12.345.678','12345678'],['12.345.678','12345678'],['001234','001234'],['AB001','AB001']]){
  if(normalizeMemberDocument(input)!==expected)throw new Error('document normalization mismatch');
 }
});

Deno.test('Renovación de sesión bloqueada sin activar login',async()=>{
 const res=await handle(new Request('https://test.supabase.co/functions/v1/mi-movida-api/api/session/refresh',{method:'POST',headers:{Origin:'https://www.movidasst.com','Content-Type':'application/json'},body:'{"refresh_token":"test-placeholder-token"}'}),()=>undefined);
 if(res.status!==503)throw new Error('Refresh must remain disabled');
});

Deno.test('Fotografías Edge cerradas sin habilitación explícita',async()=>{
 for(const method of ['GET','POST']){
  const req=new Request('https://test.supabase.co/functions/v1/mi-movida-api/api/me/photo',{method,headers:{Origin:'https://www.movidasst.com'},...(method==='POST'?{body:new Uint8Array(32)}:{})});
  const res=await handle(req,()=>undefined);
  if(res.status!==503)throw new Error('Photo endpoints must remain disabled');
 }
});

Deno.test('Recuperación de acceso permanece cerrada sin habilitación',async()=>{
 for(const route of ['/api/session/recovery/request','/api/session/recovery/consume']){
  const request=new Request('https://test.supabase.co/functions/v1/mi-movida-api'+route,{method:'POST',headers:{Origin:'https://www.movidasst.com','Content-Type':'application/json'},body:'{}'});
  const result=await handle(request,()=>undefined);
  if(result.status!==503)throw new Error('Recovery must remain disabled');
 }
});

Deno.test('El canal de recuperación requiere habilitación expresa',async()=>{
 for(const route of ['/api/me/recovery-channel','/api/me/recovery-channel/confirm']){
  const request=new Request('https://test.supabase.co/functions/v1/mi-movida-api'+route,{method:'POST',headers:{Origin:'https://www.movidasst.com','Content-Type':'application/json'},body:'{}'});
  const response=await handle(request,()=>undefined);
  if(response.status!==503)throw new Error('Channel must remain disabled');
 }
});

Deno.test('La tarjeta GEO sólo expone datos del integrante cuya sesión está validada',async()=>{
 const previous=globalThis.fetch;
 const sid='22222222-2222-4222-8222-222222222222',uid='11111111-1111-4111-8111-111111111111';
 const access='aaa.'+btoa(JSON.stringify({session_id:sid})).replace(/=/g,'')+'.sig';
 const expectedPublicId='33333333-3333-4333-8333-333333333333';
 let memberQuery='';
 try{
  globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit):Promise<Response>=>{
   const address=new URL(String(input));
   if(address.pathname==='/auth/v1/user')return Response.json({id:uid});
   if(address.pathname==='/rest/v1/rpc/mi_movida_session_context')return Response.json({active:true,integrante_id:'42'});
   if(address.pathname==='/rest/v1/integrantes'){
    memberQuery=address.searchParams.get('id')||'';
    return Response.json([{id:42,public_id:expectedPublicId,nombres:'Persona',apellidos:'Ejemplo',documento:'SYN-001',pais_iso2:'VE',grado:'SST',carrera:'SST',foto_url:'https://drive.google.com/example'}]);
   }
   return new Response(null,{status:404});
  };
  const env=(k:string)=>({
   MM_ALLOW_LOCAL_DOCKER_HOST:'true',SUPABASE_URL:'http://kong:8000',SUPABASE_ANON_KEY:'public-fixture',
   SUPABASE_SERVICE_ROLE_KEY:'private-fixture',MM_ENABLE_MEMBER_READS:'true'
  } as Record<string,string>)[k];
  const req=new Request('https://example.test/functions/v1/mi-movida-api/api/me/credential-card',{headers:{origin:'https://www.movidasst.com',authorization:'Bearer '+access}});
  const resp=await handle(req,env);
  if(resp.status!==200)throw new Error('Expected own credential card: HTTP '+resp.status);
  const json=await resp.json();
  if(memberQuery!=='eq.42'||json.data.public_id!==expectedPublicId||json.data.codigo_integrante!==undefined||json.data.access_token!==undefined)throw new Error('Unauthorized disclosure or wrong member');
 }finally{globalThis.fetch=previous;}
});

Deno.test('La tarjeta GEO rechaza filas de integrantes ajenos',async()=>{
 const previous=globalThis.fetch,uid='11111111-1111-4111-8111-111111111111';
 const access='aaa.'+btoa(JSON.stringify({session_id:'22222222-2222-4222-8222-222222222222'})).replace(/=/g,'')+'.sig';
 try{
  globalThis.fetch=async(input:RequestInfo|URL):Promise<Response>=>{
   const path=new URL(String(input)).pathname;
   if(path==='/auth/v1/user')return Response.json({id:uid});
   if(path==='/rest/v1/rpc/mi_movida_session_context')return Response.json({active:true,integrante_id:'42'});
   if(path==='/rest/v1/integrantes')return Response.json([{id:99,public_id:'33333333-3333-4333-8333-333333333333'}]);
   return new Response(null,{status:404});
  };
  const env=(k:string)=>({
   MM_ALLOW_LOCAL_DOCKER_HOST:'true',SUPABASE_URL:'http://kong:8000',SUPABASE_ANON_KEY:'public-fixture',
   SUPABASE_SERVICE_ROLE_KEY:'private-fixture',MM_ENABLE_MEMBER_READS:'true'
  } as Record<string,string>)[k];
  const req=new Request('https://example.test/functions/v1/mi-movida-api/api/me/credential-card',{headers:{origin:'https://www.movidasst.com',authorization:'Bearer '+access}});
  const resp=await handle(req,env);
  if(resp.status!==409)throw new Error('Cross-member response must be denied');
 }finally{globalThis.fetch=previous;}
});

Deno.test('Mi Movida mantiene el perfil inmodificable aun con flag de escritura activado',async()=>{
 const env=(key:string)=>({MM_ALLOW_LOCAL_DOCKER_HOST:'true',SUPABASE_URL:'http://kong:8000',MM_ENABLE_MEMBER_READS:'true',MM_ENABLE_MEMBER_WRITES:'true'} as Record<string,string>)[key];
 const response=await handle(new Request('https://test.supabase.co/functions/v1/mi-movida-api/api/me/profile',{method:'PATCH',headers:{Origin:'https://www.movidasst.com','Content-Type':'application/json','Authorization':'Bearer fake'},body:'{"pais_iso2":"US"'}),env);
 if(response.status!==503)throw new Error('Profile writes must always be disabled');
});
