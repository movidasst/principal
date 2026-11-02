'use strict';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>new Intl.NumberFormat('es-CL').format(Number.isFinite(Number(value))?Number(value):0);
const date=value=>{if(!value)return 'Sin fecha';const d=new Date(value);return Number.isNaN(d.valueOf())?'Sin fecha':new Intl.DateTimeFormat('es-CL',{dateStyle:'medium'}).format(d);};
const routes=[
 ['inicio','home','Panel principal','MI ESPACIO'],['credencial','id','Mi credencial'],['perfil','edit','Editar perfil'],
 ['puntos','chart','Mis puntos y ranking','MI RECORRIDO'],['insignias','award','Mis insignias'],['actividad','activity','Mi actividad'],
 ['aprendizaje','book','Mi aprendizaje'],['certificados','cert','Mis certificados'],['cuenta','shield','Mi cuenta y seguridad','MI CUENTA']
];
const EDGE_API_BASE=document.querySelector('meta[name="mi-movida-edge-api"]')?.content?.replace(/\/$/,'')||'';
const state={edgeAccessToken:null,edgeRefreshToken:null,photoObjectUrl:null,geoCredentialMode:'verificacion',session:null,profile:null,route:'inicio',drawer:false,tab:'movimientos',source:'Todas',scope:'general',offset:0,cache:{},error:null,busy:false,loadId:0,recoveryToken:null,channelToken:null,environment:null};
const root=document.querySelector('#root');
class ApiError extends Error{constructor(message,status,code){super(message);this.status=status;this.code=code;}}
async function api(path,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 const headers={'Accept':'application/json',...options.headers};
 if(EDGE_API_BASE&&state.edgeAccessToken)headers.Authorization='Bearer '+state.edgeAccessToken;
 if(options.body&&typeof options.body==='string')headers['Content-Type']='application/json';
 if(!['GET','HEAD'].includes(options.method||'GET')&&state.session?.csrf_token)headers['X-CSRF-Token']=state.session.csrf_token;
 try{
  let response=await fetch(EDGE_API_BASE?EDGE_API_BASE+path:path,{...options,headers,credentials:EDGE_API_BASE?'omit':'same-origin',cache:'no-store',redirect:'error',signal:controller.signal});
  if(response.status===401&&EDGE_API_BASE&&state.edgeRefreshToken&&path!=='/api/session/refresh'&&path!=='/api/session/bootstrap'&&path!=='/api/session/logout'){
   const refresh=await fetch(EDGE_API_BASE+'/api/session/refresh',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({refresh_token:state.edgeRefreshToken}),cache:'no-store',credentials:'omit',redirect:'error',signal:controller.signal});
   const renewed=await refresh.json().catch(()=>null);
   if(refresh.ok&&renewed?.data?.access_token&&renewed?.data?.refresh_token){
    state.edgeAccessToken=renewed.data.access_token;state.edgeRefreshToken=renewed.data.refresh_token;
    headers.Authorization='Bearer '+state.edgeAccessToken;
    response=await fetch(EDGE_API_BASE+path,{...options,headers,credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});
   }
  }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){
   if(response.status===401&&state.session?.authenticated){clearPrivateState();renderLogin('Tu sesión terminó. Ingresa nuevamente.');}
   throw new ApiError(payload.error?.message||payload.message||messageFor(response.status),response.status,payload.error?.code||payload.code);
  }
  return payload;
 }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(error.name==='AbortError'?'La consulta tardó demasiado. Inténtalo nuevamente.':'No se pudo conectar con el servicio. Comprueba tu conexión.',0,'network_error');}
 finally{clearTimeout(timer);}
}
function messageFor(status){return ({401:'No fue posible validar el acceso.',403:'No tienes permiso para esta operación.',409:'La identidad o los datos necesitan revisión antes de continuar.',422:'Revisa los datos indicados.',429:'Demasiados intentos. Espera unos minutos antes de volver a intentar.',503:'La fuente está temporalmente fuera de servicio.'})[status]||'No se pudo completar la operación.';}
function data(payload){return payload&&Object.prototype.hasOwnProperty.call(payload,'data')?payload.data:payload;}
function items(payload){const d=data(payload);return Array.isArray(d)?d:d?.items||d?.courses||d?.certificates||d?.badges||[];}
function safeUrl(value,{localOnly=false}={}){
 if(!value)return null;
 try{const u=new URL(value,location.origin);if(u.origin===location.origin&&u.protocol===location.protocol)return u.href;if(!localOnly&&u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
 return null;
}
function externalLink(label,value,cls='btn ghost'){if(typeof value==='string'&&/^\/api\/me\/certificates\/moodle\/[0-9]+$/.test(value))return '<button type="button" class="'+cls+'" data-action="download-moodle" data-file="'+esc(value)+'">'+esc(label)+icon('download')+'</button>';const url=safeUrl(value);return url?'<a class="'+cls+'" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+icon('arrow')+'</a>':'';}
function btn(label,route,ico='arrow',cls='primary'){return '<a class="btn '+cls+'" href="#/'+route+'">'+esc(label)+icon(ico)+'</a>';}
function textLink(label,route){return '<a class="text-link" href="#/'+route+'">'+esc(label)+icon('arrow')+'</a>';}
function note(text,cls=''){return '<div class="note '+cls+'">'+icon('info')+'<span>'+esc(text)+'</span></div>';}
function empty(text){return '<div class="empty">'+esc(text)+'</div>';}
function failure(error,retry=true){return '<section class="panel error-panel" role="alert"><h2>Esta información no está disponible</h2><p class="subtitle">'+esc(error.message||'No se pudo consultar la fuente.')+'</p>'+(retry?'<button class="btn primary spaced" data-action="retry">Volver a consultar</button>':'')+'</section>';}
function loading(){return '<section class="panel" role="status"><div class="loading-bar"></div><h2>Consultando tus fuentes…</h2><p class="subtitle">La información se consulta con los permisos de tu sesión.</p></section>';}
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),4500);}
function modal(title,text,extra=''){document.querySelector('#modal-content').innerHTML='<h2 id="modal-title">'+esc(title)+'</h2><p>'+esc(text)+'</p>'+extra;document.querySelector('#modal').showModal();}
function displayName(){return [state.profile?.nombres,state.profile?.apellidos].filter(Boolean).join(' ').trim()||state.session?.person?.display_name||'Integrante';}
function initials(){return esc(displayName().split(/\s+/).map(s=>s[0]).slice(0,2).join(''));}
function avatar(large=false){return '<span class="avatar '+(large?'avatar-lg':'')+'">'+(safePhotoUrl(state.profile?.foto_url)?'<img src="'+esc(safePhotoUrl(state.profile.foto_url))+'" alt="Tu fotografía" class="avatar-photo" referrerpolicy="no-referrer">':initials())+'</span>';}
function brand(){return '<div class="brand"><img src="/logo-oficial-movida-sst-plus.png" alt="La Movida de SST+"><span><strong>Mi Movida<span class="brand-dot">.</span></strong><small>LA MOVIDA DE SST+</small></span></div>';}
function navLinks(){return routes.map(([key,ico,label,group])=>(group?'<div class="nav-group">'+group+'</div>':'')+'<a class="nav-link '+(state.route===key?'active':'')+'" href="#/'+key+'"'+(state.route===key?' aria-current="page"':'')+'>'+icon(ico)+esc(label)+'</a>').join('');}
function header(){
 const headings={
  inicio:['TU COMUNIDAD, TU RECORRIDO','Qué bueno verte, '+displayName().split(' ')[0]+'.','Tu aprendizaje, tus aportes y tus logros, en un solo lugar.'],
  credencial:['MI IDENTIDAD','Mi credencial','Tu pertenencia a La Movida de SST+, con tus datos actuales.'],
  perfil:['MI IDENTIDAD','Editar perfil','Actualiza tu información y decide qué compartes.'],
  puntos:['CADA APORTE CUENTA','Mis puntos y ranking','Tu saldo oficial y el historial de sus fuentes.'],
  insignias:['RECONOCIMIENTOS','Mis insignias','Los reconocimientos confirmados de tu recorrido.'],
  actividad:['MI PARTICIPACIÓN','Mi actividad','Tus estudios, consultas y aportes confirmados.'],
  aprendizaje:['CRECER EN COMUNIDAD','Mi aprendizaje','Matrícula, avance y notas desde la fuente académica.'],
  certificados:['MIS LOGROS','Mis certificados','Documentos emitidos y verificables, separados de cursos completados.'],
  cuenta:['TÚ TIENES EL CONTROL','Mi cuenta y seguridad','Tu acceso y privacidad sin una nueva contraseña.']
 }[state.route];
 return '<header class="page-head"><div><span class="eyebrow">'+esc(headings[0])+'</span><h1 id="page-title" tabindex="-1">'+esc(headings[1])+'</h1><p class="subtitle">'+esc(headings[2])+'</p></div>'+(state.route==='inicio'?btn('Mi perfil','perfil','edit','ghost'):'')+'</header>';
}
function shell(content){
 document.title=routes.find(r=>r[0]===state.route)?.[2]+' · Mi Movida';
 root.setAttribute('aria-busy',String(state.busy));
 root.innerHTML='<aside class="sidebar">'+brand()+'<nav aria-label="Navegación principal">'+navLinks()+'</nav><div class="side-bottom"><div class="side-note">La Movida de SST+<br>De la reacción a la prevención.</div><button class="nav-link logout" data-action="logout">'+icon('out')+'Cerrar sesión</button></div></aside><div class="workspace"'+(state.drawer?' inert':'')+'><div class="topbar"><button class="icon-btn menu-button" data-action="menu" aria-label="Abrir menú">'+icon('menu')+'</button><div class="breadcrumb">Mi espacio / <b>'+esc(routes.find(r=>r[0]===state.route)?.[2])+'</b></div><div class="topbar-right"><span class="private-chip">'+icon('lock')+'Espacio personal</span><a href="#/cuenta" class="user-button" aria-label="Mi cuenta">'+avatar()+'<span><strong>'+esc(displayName())+'</strong><small>Integrante</small></span></a></div></div><main id="main" class="content">'+header()+content+'<footer class="footer"><span>La Movida de SST+ · De la reacción a la prevención.</span><span>Información privada · Cierre de sesión disponible</span></footer></main></div><nav class="mobile-nav" aria-label="Navegación móvil"'+(state.drawer?' inert':'')+'>'+[['inicio','home','Inicio'],['puntos','chart','Mis XP'],['aprendizaje','book','Aprender'],['credencial','id','Credencial']].map(([r,i,t])=>'<a href="#/'+r+'" class="'+(state.route===r?'active':'')+'">'+icon(i)+t+'</a>').join('')+'<button data-action="menu" aria-label="Más secciones">'+icon('menu')+'Más</button></nav>'+(state.drawer?'<section class="mobile-drawer" role="dialog" aria-modal="true" aria-label="Todas las secciones"><div class="drawer-top">'+brand()+'<button class="icon-btn" id="drawer-close" data-action="menu" aria-label="Cerrar menú">'+icon('close')+'</button></div><nav>'+navLinks()+'</nav><button class="nav-link logout" data-action="logout">'+icon('out')+'Cerrar sesión</button></section>':'');
}
function loginFields(prefix=''){return '<label class="field"><span>Cédula o documento de identidad</span><input name="document" maxlength="40" autocomplete="username" autocapitalize="characters" spellcheck="false" required></label>';}
function renderLogin(message=''){
 state.busy=false;root.setAttribute('aria-busy','false');document.title='Acceso · Mi Movida';
 root.innerHTML='<main class="login-shell" id="main"><section class="login-art">'+brand()+'<span class="eyebrow">DE LA REACCIÓN A LA PREVENCIÓN</span><h1>Tu comunidad.<br>Tu recorrido.<br><span>Tu movida.</span></h1><p>Un solo espacio para tu identidad, tus aportes y tu aprendizaje.</p><div class="login-orbit"><img src="./assets/comunicacion-asertiva.svg" alt=""><img src="./assets/negociacion.svg" alt=""><img src="./assets/liderazgo-preventivo.svg" alt=""></div></section><section class="login-form"><span class="eyebrow">BIENVENIDO A MI MOVIDA</span><h2>Vuelve a tu espacio.</h2><p class="subtitle">Usa tu identidad actual de integrante. No necesitas registrarte de nuevo.</p>'+(message?'<div class="note amber" role="alert">'+esc(message)+'</div>':'')+(state.recoveryToken?'<form id="consume-recovery"><p class="subtitle">Confirma que deseas recuperar tu acceso. El enlace se utiliza una sola vez y no cambia tu contraseña de Moodle.</p><button type="submit" class="btn primary wide spaced">Confirmar recuperación</button></form>':'<form id="login-form">'+loginFields()+'<label class="field"><span>Código de integrante</span><input name="member_code" type="password" maxlength="5" minlength="5" pattern="[A-Za-z0-9]{5}" autocapitalize="characters" autocomplete="current-password" required></label><button type="submit" class="btn primary wide">Ingresar '+icon('arrow')+'</button></form><button class="login-help" data-action="recovery">¿Necesitas recuperar tu acceso?</button>')+'<p class="login-note">'+icon('shield')+' Tu código no se guarda en este navegador.</p></section></main>';
}
function clearPrivateState(){if(state.photoObjectUrl)URL.revokeObjectURL(state.photoObjectUrl);state.photoObjectUrl=null;state.edgeAccessToken=null;state.edgeRefreshToken=null;state.session=null;state.profile=null;state.cache={};state.error=null;state.drawer=false;state.loadId++;document.querySelector('#modal')?.close();}
async function refreshSession(){const payload=data(await api('/api/session'));state.session=payload;state.environment=payload.environment;document.querySelector(".demo-bar").textContent=payload.environment==="synthetic-local"?"STAGING LOCAL · DATOS SINTÉTICOS · NO USAR DATOS REALES":"MI MOVIDA · ESPACIO PERSONAL";return payload;}
async function boot(){
 const url=new URL(location.href),token=url.searchParams.get('recovery_token')||url.searchParams.get('token'),channelToken=url.searchParams.get('channel_token');
 if(channelToken){state.channelToken=channelToken;url.searchParams.delete('channel_token');history.replaceState(null,'',url.pathname+url.search+url.hash);}
 if(token){state.recoveryToken=token;url.searchParams.delete('token');url.searchParams.delete('recovery_token');history.replaceState(null,'',url.pathname+url.search+url.hash);}
 try{await refreshSession();if(state.session?.authenticated&&!state.recoveryToken){if(state.channelToken)location.hash='#/cuenta';await navigate();}else renderLogin(state.channelToken?'Ingresa para confirmar tu canal de recuperación.':'');}
 catch(error){renderLogin(error.message);}
}
function safePhotoUrl(value){
 try{const url=new URL(String(value||''));if(url.protocol!=='https:')return '';
 const h=url.hostname.toLowerCase();
 if(h==='drive.google.com'||h==='drive.usercontent.google.com'||h==='lh3.googleusercontent.com'||h.endsWith('.googleusercontent.com')||h==='lfdmbkzghnwvsapxypvt.supabase.co')return url.href;
 }catch{}
 return '';
}
async function getProfile(){const p=data(await api('/api/me/profile'));state.profile=p.profile||p;return state.profile;}
function getRoute(){const route=location.hash.replace(/^#\//,'');return routes.some(r=>r[0]===route)?route:'inicio';}
async function navigate(){
 if(!state.session?.authenticated){renderLogin();return;}
 state.route=getRoute();state.drawer=false;state.error=null;state.busy=true;const id=++state.loadId;shell(loading());
 try{
  if(!state.profile)await getProfile();
  const result=await loadRoute(state.route);
  if(id!==state.loadId||!state.session?.authenticated)return;
  state.cache[state.route]=result;state.busy=false;renderCurrent();document.querySelector('#page-title')?.focus({preventScroll:true});
 }catch(error){if(id!==state.loadId||!state.session?.authenticated)return;state.error=error;state.busy=false;shell(failure(error));}
}
async function loadRoute(route){
 if(route==='perfil'||route==='cuenta')return {profile:await getProfile()};
 if(route==='credencial')return {profile:state.profile};
 if(route==='inicio'){
  const values=await Promise.allSettled([api('/api/me/xp?scope=general'),api('/api/me/activity'),api('/api/me/learning'),api('/api/me/badges')]);
  return Object.fromEntries(['xp','activity','learning','badges'].map((key,i)=>[key,values[i].status==='fulfilled'?{value:data(values[i].value)}:{error:values[i].reason}]));
 }
 const endpoints={puntos:'/api/me/xp?scope='+encodeURIComponent(state.scope),insignias:'/api/me/badges',actividad:'/api/me/activity'+(state.source==='Todas'?'':'?source='+encodeURIComponent(state.source)),aprendizaje:'/api/me/learning',certificados:'/api/me/certificates'};
 return data(await api(endpoints[route]));
}
function renderCurrent(){if(!state.session?.authenticated){renderLogin();return;}const content=state.error?failure(state.error):views[state.route](state.cache[state.route]||{});shell(content);}
function stat(ico,value,label,cls=''){return '<div class="stat"><span class="stat-icon '+cls+'">'+icon(ico)+'</span><div><strong>'+esc(value)+'</strong><small>'+esc(label)+'</small></div></div>';}
function rankingFrom(d){return d.ranking||d.summary||d;}
function overview(d){
 const x=d.xp?.value,r=x?rankingFrom(x):null,activity=d.activity?.value,badges=d.badges?.value;
 const activityItems=items(activity),badgeItems=items(badges);
 return '<section class="hero"><div class="hero-copy"><span class="eyebrow">DE LA REACCIÓN A LA PREVENCIÓN</span><h2>Tu próxima movida<br>empieza aquí.</h2><p>Aprende, participa y reconoce tu recorrido en la comunidad.</p>'+btn('Mi aprendizaje','aprendizaje')+'</div><div class="hero-badge">'+avatar(true)+'<div><strong>'+esc(displayName())+'</strong><small>'+esc(state.profile?.pais_nombre||state.profile?.pais_iso2||'Integrante')+'</small></div></div></section><section class="stats">'+stat('spark',r?fmt(r.puntos??r.total)+' XP':'—','Puntos oficiales')+stat('chart',r?.posicion?'#'+r.posicion:'—',r?.fuera_de_ranking?'Fuera del ranking':'Posición general','gold')+stat('award',badges?String(badgeItems.length):'—','Reconocimientos consultados','blue')+stat('activity',activity?String(activityItems.length):'—','Actividades consultadas','lilac')+'</section><div class="dashboard-grid"><div class="stack"><section class="panel"><div class="panel-head"><h2>Mi aprendizaje</h2>'+textLink('Ver todo','aprendizaje')+'</div>'+(d.learning?.error?note(d.learning.error.message,'amber'):learningList(d.learning?.value,true))+'</section><section class="panel"><div class="panel-head"><h2>Mis últimos aportes</h2>'+textLink('Ver actividad','actividad')+'</div>'+(d.activity?.error?note(d.activity.error.message,'amber'):activityList(activityItems.slice(0,4)))+'</section></div><div class="stack"><section class="panel"><h2>Mi identidad</h2><div class="credential-mini spaced">'+avatar()+'<div><strong>'+esc(displayName())+'</strong><small>'+esc(state.profile?.carrera||'Integrante de SST+')+'</small></div></div><div class="spaced">'+btn('Mi credencial','credencial','id','ghost')+'</div></section><section class="panel"><h2>Mis reconocimientos</h2>'+(d.badges?.error?note(d.badges.error.message,'amber'):badgeItems.length?'<p class="subtitle">'+esc(badgeItems[0].nombre||badgeItems[0].name||'Reconocimiento confirmado')+'</p>':empty('Todavía no aparecen reconocimientos confirmados.'))+'<div class="spaced">'+textLink('Ver insignias','insignias')+'</div></section>'+(d.xp?.error?note(d.xp.error.message,'amber'):'')+'</div></div>';
}
function geoCredentialUrl(publicId){
 const id=String(publicId||'').trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return '';
 // GEO ya procesa ?id=UUID y abre el verificador oficial en #/credencial.
 // Nunca colocar cédula, código de integrante, JWT ni correo en la URL.
 return 'https://directorio.movidasst.com/?id='+encodeURIComponent(id)+'#/credencial';
}
function credential(){
 const officialUrl=geoCredentialUrl(state.profile?.public_id);
 const inAccess=state.geoCredentialMode==='acceso';
 const frameUrl=inAccess?'https://directorio.movidasst.com/#/credencial':officialUrl;
 if(!officialUrl)return '<section class="panel"><h2>Mi credencial oficial</h2>'+note('Aún no se pudo obtener el identificador público de tu credencial. Por seguridad no generamos otra credencial ni un QR alternativo.')+'<div class="form-actions"><a class="btn primary" href="https://directorio.movidasst.com/#/credencial" target="_blank" rel="noopener noreferrer">Abrir Directorio GEO</a></div></section>';
 return '<section class="panel geo-credential-panel"><div class="panel-head"><div><h2>Mi credencial oficial</h2><p class="subtitle">Directorio GEO · verificación original de La Movida de SST+</p></div><span class="chip">OFICIAL</span></div><p class="subtitle">Esta vista viene directamente de Directorio: no reproducimos ni modificamos su diseño, QR o datos. Si necesitas descargar tu credencial de integrante, abre su acceso privado en Directorio con tu cédula y código habitual.</p><div class="form-actions"><button type="button" class="btn '+(inAccess?'ghost':'primary')+'" data-action="geo-credential-verify">Verificación oficial</button><button type="button" class="btn '+(inAccess?'primary':'ghost')+'" data-action="geo-credential-access">Acceder y descargar aquí</button></div><div class="geo-credential-frame-wrap"><iframe class="geo-credential-frame" title="'+(inAccess?'Acceso privado a la credencial original de GEO':'Verificación oficial de mi credencial en Directorio GEO')+'" src="'+esc(frameUrl)+'" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"></iframe></div><p class="subtitle">'+(inAccess?'Para descargar, el Directorio solicita tu cédula y código habituales dentro de su propio formulario. Mi Movida no transmite ni almacena ese código en la URL.':'Esta vista muestra la verificación pública de tu credencial. Puedes acceder a la descarga original usando la otra pestaña.')+'</p><div class="form-actions"><a class="btn ghost" href="'+esc(frameUrl)+'" target="_blank" rel="noopener noreferrer">Abrir esta vista en Directorio</a></div></section>';
}
function field(name,label,value,type='text',extra=''){return '<label class="field"><span>'+esc(label)+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value||'')+'" maxlength="160" '+extra+'></label>';}
function toggle(name,title,text){return '<label class="toggle-row"><span><strong>'+esc(title)+'</strong><p>'+esc(text)+'</p></span><input class="switch" type="checkbox" name="'+name+'" '+(state.profile?.[name]?'checked':'')+'></label>';}
function profileView(){
 const p=state.profile||{};
 return '<form id="profile-form"><div class="two-col"><section class="panel"><h2>Mi perfil profesional</h2><p class="subtitle">'+esc(displayName())+'</p><div class="field-grid spaced">'+field('pais_iso2','País de residencia · ISO',p.pais_iso2,'text','pattern="[A-Za-z]{2}" maxlength="2" required')+field('estado','Estado o región',p.estado)+field('municipio','Municipio o ciudad',p.municipio)+field('correo','Correo de contacto',p.correo,'email','readonly')+field('telefono_e164','Teléfono internacional',p.telefono_e164,'tel','pattern="[+][1-9][0-9]{6,14}" placeholder="+…"')+field('whatsapp_username','Usuario de WhatsApp',p.whatsapp_username)+field('grado','Grado de formación',p.grado)+field('carrera','Profesión o carrera',p.carrera)+field('postgrado','Postgrado',p.postgrado)+field('doctorado','Doctorado',p.doctorado)+field('laboral','Situación laboral',p.laboral)+field('linkedin','Perfil de LinkedIn',p.linkedin,'url')+'</div><div class="spaced">'+note('El documento y la identidad canónica requieren un proceso de verificación. Cambiar el país de residencia no cambia el país emisor del documento.')+'</div></section><section class="panel"><h2>Privacidad del perfil</h2>'+note('Preferencias en revisión: los consumidores antiguos del Directorio necesitan adaptarse antes de garantizar estos controles en todo el ecosistema.')+toggle('mostrar_correo','Mostrar correo','Oculto salvo autorización expresa.')+toggle('mostrar_wasap','Mostrar WhatsApp','Publicar tu teléfono es una decisión independiente.')+toggle('mostrar_whatsapp_username','Mostrar usuario de WhatsApp','Control independiente del número de teléfono.')+toggle('mostrar_insignias','Mostrar insignias','Publica únicamente reconocimientos autorizados.')+'<div class="divider"></div><h3>Fotografía del Directorio</h3>'+avatar(true)+'<p class="subtitle">Esta foto ya se registró en Google Drive; Mi Movida solo muestra el enlace almacenado en Supabase. Para cambiarla, utiliza el procedimiento actual de Registro o Directorio.</p></section></div><div class="form-actions"><button type="submit" class="btn primary">Guardar cambios '+icon('check')+'</button></div><p id="profile-message" role="status"></p></form>';
}
function sourceSelect(){return '<label><span class="sr-only">Filtrar fuente</span><select class="btn" id="source-filter">'+['Todas','Estudia','Participa','Inteligencia','Desarrolla'].map(v=>'<option '+(state.source===v?'selected':'')+'>'+v+'</option>').join('')+'</select></label>';}
function pointsView(d){
 const r=rankingFrom(d),history=d.historial||d.movements||[],breakdown=d.desglose||d.sources||[];
 return '<div class="two-col"><section class="panel"><span class="eyebrow">SALDO OFICIAL</span><div class="xp-big">'+fmt(r.puntos??r.total)+' <span>XP</span></div><span class="chip">'+esc(r.nivel||'Participante')+'</span><p class="subtitle">'+(r.fuera_de_ranking||r.status==='excluded'?'Fuera del ranking competitivo. Conservas tus puntos e historial.':r.posicion?'Posición #'+esc(r.posicion):'Sin posición competitiva.')+'</p>'+(r.siguiente_nivel?'<p class="subtitle">'+fmt(r.xp_faltante)+' XP para '+esc(r.siguiente_nivel)+'.</p>':'')+'</section><section class="panel"><h2>Fuentes de tus puntos</h2>'+(breakdown.length?breakdown.map(s=>'<div class="source-row"><span>'+esc(s.fuente||s.source||s.tipo||'Otros')+'</span><b>'+fmt(s.puntos??s.total)+' XP</b></div>').join(''):empty('La fuente no devolvió un desglose. El saldo no se reconstruye desde esta página.'))+'</section></div><section class="panel wide-panel"><div class="tabs" aria-label="Vista de puntos"><button class="tab '+(state.tab==='movimientos'?'active':'')+'" data-tab="movimientos">Mis movimientos</button><button class="tab '+(state.tab==='ranking'?'active':'')+'" data-tab="ranking">Ranking</button></div>'+(state.tab==='ranking'?rankingView(state.cache.ranking):'<div class="panel-head"><h2>Mis movimientos</h2>'+sourceSelect()+'</div>'+historyTable(history)+(d.next_cursor?'<button class="btn spaced" data-action="more-xp">Ver movimientos anteriores</button>':''))+'</section>'+note('El saldo se calcula desde todos los eventos oficiales. Filtrar o paginar no modifica puntos ni posición.') ;
}
function historyTable(history){const filtered=state.source==='Todas'?history:history.filter(h=>String(h.fuente||h.source||'').toLowerCase()===state.source.toLowerCase());return filtered.length?'<div class="table-wrap"><table><thead><tr><th>Actividad</th><th>Fuente</th><th>Fecha</th><th>XP</th></tr></thead><tbody>'+filtered.map(h=>'<tr><td><strong>'+esc(h.motivo||h.tema||h.title||h.tipo)+'</strong></td><td>'+esc(h.fuente||h.source||h.tipo||'Sin clasificación')+'</td><td>'+esc(date(h.fecha||h.created_at))+'</td><td class="xp">'+fmt(h.puntos??h.xp)+'</td></tr>').join('')+'</tbody></table></div>':empty('No hay movimientos en este filtro.');}
function rankingView(d){
 if(!d)return '<div role="status">Consultando ranking…</div>';
 if(d.error)return failure(d.error);
 const rows=items(d);
 return '<div class="panel-head"><h2>Ranking de la comunidad</h2><label><span class="sr-only">Ámbito</span><select id="rank-scope" class="btn"><option value="general" '+(state.scope==='general'?'selected':'')+'>General</option><option value="estudios" '+(state.scope==='estudios'?'selected':'')+'>Todos los estudios</option></select></label></div>'+(rows.length?'<div class="table-wrap"><table><thead><tr><th>Posición</th><th>Integrante</th><th>XP</th></tr></thead><tbody>'+rows.map(r=>'<tr class="'+(String(r.public_id)===String(state.session.person.public_id)?'you':'')+'"><td>#'+esc(r.posicion)+'</td><td><strong>'+esc(r.nombre||r.display_name)+'</strong><small>'+esc(r.nivel||'')+'</small></td><td class="xp">'+fmt(r.puntos??r.total)+'</td></tr>').join('')+'</tbody></table></div>':empty('No hay integrantes clasificados en este ámbito.'))+'<div class="form-actions"><button class="btn" data-action="rank-prev" '+(!state.offset?'disabled':'')+'>Anterior</button><button class="btn" data-action="rank-next" '+(rows.length<50?'disabled':'')+'>Siguiente</button></div>';
}
function activityList(rows){return rows.length?'<div class="timeline">'+rows.map(a=>'<article class="event"><span class="event-icon">'+icon(a.fuente==='Estudia'?'book':'activity')+'</span><div class="event-main"><strong>'+esc(a.titulo||a.title||a.motivo||a.tema)+'</strong><small>'+esc(a.fuente||a.source||'Actividad')+' · '+esc(date(a.fecha||a.created_at||a.submitted_at))+'</small>'+(a.detalle||a.description?'<p class="subtitle">'+esc(a.detalle||a.description)+'</p>':'')+'</div>'+((a.puntos??a.xp)!=null?'<span class="xp">'+fmt(a.puntos??a.xp)+' XP</span>':'')+'</article>').join('')+'</div>':empty('No aparecen actividades confirmadas en esta consulta.');}
function activityView(d){return '<section class="panel"><div class="panel-head"><h2>Mi recorrido</h2>'+sourceSelect()+'</div>'+activityList(items(d))+(d.next_cursor?'<button class="btn spaced" data-action="more-activity">Ver actividad anterior</button>':'')+'</section>';}
function badgeImage(b){const url=safeUrl(b.imagen_url||b.image_url,{localOnly:true});if(url)return '<img src="'+esc(url)+'" alt="">';const key=String(b.diagnostico||b.slug||'').toLowerCase();const assets={negociacion:'negociacion',comunicacion:'comunicacion-asertiva','comunicacion-asertiva':'comunicacion-asertiva',liderazgo:'liderazgo-preventivo'};return assets[key]?'<img src="./assets/'+assets[key]+'.svg" alt="">':'<span class="tile-icon">'+icon('award')+'</span>';}
function badgesView(d){const rows=items(d);return '<div class="badge-grid">'+(rows.length?rows.map(b=>'<article class="badge-card">'+badgeImage(b)+'<span class="eyebrow">'+esc(b.fuente||b.source||'Desarrolla SST')+'</span><h2>'+esc(b.nombre||b.name||b.diagnostico)+'</h2><p>'+esc(b.descripcion||b.description||'Reconocimiento confirmado por su fuente.')+'</p><span class="chip">'+esc(b.estado||b.status||'Confirmada')+'</span>'+(b.fecha||b.issued_at?'<p>'+esc(date(b.fecha||b.issued_at))+'</p>':'')+externalLink('Verificar',b.verificacion_url||b.verification_url)+'</article>').join(''):'<section class="panel">'+empty('Todavía no aparecen insignias confirmadas.')+'</section>')+'</div><div class="spaced">'+note('Una insignia de competencias, un nivel de participación y un certificado académico tienen significados distintos. La propiedad blockchain requiere su validación independiente.')+'</div>';}
function learningList(d,compact=false){
 const rows=items(d),selected=compact?rows.slice(0,1):rows;
 if(d?.status==='unavailable'||d?.available===false)return note(d.message||'La fuente académica no está disponible. No se interpreta como ausencia de matrícula.','amber');
 return selected.length?selected.map(c=>'<article class="learning-row course-card"><div class="course-art">'+icon('book')+'</div><div class="course-body"><span class="eyebrow">'+esc(c.source||'Academia Moodle')+'</span><h3>'+esc(c.name||c.title||c.nombre||c.fullname)+'</h3><p class="subtitle">'+esc(({in_progress:'En curso',completed:'Completado',unknown:'Estado no informado'})[c.completion_status]||c.status||c.estado||'Matriculado')+'</p><dl class="detail-grid spaced"><div><dt>Avance</dt><dd>'+((c.progress_percent??c.progress??c.avance)!=null?esc(c.progress_percent??c.progress??c.avance)+'%':'No informado')+'</dd></div><div><dt>Nota</dt><dd>'+esc(c.grade?.display??c.grade?.formatted??c.grade?.raw??c.grade_display??c.nota??'No informada')+'</dd></div></dl><div class="spaced">'+externalLink('Continuar en Moodle',c.url||c.viewurl)+'</div></div></article>').join(''):empty('No aparecen matrículas en la consulta académica actual.');
}
function learningView(d){return '<section class="panel"><div class="panel-head"><h2>Mis cursos</h2>'+(d.updated_at?'<small>Consultado: '+esc(date(d.updated_at))+'</small>':'')+'</div>'+learningList(d)+'</section><div class="spaced">'+note('Moodle conserva la matrícula, el avance y las notas. Un fallo de consulta se informa como no disponible, no como curso inexistente.')+'</div>';}
function certificateStatus(c){return c.status||c.estado||'unknown';}
function certificatesView(d){
 const all=items(d),moodle=all.filter(c=>String(c.source||c.fuente||'').toLowerCase().includes('moodle'));
 const desarrolla=all.filter(c=>!String(c.source||c.fuente||'').toLowerCase().includes('moodle'));
 const renderCertificates=(rows)=>rows.map(c=>{
  const status=certificateStatus(c),issued=['issued','emitido','valid','vigente','expired'].includes(status),revoked=['revoked','anulado','annulled'].includes(status);
  const label=revoked?'Anulado':status==='expired'?'Vencido':issued?'Emitido y registrado':status==='eligible'||status==='completed'?'Completado · emisión no confirmada':status;
  return '<article class="cert-row"><span class="cert-art">'+icon('cert')+'</span><div class="cert-info"><h3>'+esc(c.title||c.nombre||c.name||c.diagnostico||'Certificado')+'</h3><p>'+esc(c.source||c.fuente||'Fuente no informada')+(c.issued_at?' · '+date(c.issued_at):'')+'</p><span class="chip '+(!issued?'amber':'')+'">'+esc(label)+'</span></div>'+(issued?externalLink('Verificar',c.verification_url||c.verificacion_url)+externalLink('Descargar original',c.download_url||c.downloadable_url):'')+'</article>';
 }).join('');
 const moodleInfo=d.moodle_status==='unsupported'
  ?note('La Academia usa tool_certificate. Su servicio de consulta todavía debe habilitarse en Moodle; esto no significa que no tengas certificados.','amber')
  :d.moodle_status==='unavailable'
  ?note('No se pudo consultar Moodle en este momento. Los certificados existentes no se han modificado.','amber')
  :'';
 const academia='<section class="panel"><div class="panel-head"><h2>Certificados de la Academia Moodle</h2></div><p class="subtitle">Certificados originales con código y QR verificable emitidos en Moodle. No se generan copias ni certificados nuevos.</p>'
   +moodleInfo+(moodle.length?renderCertificates(moodle):empty(d.moodle_status==='available'?'No hay certificados de Moodle emitidos en el listado consultado.':'La consulta de certificados de la Academia todavía no está disponible aquí.'))
   +'<div class="form-actions"><a class="btn ghost" href="https://movidasst.org/admin/tool/certificate/my.php" target="_blank" rel="noopener noreferrer">Abrir mis certificados en Moodle '+icon('arrow')+'</a></div><p class="subtitle">Para verlos directamente en Moodle necesitas tener iniciada tu sesión de la Academia.</p></section>';
 const desarrollo='<section class="panel"><div class="panel-head"><h2>Certificados de la ruta Desarrolla</h2></div><p class="subtitle">Estos certificados pertenecen a la ruta Desarrolla, no a los cursos de la Academia Moodle.</p>'
   +(desarrolla.length?renderCertificates(desarrolla):empty('Todavía no aparecen certificados emitidos por Desarrolla.'))+'</section>';
 return '<div class="stack">'+academia+desarrollo+'</div>';
}
function accountView(){return '<div class="two-col"><section class="panel"><h2>Una identidad. Tu espacio.</h2><p class="subtitle">Mi Movida utiliza tu identidad actual de integrante. No almacena una contraseña nueva.</p><dl class="detail-grid spaced"><div><dt>Integrante</dt><dd>'+esc(displayName())+'</dd></div><div><dt>Correo de contacto</dt><dd>'+esc(state.profile?.correo||'No informado')+'</dd></div><div><dt>Sesión</dt><dd>Validada por el servidor</dd></div><div><dt>Vencimiento</dt><dd>'+esc(date(state.session.expires_at))+'</dd></div></dl><div class="spaced">'+note('La recuperación del acceso comunitario no cambia tu contraseña de Moodle.')+'</div></section><div class="stack"><section class="panel"><h2>Acceso y dispositivos</h2><div class="account-session">'+icon('device')+'<div class="session-info"><strong>Este navegador</strong><p>Acceso protegido mediante sesión privada.</p></div></div><button class="btn primary wide spaced" data-action="logout">Cerrar sesión '+icon('out')+'</button></section>'+recoveryChannelView()+'<section class="panel"><h2>Privacidad</h2><p class="subtitle">Revisa los datos que autorizas a mostrar públicamente.</p><div class="spaced">'+btn('Revisar preferencias','perfil','shield','ghost')+'</div></section></div></div>';}
const views={inicio:overview,credencial:credential,perfil:profileView,puntos:pointsView,insignias:badgesView,actividad:activityView,aprendizaje:learningView,certificados:certificatesView,cuenta:accountView};
function setFormBusy(form,busy){form.querySelectorAll('button,input,select').forEach(el=>{el.disabled=busy;});}
async function submitLogin(form){
 const f=new FormData(form),body=Object.fromEntries(['document','member_code'].map(k=>[k,String(f.get(k)||'').trim()]));
 setFormBusy(form,true);
 try{const result=data(await api('/api/session/bootstrap',{method:'POST',body:JSON.stringify(body)}));if(EDGE_API_BASE){state.edgeAccessToken=result.access_token;state.edgeRefreshToken=result.refresh_token;}form.reset();await refreshSession();if(!state.session.authenticated)throw new ApiError('No se pudo establecer una sesión segura. Vuelve a ingresar.',401);location.hash=state.channelToken?'#/cuenta':'#/inicio';await navigate();}
 catch(error){const secret=form.elements.member_code;if(secret)secret.value='';renderLogin(error.message);}
}
async function saveProfile(form){
 const f=new FormData(form),body={version:state.profile.version??state.profile.updated_at??state.profile.perfil_version??null};
 for(const k of ['pais_iso2','estado','municipio','telefono_e164','whatsapp_username','grado','carrera','postgrado','doctorado','laboral','linkedin'])body[k]=String(f.get(k)||'').trim()||null;
 body.pais_iso2=String(body.pais_iso2||'').toUpperCase();
 for(const k of ['mostrar_correo','mostrar_wasap','mostrar_whatsapp_username','mostrar_insignias'])body[k]=f.has(k);
 setFormBusy(form,true);
 try{await api('/api/me/profile',{method:'PATCH',body:JSON.stringify(body)});await getProfile();state.cache={};await navigate();toast('Tus cambios se guardaron. Los cambios de contacto pueden requerir verificación.');}
 catch(error){setFormBusy(form,false);const message=document.querySelector('#profile-message');message.textContent=error.status===409?'El perfil cambió mientras lo editabas. Recarga la consulta antes de guardar.':error.message;message.setAttribute('role','alert');}
}
async function logout(){
 const previous=state.session;
 try{await api('/api/session/logout',{method:'POST',body:'{}'});clearPrivateState();renderLogin();}
 catch(error){clearPrivateState();renderLogin('No se confirmó la revocación en el servidor. Se borraron los datos de esta pantalla. Reintenta el cierre desde este navegador.');state.session=previous?{csrf_token:previous.csrf_token,authenticated:false}:null;}
}
function recoveryForm(){modal('Recuperar acceso','Se enviarán instrucciones únicamente al canal previamente verificado. La respuesta no confirma si una persona está registrada.','<form id="recovery-form">'+loginFields()+'<button class="btn primary wide" type="submit">Solicitar recuperación</button></form>');}
async function requestRecovery(form){setFormBusy(form,true);const f=new FormData(form);try{await api('/api/session/recovery/request',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});document.querySelector('#modal').close();modal('Solicitud recibida','Si la identidad dispone de un canal verificado, recibirás instrucciones de acceso. Si no puedes acceder a ese canal, solicita asistencia administrativa.');}catch(error){toast(error.message);setFormBusy(form,false);}}
async function consumeRecovery(form){setFormBusy(form,true);try{const result=data(await api('/api/session/recovery/consume',{method:'POST',body:JSON.stringify({token:state.recoveryToken})}));if(EDGE_API_BASE){state.edgeAccessToken=result.access_token;state.edgeRefreshToken=result.refresh_token;}state.recoveryToken=null;await refreshSession();if(state.session.authenticated)await navigate();else renderLogin('Recuperación completada. Ya puedes ingresar con tu identidad actual.');}catch(error){renderLogin(error.message);}}
async function loadRanking(){state.cache.ranking=null;renderCurrent();try{state.cache.ranking=data(await api('/api/public/ranking?scope='+encodeURIComponent(state.scope)+'&offset='+state.offset+'&limit=50'));}catch(error){state.cache.ranking={error};}if(state.session?.authenticated)renderCurrent();}
async function more(kind){
 const current=state.cache[state.route],cursor=current.next_cursor;if(!cursor)return;
 const endpoint=kind==='xp'?'/api/me/xp?scope='+encodeURIComponent(state.scope)+'&cursor='+encodeURIComponent(cursor):'/api/me/activity?cursor='+encodeURIComponent(cursor)+(state.source==='Todas'?'':'&source='+encodeURIComponent(state.source));
 try{const next=data(await api(endpoint));if(kind==='xp')current.historial=[...(current.historial||[]),...(next.historial||next.movements||[])];else current.items=[...items(current),...items(next)];current.next_cursor=next.next_cursor;renderCurrent();}catch(error){toast(error.message);}
}
async function downloadMoodleDocument(route){
 if(!/^\/api\/me\/certificates\/moodle\/[0-9]+$/.test(route))return;
 const headers=state.edgeAccessToken?{Authorization:'Bearer '+state.edgeAccessToken}:{};
 try{
  const res=await fetch(EDGE_API_BASE?EDGE_API_BASE+route:route,{headers,credentials:EDGE_API_BASE?'omit':'same-origin',cache:'no-store',redirect:'error'});
  if(!res.ok||!(res.headers.get('content-type')||'').startsWith('application/pdf'))throw Error('No se pudo obtener el certificado emitido.');
  const file=await res.blob();if(file.size>10000000)throw Error('El certificado excede el límite autorizado.');
  const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='certificado-moodle-'+route.split('/').pop()+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(error){toast(error.message||'La descarga no está disponible.');}
}
document.addEventListener('submit',event=>{if(!['login-form','profile-form','recovery-form','consume-recovery','recovery-channel-form'].includes(event.target.id))return;event.preventDefault();const handlers={'login-form':submitLogin,'profile-form':saveProfile,'recovery-form':requestRecovery,'consume-recovery':consumeRecovery,'recovery-channel-form':setRecoveryChannel};handlers[event.target.id](event.target);});
document.addEventListener('click',async event=>{
 if(event.target.closest('.skip')){event.preventDefault();const main=document.querySelector('#main');main?.setAttribute('tabindex','-1');main?.focus();return;}
 const currentAnchor=event.target.closest('.mobile-drawer a');if(currentAnchor&&currentAnchor.getAttribute('href')===location.hash){state.drawer=false;renderCurrent();return;}
 const target=event.target.closest('[data-action],[data-tab]');if(!target)return;
 if(target.dataset.tab){state.tab=target.dataset.tab;if(state.tab==='ranking')await loadRanking();else renderCurrent();return;}
 const action=target.dataset.action;
 if(action==='confirm-channel'){await confirmRecoveryChannel(target);return;}
 if(action==='geo-credential-verify'){state.geoCredentialMode='verificacion';renderCurrent();return;}
 if(action==='geo-credential-access'){state.geoCredentialMode='acceso';renderCurrent();return;}
 if(action==='retry'){await navigate();return;}
 if(action==='menu'){state.drawer=!state.drawer;renderCurrent();document.querySelector(state.drawer?'#drawer-close':'.menu-button')?.focus();return;}
 if(action==='logout'){target.disabled=true;await logout();return;}
 if(action==='recovery'){recoveryForm();return;}
 if(action==='download-moodle'){await downloadMoodleDocument(target.dataset.file);return;}
 if(action==='more-xp'){await more('xp');return;}
 if(action==='more-activity'){await more('activity');return;}
 if(action==='rank-next'){state.offset+=50;await loadRanking();return;}
 if(action==='rank-prev'){state.offset=Math.max(0,state.offset-50);await loadRanking();}
});
document.addEventListener('change',async event=>{
 if(event.target.id==='source-filter'){state.source=event.target.value;if(state.route==='actividad')await navigate();else renderCurrent();}
 if(event.target.id==='rank-scope'){state.scope=event.target.value;state.offset=0;await loadRanking();}
});
document.querySelector('#close-modal').addEventListener('click',()=>document.querySelector('#modal').close());
document.querySelector('#modal').addEventListener('click',event=>{if(event.target===event.currentTarget)event.currentTarget.close();});
window.addEventListener('hashchange',()=>{window.scrollTo(0,0);navigate();});
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.drawer){state.drawer=false;renderCurrent();}});
window.addEventListener('pageshow',event=>{if(event.persisted){clearPrivateState();boot();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.session?.authenticated)refreshSession().then(session=>{if(!session.authenticated){clearPrivateState();renderLogin('Tu sesión terminó.');}}).catch(()=>{});});
boot();
// The existing principal PWA owns navigation; no parallel service worker.

function recoveryChannelView(){
 const channel=state.profile?.recovery_channel||state.session?.recovery_channel||{};
 return '<section class="panel"><h2>Canal de recuperación</h2><p class="subtitle">'+(channel.verified?'Canal verificado: '+esc(channel.masked_email||'Correo validado'):'No hay un canal de recuperación verificado para esta sesión.')+'</p>'+(state.channelToken?'<button class="btn primary spaced" data-action="confirm-channel">Confirmar este correo</button>':'<form id="recovery-channel-form" class="spaced">'+field('email','Correo que deseas verificar',state.profile?.correo,'email','required autocomplete="email"')+'<button class="btn spaced" type="submit">Enviar verificación</button></form>')+'<p class="subtitle">Esta operación requiere un inicio de sesión reciente. El canal solo queda habilitado al confirmar el enlace recibido.</p></section>';
}
async function setRecoveryChannel(form){
 setFormBusy(form,true);
 try{await api('/api/me/recovery-channel',{method:'POST',body:JSON.stringify({email:String(new FormData(form).get('email')||'').trim()})});toast('Si se pudo iniciar la verificación, recibirás instrucciones en el correo indicado.');}
 catch(error){toast(error.message);}
 finally{if(form.isConnected)setFormBusy(form,false);}
}
async function confirmRecoveryChannel(button){
 button.disabled=true;
 try{await api('/api/me/recovery-channel/confirm',{method:'POST',body:JSON.stringify({token:state.channelToken})});state.channelToken=null;await getProfile();await navigate();toast('Canal de recuperación verificado.');}
 catch(error){toast(error.message);if(button.isConnected)button.disabled=false;}
}
