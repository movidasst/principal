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
