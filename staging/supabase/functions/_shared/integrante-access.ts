// Compatibility adapter. Source for review/local Edge runtime; NOT deployed.
export const normalizeDocument=value=>String(value??'').normalize('NFKC').trim().toUpperCase();
export function createHandler(mode,{env,fetchImpl=fetch,cryptoImpl=crypto}){
 const reply=(body,status,origin)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Vary':'Origin',...(origin?{'Access-Control-Allow-Origin':origin}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}});
 return async req=>{
  const origin=req.headers.get('origin'),allowed=(env('MM_ALLOWED_ORIGINS')||'https://pif.movidasst.com,https://emergencias.movidasst.com,https://pefamiliar.movidasst.com').split(',');
  if(origin&&!allowed.includes(origin))return reply({ok:false,error:'Origen no autorizado.'},403,null);
  if(req.method==='OPTIONS')return reply({},200,origin);
  if(req.method!=='POST')return reply({ok:false,error:'Método no permitido.'},405,origin);
  try{
   const raw=await req.text();if(raw.length>4096)return reply({ok:false,error:'Solicitud inválida.'},400,origin);
   const b=JSON.parse(raw),country=String(b.pais_iso2||'VE').trim().toUpperCase(),document=normalizeDocument(b.documento??b.cedula),code=normalizeDocument(b.codigo);
   if(!/^[A-Z]{2}$/.test(country)||document.length<3||document.length>64||/[\x00-\x1f]/.test(document)||!/^[A-Z0-9]{5}$/.test(code))return reply({ok:false,error:'Documento o código no válidos.'},401,origin);
   const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY'),rateSecret=env('MM_RATE_LIMIT_SECRET');
   if(!url||!key||!rateSecret)throw Error('configuration_required');
   const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
   async function post(path,payload){const r=await fetchImpl(url+path,{method:'POST',headers,body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('upstream_failed');return r.json();}
   const hmac=await cryptoImpl.subtle.importKey('raw',new TextEncoder().encode(rateSecret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
   const digest=await cryptoImpl.subtle.sign('HMAC',hmac,new TextEncoder().encode(country+':'+document));
   const bucket=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
   const rate=await post('/rest/v1/rpc/mi_movida_rate_limit',{p_bucket:bucket,p_limit:5,p_window_seconds:900});
   if(!rate.allowed)return reply({ok:false,error:'Demasiados intentos. Inténtalo más tarde.'},429,origin);
   const member=await post('/rest/v1/rpc/mi_movida_auth_lookup',{p_country:country,p_document:document,p_code:code});
   if(!member)return reply({ok:false,error:'Documento o código no válidos.'},401,origin);
   const profileResponse=await fetchImpl(url+'/rest/v1/integrantes?id=eq.'+encodeURIComponent(member.integrante_id)+'&select=id,nombres,apellidos,pais_iso2,pais_nombre,estado,municipio',{headers,redirect:'error',signal:AbortSignal.timeout(12000)});
   if(!profileResponse.ok)throw Error('profile_unavailable');const profile=(await profileResponse.json())[0];if(!profile)throw Error('profile_unavailable');
   if(mode==='validate'){
    const mod=await fetchImpl(url+'/rest/v1/mapa_moderadores?integrante_id=eq.'+encodeURIComponent(member.integrante_id)+'&activo=eq.true&select=integrante_id',{headers,redirect:'error',signal:AbortSignal.timeout(12000)});
    const rows=mod.ok?await mod.json():[];
    return reply({ok:true,integrante:{...profile,es_moderador:rows.length>0}},200,origin);
   }
   // Legacy codes must not mint an administrative/non-technical Auth identity.
   if(member.auth_email!=='integrante-'+member.integrante_id+'@auth.movidasst.com')return reply({ok:false,error:'El vínculo de acceso requiere revisión.'},409,origin);
   const link=await post('/auth/v1/admin/generate_link',{type:'magiclink',email:member.auth_email});
   const userId=link.id||link.user?.id,hash=link.hashed_token||link.properties?.hashed_token;
   if(!userId||!hash||(member.auth_user_id&&member.auth_user_id!==userId))throw Error('identity_conflict');
   await post('/rest/v1/rpc/mi_movida_link_auth',{p_integrante_id:member.integrante_id,p_auth_user_id:userId});
   return reply({ok:true,token_hash:hash,integrante:profile},200,origin);
  }catch{return reply({ok:false,error:'No fue posible completar la validación.'},503,origin);}
 };
}
