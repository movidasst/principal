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
 '/api/me/badges':'mi_movida_badges',
 '/api/me/certificates':'mi_movida_certificates'
};
export async function handle(req:Request,env:(name:string)=>string|undefined=(name)=>Deno.env.get(name)):Promise<Response>{
 const origin=req.headers.get('origin');
 if(origin&&origin!==ORIGIN)return respond({error:{code:'origin_denied'}},403);
 if(req.method==='OPTIONS'){
  if(origin!==ORIGIN)return respond({error:{code:'origin_denied'}},403);
  return new Response(null,{status:204,headers:{'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type','access-control-max-age':'600','vary':'Origin'}});
 }
 const rawPath=new URL(req.url).pathname;
 const route=rawPath.replace(/^.*?\/mi-movida-api(?=\/|$)/,'');
 if(req.method==='GET'&&route==='/health')return respond({data:{status:'edge_gateway_ready',member_access:env('MM_ENABLE_MEMBER_READS')==='true'?'restricted':'disabled'}},200,origin);
 const rpc=READ_ROUTES[route];
 if(req.method!=='GET'||!rpc||env('MM_ENABLE_MEMBER_READS')!=='true')
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
  const result=await fetch(new URL('/rest/v1/rpc/'+rpc,supabase),{method:'POST',headers:{'apikey':publishable,'authorization':bearer,'content-type':'application/json'},body:'{}',redirect:'error'});
  if(!result.ok)return respond({error:{code:result.status===403?'forbidden':'source_unavailable'}},result.status===403?403:503,origin);
  const data=await result.json();
  return respond({data:rpc==='mi_movida_profile'?{...data,version:String(data.profile_version),recovery_channel:{verified:!!data.recovery_channel_verified}}:data},200,origin);
 }catch{return respond({error:{code:'source_unavailable'}},503,origin);}
}
if(import.meta.main)Deno.serve(req=>handle(req));
