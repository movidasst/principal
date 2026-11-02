import {normalizeMemberDocument,startIdentitySession} from './auth.ts';
type Env=(name:string)=>string|undefined;
type Result={status:number;body:Record<string,unknown>};
const generic:Result={status:202,body:{data:{message:'Si existe un canal verificado, recibirás instrucciones.'}}};
const failure=(code:string,status=422):Result=>({status,body:{error:{code}}});
async function sha256(value:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');}
async function hmac(secret:string,value:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const valueHash=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value));
 return Array.from(new Uint8Array(valueHash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function rpc(base:string,service:string,name:string,args:unknown){
 const response=await fetch(new URL('/rest/v1/rpc/'+name,base),{method:'POST',headers:{apikey:service,authorization:'Bearer '+service,'content-type':'application/json'},body:JSON.stringify(args),redirect:'error'});
 return response.ok?response.json():null;
}
export async function recoveryRoute(req:Request,route:string,env:Env):Promise<Result>{
 if(env('MM_ENABLE_RECOVERY')!=='true')return failure('not_enabled',503);
 if(req.method!=='POST')return failure('method_not_allowed',405);
 const base=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY'),pub=env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY'),secret=env('MM_RATE_LIMIT_SECRET');
 if(!base||!service||!pub||!secret)return failure('not_configured',503);
 let body:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>4096)return failure('invalid_request',413);body=JSON.parse(raw);}catch{return failure('invalid_request');}
 if(route==='/api/session/recovery/request'){
  const document=normalizeMemberDocument(body.document);
  if(document.length<3||document.length>64)return generic;
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const hashed=await sha256(token);
  // Never log document or email; a single generic response prevents account enumeration.
  try{
   const allowed=await rpc(base,service,'mi_movida_rate_limit',{p_bucket:await hmac(secret,'recovery-document:'+document),p_limit:5,p_window_seconds:900});
   if(!allowed?.allowed)return generic;
   const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||'unknown';
   const prepared=await rpc(base,service,'mi_movida_recovery_prepare_document',{p_document:document,p_token_hash:hashed,p_ip_hash:await hmac(secret,'recovery:'+ip)});
   const to=prepared?.delivery?.email;
   const api=env('RESEND_API_KEY'),from=env('MAIL_FROM');
   if(typeof to==='string'&&to.includes('@')&&api&&from){
    const link='https://www.movidasst.com/mi-movida/?recovery_token='+token;
    await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+api,'content-type':'application/json'},body:JSON.stringify({from,to:[to],subject:'Recuperación de Mi Movida',html:'<p>Para recuperar el acceso a Mi Movida utiliza este enlace de un solo uso:</p><p><a href="'+link+'">Recuperar mi acceso</a></p><p>Expira en 15 minutos. Si no lo solicitaste, ignora este correo.</p>'}),redirect:'error'});
   }
  }catch{}
  return generic;
 }
 if(route==='/api/session/recovery/consume'){
  const token=String(body.token||'');
  if(!/^[a-f0-9]{64}$/.test(token))return failure('invalid_or_expired_token');
  const allowed=await rpc(base,service,'mi_movida_rate_limit',{p_bucket:await hmac(secret,'recovery-consume:'+token),p_limit:5,p_window_seconds:900});
  if(!allowed?.allowed)return failure('rate_limited',429);
  const identity=await rpc(base,service,'mi_movida_recovery_consume',{p_token_hash:await sha256(token)});
  if(!identity?.integrante_id)return failure('invalid_or_expired_token');
  return startIdentitySession(new URL(base),pub,service,identity);
 }
 return failure('not_enabled',503);
}
