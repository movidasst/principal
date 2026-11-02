import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
export class AppError extends Error{constructor(code,status=503){super(code);this.code=code;this.status=status;}}
export const hash=s=>createHash('sha256').update(s).digest('hex');
export const randomToken=()=>randomBytes(32).toString('hex');
export function safeEqual(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length===y.length&&timingSafeEqual(x,y);}
export function normalizeIdentity(body){const country=String(body.issuer_country||'').trim().toUpperCase(),document=String(body.document||'').normalize('NFKC').trim().toUpperCase(),code=String(body.member_code||'').trim().toUpperCase();if(!/^[A-Z]{2}$/.test(country)||document.length<3||document.length>64||/[\x00-\x1f]/.test(document))throw new AppError('validation_error',422);return{country,document,code};}
export function createCookieCodec(secret){const key=Buffer.from(secret||'','base64');if(key.length!==32)throw new Error('SESSION_SECRET must be 32 random bytes base64');return{
 seal(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('mi-movida-session-v1'));const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64url');},
 open(value){try{const raw=Buffer.from(value,'base64url');if(raw.length<29)return null;const decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAAD(Buffer.from('mi-movida-session-v1'));decipher.setAuthTag(raw.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8'));}catch{return null;}}
};}
export function createGateway({url,key,serviceKey,fetchImpl=fetch,timeout=15000}){
 const base=new URL(url);if(base.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(base.hostname))throw new Error('Supabase requires HTTPS');
 async function call(path,body,{token,admin=false,method='POST',binary=false}={}){
  const apiKey=admin?serviceKey:key;if(!apiKey)throw new AppError('service_not_configured');
  let response;try{response=await fetchImpl(new URL(path,base),{method,headers:{apikey:apiKey,Authorization:'Bearer '+(token||apiKey),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout),redirect:'error'});}catch{throw new AppError('source_unavailable');}
  if(!response.ok){const error=await response.json().catch(()=>({}));const codes={'28000':['session_expired',401],'42501':['forbidden',403],'23505':['identity_link_conflict',409],'40001':['profile_version_conflict',409],'22023':['validation_error',422]};const translated=codes[error.code];if(translated)throw new AppError(...translated);if(response.status===401||response.status===403)throw new AppError('session_expired',401);throw new AppError(response.status===404?'backend_contract_missing':'source_unavailable');}
  return binary?response:response.status===204?null:response.json();
 }
 return{
  rpc:(name,args={},token)=>call('/rest/v1/rpc/'+name,args,{token}),
  adminRpc:(name,args={})=>call('/rest/v1/rpc/'+name,args,{admin:true}),
  async authenticate(identity){if(identity.auth_email!=='integrante-'+identity.integrante_id+'@auth.movidasst.com')throw new AppError('identity_link_requires_review',409);const link=await call('/auth/v1/admin/generate_link',{type:'magiclink',email:identity.auth_email},{admin:true});const tokenHash=link.hashed_token||link.properties?.hashed_token;if(!tokenHash)throw new AppError('auth_contract_invalid');const session=await call('/auth/v1/verify',{type:'email',token_hash:tokenHash});if(!session.access_token||!session.refresh_token||!session.user?.id)throw new AppError('auth_contract_invalid');if(identity.auth_user_id&&identity.auth_user_id!==session.user.id)throw new AppError('identity_link_conflict',409);await call('/rest/v1/rpc/mi_movida_link_auth',{p_integrante_id:identity.integrante_id,p_auth_user_id:session.user.id},{admin:true});return session;},
  user:token=>call('/auth/v1/user',undefined,{token,method:'GET'}),
  refresh:refreshToken=>call('/auth/v1/token?grant_type=refresh_token',{refresh_token:refreshToken}),
  logout:token=>call('/auth/v1/logout?scope=local',{}, {token}),
  async upload(path,bytes,type,token){const response=await fetchImpl(new URL('/storage/v1/object/mi-movida-photos/'+path,base),{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':type,'x-upsert':'false'},body:bytes,redirect:'error',signal:AbortSignal.timeout(timeout)});if(!response.ok)throw new AppError('photo_upload_failed');return new URL('/storage/v1/object/public/mi-movida-photos/'+path,base).href;},
  async remove(path,token){return call('/storage/v1/object/mi-movida-photos',{prefixes:[path]},{token,method:'DELETE'});},
  origin:base.origin
 };
}
export function claimsOfVerifiedToken(token){try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());}catch{throw new AppError('invalid_session',401);}}
export const bucket=(secret,value)=>createHmac('sha256',secret).update(value).digest('hex');
export async function deliverMail(config,{to,link,purpose},fetchImpl=fetch){
 if(config.mailer)return config.mailer({to,link,purpose});
 if(!config.resendKey||!config.mailFrom)throw new AppError('mail_not_configured');
 const response=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.resendKey,'Content-Type':'application/json'},body:JSON.stringify({from:config.mailFrom,to:[to],subject:purpose==='verify_channel'?'Confirma tu correo · Mi Movida':'Recupera tu acceso · Mi Movida',text:'Abre este enlace de un solo uso para continuar. Vence en 15 minutos.\n'+link+'\nSi no solicitaste esta operación, ignora este mensaje.'}),redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new AppError('mail_delivery_failed');
}
