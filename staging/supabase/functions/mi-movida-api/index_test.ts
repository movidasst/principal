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
