import {sessionContext} from './auth.ts';
type Env=(name:string)=>string|undefined;
const ORIGIN='https://www.movidasst.com';
function problem(code:string,status:number,origin:string|null){
 const h=new Headers({'content-type':'application/json','cache-control':'no-store, private','x-content-type-options':'nosniff'});
 if(origin===ORIGIN)h.set('access-control-allow-origin',ORIGIN);
 return new Response(JSON.stringify({error:{code}}),{status,headers:h});
}
async function limitedBody(req:Request,max:number){const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let total=0;try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();return null;}chunks.push(value);}const bytes=new Uint8Array(total);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.byteLength;}return bytes;}finally{reader.releaseLock();}}
function imageType(bytes:Uint8Array,type:string):string|null{
 if(type==='image/png'&&bytes.length>33&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x)&&new TextDecoder().decode(bytes.subarray(12,16))==='IHDR')return 'png';
 if(type==='image/jpeg'&&bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217)return 'jpg';
 if(type==='image/webp'&&bytes.length>20&&new TextDecoder().decode(bytes.subarray(0,4))==='RIFF'&&new TextDecoder().decode(bytes.subarray(8,12))==='WEBP')return 'webp';
 return null;
}
export async function photoRoute(req:Request,env:Env,origin:string|null):Promise<Response>{
 if(env('MM_ENABLE_MEMBER_READS')!=='true'||env('MM_ENABLE_PHOTOS')!=='true')return problem('not_enabled',503,origin);
 if(req.method!=='GET'&&req.method!=='POST')return problem('method_not_allowed',405,origin);
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 const base=env('SUPABASE_URL'),key=env('SUPABASE_ANON_KEY')||env('SUPABASE_PUBLISHABLE_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
 if(!base||!key||!service)return problem('not_configured',503,origin);
 const context=await sessionContext(new URL(base),key,service,token);
 if(!context)return problem('unauthorized',401,origin);
 const user=await fetch(new URL('/auth/v1/user',base),{headers:{apikey:key,authorization:'Bearer '+token},redirect:'error'});
 if(!user.ok)return problem('unauthorized',401,origin);
 const owner=(await user.json()).id;
 const headers={apikey:key,authorization:'Bearer '+token};
 const profileRes=await fetch(new URL('/rest/v1/rpc/mi_movida_profile',base),{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{}',redirect:'error'});
 if(!profileRes.ok)return problem('source_unavailable',503,origin);
 const profile=await profileRes.json();
 if(req.method==='GET'){
  if(typeof profile.foto_url!=='string')return problem('photo_unavailable',404,origin);
  const expected=new URL('/storage/v1/object/public/mi-movida-photos/'+owner+'/',base).href;
  if(!profile.foto_url.startsWith(expected))return problem('legacy_photo_unavailable',404,origin);
  const photo=await fetch(profile.foto_url,{redirect:'error'});
  if(!photo.ok)return problem('photo_unavailable',404,origin);
  const type=photo.headers.get('content-type')||'';
  const bytes=new Uint8Array(await photo.arrayBuffer());
  if(bytes.length>5242880||!imageType(bytes,type))return problem('invalid_photo',422,origin);
  const responseHeaders=new Headers({'content-type':type,'cache-control':'no-store, private','x-content-type-options':'nosniff'});
  if(origin===ORIGIN)responseHeaders.set('access-control-allow-origin',ORIGIN);
  return new Response(bytes,{status:200,headers:responseHeaders});
 }
 if(env('MM_ENABLE_MEMBER_WRITES')!=='true')return problem('not_enabled',503,origin);
 const length=Number(req.headers.get('content-length')||'0');
 if(length>5242880)return problem('photo_too_large',413,origin);
 const raw=await limitedBody(req,5242880);
 if(!raw)return problem('photo_too_large',413,origin);
 if(raw.length<20)return problem('invalid_photo',422,origin);
 const type=req.headers.get('content-type')||'';
 const ext=imageType(raw,type);
 if(!ext)return problem('invalid_photo',422,origin);
 const objectPath=owner+'/'+crypto.randomUUID()+'.'+ext;
 const upload=await fetch(new URL('/storage/v1/object/mi-movida-photos/'+objectPath,base),{method:'POST',headers:{...headers,'content-type':type,'x-upsert':'false'},body:raw,redirect:'error'});
 if(!upload.ok)return problem('photo_storage_unavailable',503,origin);
 const publicUrl=new URL('/storage/v1/object/public/mi-movida-photos/'+objectPath,base).href;
 const updated=await fetch(new URL('/rest/v1/rpc/mi_movida_set_photo',base),{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({p_url:publicUrl,p_version:profile.profile_version}),redirect:'error'});
 if(!updated.ok){
  await fetch(new URL('/storage/v1/object/mi-movida-photos/'+objectPath,base),{method:'DELETE',headers,redirect:'error'}).catch(()=>{});
  return problem(updated.status===409?'profile_conflict':'photo_update_failed',updated.status===409?409:503,origin);
 }
 const data=await updated.json();
 const h=new Headers({'content-type':'application/json','cache-control':'no-store, private'});
 if(origin===ORIGIN)h.set('access-control-allow-origin',ORIGIN);
 return new Response(JSON.stringify({data:{...data,version:String(data.profile_version)}}),{status:200,headers:h});
}
