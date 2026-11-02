// Edge gateway for GitHub Pages: safe, isolated starting point.
// Do not enable member data endpoints until Auth/session port is completed.
const ORIGIN = 'https://www.movidasst.com';
const JSON_HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
function respond(data:unknown,status=200,origin:string|null=null){
  const headers=new Headers(JSON_HEADERS);
  if(origin===ORIGIN){headers.set('access-control-allow-origin',ORIGIN);headers.set('vary','Origin');}
  return new Response(JSON.stringify(data),{status,headers});
}
export function handle(req:Request):Response{
  const origin=req.headers.get('origin');
  if(origin && origin!==ORIGIN) return respond({error:{code:'origin_denied',message:'Origen no autorizado.'}},403);
  if(req.method==='OPTIONS'){
    if(origin!==ORIGIN)return respond({error:{code:'origin_denied'}},403);
    return new Response(null,{status:204,headers:{'access-control-allow-origin':ORIGIN,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'authorization,apikey,content-type,x-csrf-token','access-control-max-age':'600','vary':'Origin'}});
  }
  const pathname=new URL(req.url).pathname;
  if(req.method==='GET' && pathname.endsWith('/health'))return respond({data:{status:'edge_gateway_ready',member_access:'disabled',environment:'review'}},200,origin);
  return respond({error:{code:'not_enabled',message:'El acceso privado aún no está habilitado en este entorno.'}},503,origin);
}
if(import.meta.main)Deno.serve(handle);
