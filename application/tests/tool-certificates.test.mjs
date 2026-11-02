import test from 'node:test';
import assert from 'node:assert/strict';
import {createToolCertificateReader} from '../../staging/supabase/functions/mi-movida-api/tool-certificates.mjs';
const make=(fn)=>createToolCertificateReader({baseUrl:'https://movidasst.org',token:'readonly-example-token',fetchImpl:async(url,opts)=>{const values=new URLSearchParams(opts.body);return {ok:true,json:async()=>fn(values.get('wsfunction'),values)};}});
const functions=[{name:'local_movidasstcertapi_get_issues'},{name:'local_movidasstcertapi_get_pdf'}];
const sample={status:'available',userid:42,total:1,items:[{id:901,userid:42,title:'Identificación de peligros',course:'SST',code:'1234567890AB',issued_at:1793581000,expires_at:0,verification_url:'https://movidasst.org/admin/tool/certificate/index.php?code=1234567890AB'}]};
test('No confundir Customcert con tool_certificate ni inventar certificados',async()=>{
 const reader=make(name=>name==='core_webservice_get_site_info'?{functions:[]}:sample);
 const result=await reader.getCertificates(42);
 assert.equal(result.status,'unsupported');
 assert.deepEqual(result.certificates,[]);
});
test('Listar solamente certificados cuyo propietario coincida con la sesión Moodle',async()=>{
 const reader=make(name=>name==='core_webservice_get_site_info'?{functions}:sample);
 const result=await reader.getCertificates(42);
 assert.equal(result.status,'available');
 assert.equal(result.certificates[0].source,'Academia Moodle');
 assert.equal(result.certificates[0].id,'901');
 assert.equal(result.certificates[0].status,'issued');
 assert.equal(result.certificates[0].download_url,'/api/me/certificates/moodle/901');
});
test('Bloquear respuesta de certificados de otro estudiante',async()=>{
 const reader=make(name=>name==='core_webservice_get_site_info'?{functions}:{...sample,userid:43});
 await assert.rejects(()=>reader.getCertificates(42),/moodle_owner_mismatch/);
});
test('Rechazar URL de verificación ajena a Moodle',async()=>{
 const reader=make(name=>name==='core_webservice_get_site_info'?{functions}:{...sample,items:[{...sample.items[0],verification_url:'https://evil.example/certificate?code=abc'}]});
 await assert.rejects(()=>reader.getCertificates(42),/invalid_certificate_response/);
});
test('PDF original sin emitir uno nuevo; verificar propietario y bytes',async()=>{
 const bytes=Buffer.from('%PDF-1.4\nTEST\n%%EOF');
 const reader=make(name=>name==='core_webservice_get_site_info'?{functions}:{userid:42,issueid:901,content_base64:bytes.toString('base64')});
 const pdf=await reader.downloadCertificate(42,901);
 assert.deepEqual(Buffer.from(pdf.content),bytes);
 assert.equal(pdf.filename,'certificado-moodle-901.pdf');
});
test('No permitir descargar PDF de otro usuario',async()=>{
 const reader=make(name=>name==='core_webservice_get_site_info'?{functions}:{userid:43,issueid:901,content_base64:Buffer.from('%PDF-1.4').toString('base64')});
 await assert.rejects(()=>reader.downloadCertificate(42,901),/moodle_owner_mismatch/);
});
