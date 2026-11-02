// Supabase Auth adapter for Mi Movida Edge. No member login unless explicitly enabled.
type Env=(name:string)=>string|undefined;
type Outcome={status:number;body:Record<string,unknown>};
const bad=(code:string,status=401):Outcome=>({status,body:{error:{code}}});
const good=(data:Record<string,unknown>,status=200):Outcome=>({status,body:{data}});
const hex=(buf:ArrayBuffer)=>Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');
async function bucket(secret:string,text:string){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(text)));
}
function decodeSession(token:string):string|null{
 try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return typeof payload.session_id==='string'?payload.session_id:null;}catch{return null;}
}
async function jsonRequest(url:URL,key:string,payload:unknown,admin=false,method='POST'){
 return fetch(url,{method,headers:{apikey:key,authorization:'Bearer '+key,...(method==='POST'?{'content-type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(payload)}:{}),redirect:'error'});
}
export async function sessionContext(url:URL,key:string,service:string,access:string){
 const userResponse=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:key,authorization:'Bearer '+access},redirect:'error'});
 if(!userResponse.ok)return null;
 const user=await userResponse.json();const sid=decodeSession(access);
 if(!user?.id||!sid)return null;
 const r=await fetch(new URL('/rest/v1/rpc/mi_movida_session_context',url),{method:'POST',headers:{apikey:service,authorization:'Bearer '+service,'content-type':'application/json'},body:JSON.stringify({p_auth_user_id:user.id,p_session_id:sid}),redirect:'error'});
 if(!r.ok)return null;
 const data=await r.json();
 return data?.active?data:null;
}
function personal(c:Record<string,unknown>,access?:string,refresh?:string,expires?:number){
 return {authenticated:true,person:{id:c.integrante_id,public_id:c.public_id,display_name:[c.nombres,c.apellidos].filter(Boolean).join(' ')},environment:'edge-review',...(access?{access_token:access}:{}),...(refresh?{refresh_token:refresh}:{}),...(expires?{expires_in:expires}:{})};
}
export async function authRoute(req:Request,route:string,env:Env):Promise<Outcome>{
 if(route==='/api/session'&&req.method==='GET'&&env('MM_ENABLE_MEMBER_LOGIN')!=='true')return good({authenticated:false,environment:'edge-review'});
 if(env('MM_ENABLE_MEMBER_LOGIN')!=='true')return bad('not_enabled',503);
 const raw=env('SUPABASE_URL'),pub=env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY');
 if(!raw||!pub)return bad('not_configured',503);
 const serviceKey=env('SUPABASE_SERVICE_ROLE_KEY');
 const url=new URL(raw);
 if(url.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(url.hostname))return bad('not_configured',503);
 if(route==='/api/session'&&req.method==='GET'){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!token)return good({authenticated:false,environment:'edge-review'});
  if(!serviceKey)return bad('not_configured',503);
  const c=await sessionContext(url,pub,serviceKey,token);
  return c?good(personal(c)):good({authenticated:false,environment:'edge-review'});
 }
 if(route==='/api/session/bootstrap'&&req.method==='POST'){
  const service=env('SUPABASE_SERVICE_ROLE_KEY'),secret=env('MM_RATE_LIMIT_SECRET');
  if(!service||!secret)return bad('not_configured',503);
  let data:Record<string,unknown>;
  try{data=await req.json();}catch{return bad('invalid_json',400);}
  const document=String(data.document||'').normalize('NFKC').trim().toUpperCase(),code=String(data.member_code||'').trim().toUpperCase();
  if(document.length<3||document.length>64||/[\x00-\x1f]/.test(document)||!/^[A-Z0-9]{5}$/.test(code))return bad('invalid_credentials');
  // A database-wide per-document counter prevents distributed brute-force across IPs.
  const rate=await jsonRequest(new URL('/rest/v1/rpc/mi_movida_rate_limit',url),service,{p_bucket:await bucket(secret,'edge-login:'+document),p_limit:12,p_window_seconds:900});
  if(!rate.ok)return bad('source_unavailable',503);
  const allowed=await rate.json();if(!allowed?.allowed)return bad('rate_limited',429);
  const lookup=await jsonRequest(new URL('/rest/v1/rpc/mi_movida_auth_lookup_document',url),service,{p_document:document,p_code:code});
  if(!lookup.ok)return bad('source_unavailable',503);
  const identity=await lookup.json();
  if(!identity?.integrante_id||identity.auth_email!=='integrante-'+identity.integrante_id+'@auth.movidasst.com')return bad('invalid_credentials');
  const link=await jsonRequest(new URL('/auth/v1/admin/generate_link',url),service,{type:'magiclink',email:identity.auth_email});
  if(!link.ok)return bad('auth_unavailable',503);
  const linkData=await link.json(),hash=linkData.hashed_token||linkData.properties?.hashed_token;
  if(!hash)return bad('auth_unavailable',503);
  const verify=await jsonRequest(new URL('/auth/v1/verify',url),pub,{type:'email',token_hash:hash});
  if(!verify.ok)return bad('auth_unavailable',503);
  const verified=await verify.json();
  if(!verified?.access_token||!verified?.refresh_token||!verified?.user?.id)return bad('auth_unavailable',503);
  if(identity.auth_user_id&&identity.auth_user_id!==verified.user.id)return bad('identity_conflict',409);
  const linking=await jsonRequest(new URL('/rest/v1/rpc/mi_movida_link_auth',url),service,{p_integrante_id:identity.integrante_id,p_auth_user_id:verified.user.id});
  if(!linking.ok)return bad('identity_requires_review',409);
  const c=await sessionContext(url,pub,service,verified.access_token);
  return c?good(personal(c,verified.access_token,verified.refresh_token,verified.expires_in)):bad('session_invalid',503);
 }
 if(route==='/api/session/logout'&&req.method==='POST'){
  const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
  if(!token)return bad('unauthorized');
  const c=await sessionContext(url,pub,serviceKey||'',token);
  if(!c)return bad('unauthorized');
  const service=env('SUPABASE_SERVICE_ROLE_KEY'),sid=decodeSession(token);
  if(!service||!sid)return bad('not_configured',503);
  const who=await fetch(new URL('/auth/v1/user',url),{headers:{apikey:pub,authorization:'Bearer '+token},redirect:'error'});
  if(!who.ok)return bad('unauthorized');
  const user=await who.json();
  const revoked=await jsonRequest(new URL('/rest/v1/rpc/mi_movida_revoke_session',url),service,{p_auth_user_id:user.id,p_session_id:sid});
  if(!revoked.ok)return bad('revocation_unavailable',503);
  await fetch(new URL('/auth/v1/logout?scope=local',url),{method:'POST',headers:{apikey:pub,authorization:'Bearer '+token},redirect:'error'}).catch(()=>{});
  return good({logged_out:true});
 }
 return bad('not_enabled',503);
}
