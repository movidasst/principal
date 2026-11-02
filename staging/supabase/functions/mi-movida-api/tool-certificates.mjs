/** Read-only bridge to the original Moodle tool_certificate issuer.
 * Requires local_movidasstcertapi on Moodle and explicit WS service grants.
 * Identity is ALWAYS supplied by the authenticated Supabase session context.
 */
const FUNCTIONS=Object.freeze({
 info:'core_webservice_get_site_info',
 list:'local_movidasstcertapi_get_issues',
 pdf:'local_movidasstcertapi_get_pdf'
});
export class MoodleCertificateError extends Error {
 constructor(code){super(code);this.code=code;}
}
const positive=value=>{
 const id=Number(value);
 if(!Number.isSafeInteger(id)||id<1)throw new MoodleCertificateError('invalid_identity');
 return id;
};
function vettedUrl(value,base){
 try{
  const url=new URL(value);
  return url.origin===base.origin&&url.protocol===base.protocol&&url.pathname==='/admin/tool/certificate/index.php'&&url.searchParams.has('code')
   ?url.href:null;
 }catch{return null;}
}
/** @param {{baseUrl?:string,token?:string,fetchImpl?:typeof globalThis.fetch,timeoutMs?:number}} [options] */
export function createToolCertificateReader({baseUrl,token,fetchImpl=globalThis.fetch,timeoutMs=12000}={}){
 let base;
 try{base=new URL(baseUrl);}catch{throw new MoodleCertificateError('moodle_not_configured');}
 const local=['127.0.0.1','localhost','[::1]'].includes(base.hostname);
 if((base.protocol!=='https:'&&!(local&&base.protocol==='http:'))||base.username||base.password||base.search||base.hash)throw new MoodleCertificateError('invalid_configuration');
 if(typeof token!=='string'||token.length<8||/[\r\n]/.test(token))throw new MoodleCertificateError('moodle_not_configured');
 const endpoint=new URL('webservice/rest/server.php',base.href.endsWith('/')?base:base.href+'/');
 async function call(name,params={}){
  const form=new URLSearchParams({wstoken:token,wsfunction:name,moodlewsrestformat:'json'});
  for(const [key,value] of Object.entries(params))form.set(key,String(value));
  let data;
  try{
   const result=await fetchImpl(endpoint.href,{method:'POST',body:form,headers:{'content-type':'application/x-www-form-urlencoded'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
   if(!result.ok)throw new MoodleCertificateError('moodle_unavailable');
   data=await result.json();
  }catch(e){if(e instanceof MoodleCertificateError)throw e;throw new MoodleCertificateError('moodle_unavailable');}
  if(data&&typeof data==='object'&&!Array.isArray(data)&&(data.exception||data.errorcode))throw new MoodleCertificateError('moodle_service_unavailable');
  return data;
 }
 async function checkFunctions(){
  const data=await call(FUNCTIONS.info);
  if(!data||!Array.isArray(data.functions))throw new MoodleCertificateError('moodle_service_unavailable');
  const names=new Set(data.functions.map(x=>x?.name).filter(x=>typeof x==='string'));
  return {list:names.has(FUNCTIONS.list),pdf:names.has(FUNCTIONS.pdf)};
 }
 async function getCertificates(userId,{offset=0,limit=100}={}){
  const uid=positive(userId);
  if(!Number.isSafeInteger(offset)||offset<0||offset>100000||!Number.isSafeInteger(limit)||limit<1||limit>100)throw new MoodleCertificateError('invalid_pagination');
  const supported=await checkFunctions();
  if(!supported.list||!supported.pdf)return {status:'unsupported',certificates:[],message:'Para mostrar los certificados oficiales de Moodle, hay que habilitar los dos servicios de lectura de tool_certificate.'};
  const data=await call(FUNCTIONS.list,{userid:uid,limitfrom:offset,limitnum:limit});
  if(Number(data?.userid)!==uid||!Array.isArray(data?.items)||!Number.isSafeInteger(Number(data.total)))throw new MoodleCertificateError('moodle_owner_mismatch');
  const certificates=data.items.map(item=>{
   if(Number(item.userid)!==uid)throw new MoodleCertificateError('moodle_owner_mismatch');
   const id=positive(item.id);
   const rawTitle=String(item.title||'').replace(/<[^>]*>/g,'').slice(0,180);
   const course=String(item.course||'').replace(/<[^>]*>/g,'').slice(0,180);
   const issue=Number(item.issued_at),expiry=Number(item.expires_at);
   const verification=vettedUrl(item.verification_url,base);
   if(!verification||!Number.isSafeInteger(issue)||issue<1||!rawTitle)throw new MoodleCertificateError('invalid_certificate_response');
   return {
    id:String(id),title:course?rawTitle+' · '+course:rawTitle,
    source:'Academia Moodle',status:expiry>0&&expiry<Math.floor(Date.now()/1000)?'expired':'issued',
    issued_at:new Date(issue*1000).toISOString(),code:String(item.code||'').slice(0,80),
    verification_url:verification,download_url:'/api/me/certificates/moodle/'+id
   };
  });
  return {status:'available',certificates,next_offset:offset+certificates.length<Number(data.total)?offset+certificates.length:null};
 }
 async function downloadCertificate(userId,issueId){
  const uid=positive(userId),id=positive(issueId);
  const supported=await checkFunctions();
  if(!supported.pdf)throw new MoodleCertificateError('certificate_provider_not_enabled');
  const result=await call(FUNCTIONS.pdf,{userid:uid,issueid:id});
  if(Number(result?.userid)!==uid||Number(result?.issueid)!==id)throw new MoodleCertificateError('moodle_owner_mismatch');
  const encoded=result?.content_base64;
  if(typeof encoded!=='string'||encoded.length<12||encoded.length>14_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw new MoodleCertificateError('certificate_pdf_unavailable');
  let bytes;
  try{bytes=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0));}catch{throw new MoodleCertificateError('certificate_pdf_unavailable');}
  if(bytes.length>10_000_000||new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw new MoodleCertificateError('certificate_pdf_unavailable');
  return {content:bytes,filename:'certificado-moodle-'+id+'.pdf'};
 }
 return Object.freeze({getCertificates,downloadCertificate});
}
