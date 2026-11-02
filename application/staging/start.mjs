import {randomBytes} from 'node:crypto';
import {createApplication} from '../server/app.mjs';
import {createAcademia} from '../server/academia.mjs';
import {createSyntheticStore} from './store.mjs';
const port=Number(process.env.PORT||4174),origin='http://127.0.0.1:'+port,store=await createSyntheticStore(),outbox=[];
const functions=['core_webservice_get_site_info','core_enrol_get_users_courses','core_completion_get_course_completion_status','core_completion_get_activities_completion_status','gradereport_user_get_grade_items','mod_customcert_list_issues'];
const photos=new Map();
store.gateway.upload=async(p,b,type)=>{photos.set(p,{b,type});return 'https://staging.example.invalid/storage/v1/object/public/mi-movida-photos/'+p;};
store.gateway.remove=async p=>photos.delete(p);
const syntheticFetch=async(url,options={})=>{
 const u=new URL(url);
 if(u.hostname==='staging.example.invalid'){
  const photo=photos.get(u.pathname.split('/mi-movida-photos/')[1]);return new Response(photo?.b||null,{status:photo?200:404,headers:{'Content-Type':photo?.type||'text/plain'}});
 }
 if(u.hostname!=='moodle.staging.invalid')throw Error('Synthetic stage forbids external network');
 const f=new URLSearchParams(options.body),name=f.get('wsfunction'),user=Number(f.get('userid')||101);let value;
 if(name==='core_webservice_get_site_info')value={functions:functions.map(name=>({name}))};
 if(name==='core_enrol_get_users_courses')value=[{id:10,fullname:'[SINTÉTICO] Cultura preventiva',startdate:1790000000,enddate:0}];
 if(name==='core_completion_get_course_completion_status')value={completionstatus:{completed:false,completions:[]}};
 if(name==='core_completion_get_activities_completion_status')value={statuses:[{state:1},{state:1},{state:0}]};
 if(name==='gradereport_user_get_grade_items')value={usergrades:[{userid:user,gradeitems:[{itemtype:'course',graderaw:80,grademin:0,grademax:100,gradeformatted:'80.00'}]}]};
 if(name==='mod_customcert_list_issues')value=[{user:{id:user},issue:{id:501,customcertid:70,timecreated:1790000000,code:'SYNTHETIC-NOT-VALID'},template:{name:'[SINTÉTICO · SIN VALIDEZ] Constancia de prueba'},pdf:{haspdf:true,content:Buffer.from('%PDF-1.4\n% SYNTHETIC TEST ONLY - NO VALID CERTIFICATE\n%%EOF').toString('base64')}}];
 return new Response(JSON.stringify(value??{errorcode:'not_supported'}),{headers:{'Content-Type':'application/json'}});
};
const academia=createAcademia({baseUrl:'https://moodle.staging.invalid/',token:'synthetic-transport-only',fetchImpl:syntheticFetch});
const config={origin,secret:randomBytes(32).toString('base64'),stage:'synthetic-local',synthetic:true,mailer:async mail=>{if(!mail.to.endsWith('@example.invalid'))throw Error('Synthetic mail recipient required');outbox.push(mail);console.log('Correo SINTÉTICO capturado localmente; no fue enviado.');}};
const server=createApplication(config,{gateway:store.gateway,academia,fetchImpl:syntheticFetch});
server.listen(port,'127.0.0.1',()=>console.log('Pruebas sintéticas: '+origin+'/?vista=mi-movida\nIdentidad ficticia: CL / DEMO001 / A1B2C\nSin conexión a Supabase/Moodle/correo de producción.'));
process.on('SIGINT',()=>server.close(async()=>{await store.close();process.exit(0);}));
