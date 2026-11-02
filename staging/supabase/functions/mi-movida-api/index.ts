import {authRoute,sessionContext} from './auth.ts';
import {createAcademia} from './academia.mjs';
// Private read gateway, disabled by default until native Auth/RLS regression passes.
// GitHub Pages -> Supabase Edge; no service-role key or privileged SQL exposed.
const ORIGIN='https://www.movidasst.com';
const BASE_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
function respond(data:unknown,status=200,origin:string|null=null){
 const h=new Headers(BASE_HEADERS);if(origin===ORIGIN){h.set('access-control-allow-origin',ORIGIN);h.set('vary','Origin');}
 return new Response(JSON.stringify(data),{status,headers:h});
}
const READ_ROUTES:Record<string,string>={
 '/api/me/profile':'mi_movida_profile',
 '/api/me/credential':'mi_movida_profile',
 '/api/me/badges':'mi_movida_badges',
 '/api/me/xp':'mi_movida_xp',
 '/api/me/activity':'mi_movida_activity'
};
export async function handle(req:Request,env:(name:string)=>string|undefined=(name)=>Deno.env.get(name)):Promise<Response>{
 const origin=req.headers.get('origin');
 if(origin&&origin!==ORIGIN)return respond({error:{code:'origin_denied'}},403);
 if(req.method==='OPTIONS'){
  if(origin!==ORIGIN)return respond({error:{code:'origin_denied'}},403);
  return new Response(null,{status:204,headers:{'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'GET,POST,PATCH,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type','access-control-max-age':'600','vary':'Origin'}});
 }
 const rawPath=new URL(req.url).pathname;
 const route=rawPath.replace(/^.*?\/mi-movida-api(?=\/|$)/,'');
 if(req.method==='GET'&&route==='/health')return respond({data:{status:'edge_gateway_ready',member_access:env('MM_ENABLE_MEMBER_READS')==='true'?'restricted':'disabled'}},200,origin);
 if(['/api/session','/api/session/bootstrap','/api/session/refresh','/api/session/logout'].includes(route)){
  try{const result=await authRoute(req,route,env);return respond(result.body,result.status,origin);}catch{return respond({error:{code:'auth_unavailable'}},503,origin);}
 }
 if(req.method==='GET'&&(route==='/api/public/ranking'||route.startsWith('/api/public/credential/'))){
  if(env('MM_ENABLE_PUBLIC_READS')!=='true')return respond({error:{code:'not_enabled'}},503,origin);
  const supabase=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY');
  if(!supabase||!key)return respond({error:{code:'not_configured'}},503,origin);
  const args:Record<string,unknown>={};let rpc='';
  if(route==='/api/public/ranking'){
   const q=new URL(req.url).searchParams;
   const scope=q.get('scope')||'general',limit=Number(q.get('limit')||50),offset=Number(q.get('offset')||0);
   if(!['general','estudios'].includes(scope)||!Number.isSafeInteger(limit)||limit<1||limit>100||!Number.isSafeInteger(offset)||offset<0)return respond({error:{code:'invalid_pagination'}},422,origin);
   rpc=scope==='general'?'ranking_publico':'ranking_todos_estudios_publico';args.p_limit=limit;args.p_offset=offset;
  }else{
   const id=route.split('/').pop()||'';
   if(!/^[a-f0-9-]{36}$/i.test(id))return respond({error:{code:'not_found'}},404,origin);
   rpc='mi_movida_public_credential';args.p_public_id=id;
  }
  try{
   const url=new URL('/rest/v1/rpc/'+rpc,supabase);
   const result=await fetch(url,{method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(args),redirect:'error'});
   if(!result.ok)return respond({error:{code:'source_unavailable'}},503,origin);
   const data=await result.json();
   return respond({data:rpc==='mi_movida_public_credential'?data:{items:data,scope:(new URL(req.url)).searchParams.get('scope')||'general'}},200,origin);
  }catch{return respond({error:{code:'source_unavailable'}},503,origin);}
 }
 if(req.method==='GET'&&(route==='/api/me/learning'||route==='/api/me/certificates'||/^\/api\/me\/certificates\/moodle\/[0-9]+$/.test(route))){
  if(env('MM_ENABLE_MEMBER_READS')!=='true')return respond({error:{code:'not_enabled'}},503,origin);
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
  const base=env('SUPABASE_URL'),pub=env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!base||!pub||!service)return respond({error:{code:'not_configured'}},503,origin);
  const c=await sessionContext(new URL(base),pub,service,token);
  if(!c)return respond({error:{code:'unauthorized'}},401,origin);
  const configured=env('MM_ENABLE_MOODLE_READS')==='true'&&!!env('MOODLE_BASE_URL')&&!!env('MOODLE_TOKEN');
  const lms=configured?createAcademia({baseUrl:env('MOODLE_BASE_URL'),token:env('MOODLE_TOKEN')} as any):null;
  try{
   if(route==='/api/me/learning'){
    if(!lms)return respond({error:{code:'moodle_not_configured'}},503,origin);
    if(!c.moodle_user_id)return respond({data:{status:'unlinked',courses:[],message:'El vínculo académico requiere revisión.'}},200,origin);
    return respond({data:await lms.getLearning(c.moodle_user_id)},200,origin);
   }
   if(route.startsWith('/api/me/certificates/moodle/')){
    if(!lms||!c.moodle_user_id)return respond({error:{code:'moodle_not_configured'}},503,origin);
    const id=route.split('/').pop();
    const document=await lms.downloadCertificate(c.moodle_user_id,id);
    const headers=new Headers({'content-type':'application/pdf','cache-control':'no-store, private','x-content-type-options':'nosniff','content-disposition':'attachment; filename="'+document.filename+'"'});
    if(origin===ORIGIN)headers.set('access-control-allow-origin',ORIGIN);
    return new Response(document.content,{status:200,headers});
   }
   const ownResponse=await fetch(new URL('/rest/v1/rpc/mi_movida_certificates',base),{method:'POST',headers:{apikey:pub,authorization:'Bearer '+token,'content-type':'application/json'},body:'{}',redirect:'error'});
   if(!ownResponse.ok)return respond({error:{code:'source_unavailable'}},503,origin);
   const own=await ownResponse.json();
   let moodle:any={status:'unavailable',certificates:[],message:'Moodle de pruebas no está configurado.'};
   if(lms&&c.moodle_user_id)try{moodle=await lms.getCertificates(c.moodle_user_id,{offset:0,limit:100});}catch{moodle={status:'unavailable',certificates:[],message:'No se pudieron consultar certificados académicos.'};}
   return respond({data:{items:[...(own?.items||[]),...moodle.certificates.map((item:Record<string,unknown>)=>({...item,source:'Academia Moodle',download_url:'/api/me/certificates/moodle/'+item.id}))],moodle_status:moodle.status,message:moodle.status==='available'?null:moodle.message||'La emisión académica no está disponible.'}},200,origin);
  }catch{return respond({error:{code:'moodle_unavailable'}},503,origin);}
 }
 const profileWrite=req.method==='PATCH'&&route==='/api/me/profile';
 const rpc=profileWrite?'mi_movida_update_profile':READ_ROUTES[route];
 if(!rpc||(!profileWrite&&req.method!=='GET')||env('MM_ENABLE_MEMBER_READS')!=='true'||(profileWrite&&env('MM_ENABLE_MEMBER_WRITES')!=='true'))
  return respond({error:{code:'not_enabled',message:'El acceso privado aún no está habilitado.'}},503,origin);
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer))return respond({error:{code:'unauthorized'}},401,origin);
 const supabase=env('SUPABASE_URL'),publishable=env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY');
 if(!supabase||!publishable)return respond({error:{code:'not_configured'}},503,origin);
 try{
  const user=await fetch(new URL('/auth/v1/user',supabase),{headers:{'apikey':publishable,'authorization':bearer},redirect:'error'});
  if(!user.ok)return respond({error:{code:'unauthorized'}},401,origin);
  const session=await user.json();
  if(!session?.id)return respond({error:{code:'unauthorized'}},401,origin);
  let profileChanges:Record<string,unknown>|null=null;
  if(profileWrite){
   const raw=await req.text();if(raw.length>16384)return respond({error:{code:'request_too_large'}},413,origin);
   let changes:Record<string,unknown>;
   try{changes=JSON.parse(raw);}catch{return respond({error:{code:'invalid_json'}},400,origin);}
   const permitted=['pais_iso2','estado','municipio','telefono_e164','whatsapp_username','grado','carrera','postgrado','doctorado','laboral','linkedin','mostrar_correo','mostrar_wasap','mostrar_whatsapp_username','mostrar_insignias'];
   const version=changes.version;
   if(typeof version!=='string'||!version||!Object.keys(changes).every(k=>k==='version'||permitted.includes(k)))return respond({error:{code:'validation_error'}},422,origin);
   delete changes.version;
   profileChanges={p_changes:changes,p_version:version};
  }
  const params=new URL(req.url).searchParams;
  const cursor=params.get('cursor');let paging:Record<string,unknown>={};
  if(rpc==='mi_movida_xp'||rpc==='mi_movida_activity'){
   if(cursor){try{const decoded=JSON.parse(atob(cursor.replace(/-/g,'+').replace(/_/g,'/')));if(typeof decoded.fecha!=='string'||!Number.isFinite(Date.parse(decoded.fecha))||!/^[a-f0-9-]{36}$/i.test(decoded.id))return respond({error:{code:'invalid_cursor'}},422,origin);paging={p_before:decoded.fecha,p_before_id:decoded.id};}catch{return respond({error:{code:'invalid_cursor'}},422,origin);}}
   paging.p_limit=30;
   if(rpc==='mi_movida_activity')paging.p_source=params.get('source')||null;
  }
  const result=await fetch(new URL('/rest/v1/rpc/'+rpc,supabase),{method:'POST',headers:{'apikey':publishable,'authorization':bearer,'content-type':'application/json'},body:JSON.stringify(profileChanges||paging),redirect:'error'});
  if(!result.ok)return respond({error:{code:result.status===403?'forbidden':'source_unavailable'}},result.status===403?403:503,origin);
  const data=await result.json();
  const resultData=(rpc==='mi_movida_xp'||rpc==='mi_movida_activity')&&data?.next_cursor&&typeof data.next_cursor==='object'?{...data,next_cursor:btoa(JSON.stringify(data.next_cursor)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}:data;
  return respond({data:(rpc==='mi_movida_profile'||profileWrite)?{...resultData,version:String(resultData.profile_version),recovery_channel:{verified:!!resultData.recovery_channel_verified},...(route==='/api/me/credential'?{verification_url:new URL('/functions/v1/mi-movida-api/api/public/credential/'+resultData.public_id,supabase).href}:{})}:resultData},200,origin);
 }catch{return respond({error:{code:'source_unavailable'}},503,origin);}
}
if(import.meta.main)Deno.serve(req=>handle(req));
