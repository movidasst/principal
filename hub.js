/* La Movida SST+ · HUB público · sin dependencias de terceros */
(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const iconPaths={
"home":'<path d="m3 10 9-7 9 7"/><path d="M5 9v12h14V9"/><path d="M9 21v-7h6v7"/>',
"grid":'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
"book":'<path d="M12 7c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V6c-3-1-6-1-9 1z"/><path d="M12 7v14"/>',
"graduation":'<path d="m2 10 10-5 10 5-10 5z"/><path d="M6 12v5c4 3 8 3 12 0v-5"/><path d="M22 10v6"/>',
"users":'<circle cx="9" cy="8" r="3"/><path d="M2 20v-2c0-3 3-5 7-5s7 2 7 5v2"/><path d="M17 5a3 3 0 0 1 0 6"/><path d="M19 14c2 1 3 3 3 5v1"/>',
"user-plus":'<circle cx="9" cy="8" r="3"/><path d="M2 20c0-5 3-7 7-7s7 2 7 7"/><path d="M19 8h5M21.5 5.5v5"/>',
"user":'<circle cx="12" cy="7" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/>',
"trophy":'<path d="M7 3h10v8a5 5 0 0 1-10 0z"/><path d="M7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 16v4M8 21h8"/>',
"award":'<circle cx="12" cy="8" r="5"/><path d="m8.5 13-1 8 4.5-2 4.5 2-1-8"/>',
"messages":'<path d="M4 5h16v12H8l-4 4z"/><path d="M8 9h8M8 13h6"/>',
"shield":'<path d="m12 2 9 4v6c0 6-4 9-9 11-5-2-9-5-9-11V6z"/><path d="m8 12 3 3 5-6"/>',
"calendar":'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
"spark":'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
"flask":'<path d="M9 2h6M10 2v7L4 19c-.9 1.5.2 3 2 3h12c1.8 0 2.9-1.5 2-3l-6-10V2"/><path d="M7 17h10"/>',
"audio":'<path d="M4 9v6M8 5v14M12 8v8M16 3v18M20 9v6"/>',
"sun":'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
"wind":'<path d="M2 8h13c5 0 5-6 1-6-2 0-3 1-3 3M2 12h18c4 0 4 5 1 5M2 16h11c5 0 5 6 1 6-2 0-3-1-3-3"/>',
"activity":'<path d="M2 12h4l3-7 5 14 3-7h5"/>',
"thermometer":'<path d="M10 14V5a3 3 0 0 1 6 0v9a5 5 0 1 1-6 0z"/><path d="M13 9v10"/>',
"radio":'<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16"/>',
"chart":'<path d="M3 3v18h18M7 16l4-5 4 3 5-8"/>',
"check":'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
"git":'<circle cx="7" cy="4" r="2"/><circle cx="7" cy="20" r="2"/><circle cx="18" cy="14" r="2"/><path d="M7 6v12M7 8c0 5 11 0 11 4"/>',
"briefcase":'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
"layers":'<path d="m12 2 10 5-10 5L2 7zM2 12l10 5 10-5M2 17l10 5 10-5"/>',
"alert":'<path d="m12 2 10 18H2z"/><path d="M12 9v5M12 18h.01"/>',
"folder":'<path d="M3 6h7l2 2h9v12H3z"/>',
"radar":'<circle cx="12" cy="12" r="9"/><path d="M12 12 18 6M12 3v9"/><circle cx="16" cy="8" r="1"/>',
"brain":'<path d="M12 6a4 4 0 0 0-7 1 4 4 0 0 0-1 7c-2 4 2 8 6 6l2-2V6zM12 6a4 4 0 0 1 7 1 4 4 0 0 1 1 7c2 4-2 8-6 6l-2-2V6z"/>',
"building":'<rect x="5" y="2" width="14" height="20" rx="1"/><path d="M9 6h1M14 6h1M9 11h1M14 11h1M10 22v-5h4v5"/>',
"network":'<circle cx="12" cy="4" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 6v7M5 17l7-4 7 4"/>',
"search":'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
"arrow":'<path d="M5 12h14M13 6l6 6-6 6"/>',
"external":'<path d="M13 4h7v7M20 4l-9 9"/><path d="M19 14v5H5V5h5"/>',
"heart":'<path d="M20 5a5 5 0 0 0-8 0 5 5 0 0 0-8 0c-2 3-1 6 2 9l6 6 6-6c3-3 4-6 2-9z"/>',
"star":'<path d="m12 2 3 6 7 1-5 5 1 8-6-3-6 3 1-8-5-5 7-1z"/>',
"menu":'<path d="M4 6h16M4 12h16M4 18h16"/>',
"close":'<path d="M5 5l14 14M19 5 5 19"/>'
};
const svg=(name)=>'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(iconPaths[name]||iconPaths.grid)+'</svg>';
$$("[data-icon]").forEach(e=>{e.innerHTML=svg(e.dataset.icon)});
const label={comunidad:"Comunidad",aprendizaje:"Aprender",laboratorio:"MovidaLab HO",herramientas:"Aplicaciones SST",emergencias:"Emergencias",recursos:"Recursos",innovacion:"Innovación",servicios:"Servicios"};
const groupIcons={comunidad:"users",aprendizaje:"graduation",laboratorio:"flask",herramientas:"shield",emergencias:"alert",recursos:"folder",innovacion:"spark",servicios:"briefcase"};
const safeText=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safeUrl=(url)=>{try{const u=new URL(url);return u.protocol==="https:"&&(/(^|\.)movidasst\.com$/.test(u.hostname)||u.hostname==="movidasst.org"||u.hostname==="movidasst.github.io")?u.href:"#explorar"}catch{return "#explorar"}};
const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[-_]/g," ");
const featured=$("#featuredGrid"),results=$("#productGrid"),search=$("#searchInput"),count=$("#resultCount"),chips=$("#categoryChips"),cats=$("#categoryRow"),more=$("#moreButton"),empty=$("#emptyState"),clear=$("#clearSearch");
const favoritesKey="movidasst:hub:favoritos", pageSize=12;
let catalog=[],category="all",term="",page=1,onlyFavs=false;
let favorites=new Set();
try{const f=JSON.parse(localStorage.getItem(favoritesKey)||"[]");if(Array.isArray(f))favorites=new Set(f.filter(x=>typeof x==="string"))}catch{}
const store=()=>{try{localStorage.setItem(favoritesKey,JSON.stringify([...favorites]))}catch{}};
const badges=i=>i.status==="experimental"?'<span class="badge beta tag">En prueba</span>':i.status==="acceso"?'<span class="badge restricted tag">Acceso privado</span>':"";
function product(i){const favorite=favorites.has(i.id);return '<article class="product-card" data-id="'+safeText(i.id)+'">'+
'<div class="product-icon">'+svg(i.icon)+'</div>'+badges(i)+
'<h3><a href="'+safeUrl(i.url)+'" target="_blank" rel="noopener noreferrer">'+safeText(i.title)+'</a></h3>'+
'<p>'+safeText(i.description)+'</p>'+
'<div class="product-foot"><a href="'+safeUrl(i.url)+'" target="_blank" rel="noopener noreferrer" aria-label="Abrir '+safeText(i.title)+'">Abrir '+svg("arrow")+'</a><button class="favorite-btn" type="button" data-favorite="'+safeText(i.id)+'" aria-label="'+(favorite?"Quitar de":"Guardar en")+' favoritos: '+safeText(i.title)+'" aria-pressed="'+favorite+'">'+svg("star")+'</button></div></article>'}
function setCategory(next){category=next;onlyFavs=next==="favoritos";page=1;render();}
function renderChips(){if(!chips)return;const a=[["all","Todo"],["favoritos","★ Favoritos"],...Object.entries(label)];chips.innerHTML=a.map(([key,title])=>'<button type="button" class="chip" data-category="'+key+'" aria-pressed="'+(category===key)+'">'+safeText(title)+'</button>').join("")}
function renderCats(){if(!cats)return;cats.innerHTML=Object.entries(label).map(([key,title])=>'<button class="category-tile" type="button" data-category="'+key+'"><span class="icon">'+svg(groupIcons[key])+'</span>'+safeText(title)+'</button>').join("")}
function currentItems(){let list=catalog.filter(i=>(category==="all"||onlyFavs||i.category===category) && (!onlyFavs||favorites.has(i.id)));if(term)list=list.filter(i=>normalize([i.title,i.description,i.keywords,i.group,label[i.category]].join(" ")).includes(normalize(term)));return list}
function render(){renderChips();const list=currentItems();if(results)results.innerHTML=list.slice(0,page*pageSize).map(product).join("");if(count)count.textContent=list.length+" recurso"+(list.length===1?"":"s")+" encontrado"+(list.length===1?"":"s");if(empty)empty.hidden=list.length>0||!catalog.length;if(more){more.hidden=list.length<=page*pageSize;more.textContent="Ver más recursos ("+Math.max(0,list.length-page*pageSize)+")"}if(clear)clear.hidden=!term;if(featured)featured.innerHTML=["estudia","directorio","laboratorio","desarrolla","iperc","contratistas","participa","pif"].map(id=>catalog.find(i=>i.id===id)).filter(Boolean).map(product).join("")}
function showToast(s){const el=$("#toast");if(!el)return;el.textContent=s;el.hidden=false;clearTimeout(showToast.t);showToast.t=setTimeout(()=>{el.hidden=true},2200)}
document.addEventListener("click",e=>{
const cat=e.target.closest("[data-category]");if(cat){setCategory(cat.dataset.category);return}
const fav=e.target.closest("[data-favorite]");if(fav){const id=fav.dataset.favorite;if(favorites.has(id)){favorites.delete(id);showToast("Quitado de favoritos")}else{favorites.add(id);showToast("Guardado en favoritos")}store();render();}
});
if(search){search.addEventListener("input",()=>{term=search.value.trim();page=1;render()});document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();if(viewPanels.length)showView("explorar");search.focus()}})}
if(clear)clear.addEventListener("click",()=>{term="";search.value="";render();search.focus()});
if(more)more.addEventListener("click",()=>{page++;render()});

/* Pestañas internas del HUB: cambiar de pantalla sin abrir aplicaciones ni saltar a anclas. */
const viewNames=["inicio","explorar","aprender","comunidad","mi-movida","empresas"];
const viewLabel={"inicio":"Inicio","explorar":"Explorar","aprender":"Aprender","comunidad":"Comunidad","mi-movida":"Mi Movida","empresas":"Empresas"};
const viewPanels=$("[data-hub-view]");
function readCurrentView(){
  try{const name=new URL(window.location.href).searchParams.get("vista");return viewNames.includes(name)?name:"inicio"}catch{return "inicio"}
}
function showView(name,updateUrl=true){
  if(!viewPanels.length||!viewNames.includes(name))return;
  const current=viewPanels.find(p=>!p.hidden)?.dataset.hubView||"inicio";
  viewPanels.forEach(panel=>{const active=panel.dataset.hubView===name;panel.hidden=!active;panel.classList.toggle("is-active",active)});
  $("[data-hub-tab]").forEach(tab=>{
    const selected=tab.dataset.hubTab===name;
    tab.classList.toggle("active",selected);
    tab.setAttribute("aria-pressed",String(selected));
    if(tab.closest(".bottom-nav")){if(selected)tab.setAttribute("aria-current","location");else tab.removeAttribute("aria-current")}
  });
  const pane=$("#mobileMenu"),trigger=$("#menuTrigger");
  if(pane){pane.hidden=true;trigger?.setAttribute("aria-expanded","false")}
  if(updateUrl&&name!==current){
    try{const next=new URL(window.location.href);if(name==="inicio")next.searchParams.delete("vista");else next.searchParams.set("vista",name);history.pushState({hubView:name},"",next.pathname+next.search)}catch{}
  }
  const announce=$("#hubViewStatus");if(announce)announce.textContent="Sección abierta: "+viewLabel[name];
  if(name!==current){window.scrollTo(0,0)}
}
if(viewPanels.length){
  showView(readCurrentView(),false);
  window.addEventListener("popstate",()=>showView(readCurrentView(),false));
  document.addEventListener("click",event=>{
    const control=event.target.closest("button[data-hub-tab]");
    if(!control)return;
    if(control.dataset.hubCategory)setCategory(control.dataset.hubCategory);
    showView(control.dataset.hubTab);
  });
}

const menu=$("#menuTrigger"),menuPane=$("#mobileMenu");
if(menu&&menuPane){menu.addEventListener("click",()=>{menuPane.hidden=!menuPane.hidden;menu.setAttribute("aria-expanded",String(!menuPane.hidden))});menuPane.addEventListener("click",e=>{if(e.target.closest("a,button[data-hub-tab]")){menuPane.hidden=true;menu.setAttribute("aria-expanded","false")}});}
const dialog=$("#supportDialog"),openBtns=$$("[data-support]"),closeBtn=$("#closeSupport");let previousFocus=null, loadedPayPal=false;
function openSupport(){if(!dialog)return;previousFocus=document.activeElement;dialog.hidden=false;closeBtn?.focus();document.body.style.overflow="hidden";if(!loadedPayPal)loadPayPal();}
function closeSupport(){if(!dialog)return;dialog.hidden=true;document.body.style.overflow="";previousFocus?.focus()}
openBtns.forEach(b=>b.addEventListener("click",openSupport));closeBtn?.addEventListener("click",closeSupport);
dialog?.addEventListener("click",e=>{if(e.target===dialog)closeSupport()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(dialog&&!dialog.hidden)closeSupport();if(menuPane&&!menuPane.hidden){menuPane.hidden=true;menu?.setAttribute("aria-expanded","false")}}});
function loadPayPal(){loadedPayPal=true;const box=$("#paypal-container-L8JZJ944K29T2");if(!box)return;const s=document.createElement("script");s.src="https://www.paypal.com/sdk/js?client-id=BAAJLihJtqy1l8ByU5kM-5xUoRD7QhOIzMXEHYka6QMgJrgtidkjum4hZxfZjxGeFbb1EtfpIjKw8v-NXs&components=hosted-buttons&disable-funding=venmo&currency=USD";s.async=true;s.onload=()=>{try{window.paypal?.HostedButtons({hostedButtonId:"L8JZJ944K29T2"}).render("#paypal-container-L8JZJ944K29T2")}catch{box.textContent="No se pudo cargar PayPal. Inténtalo de nuevo más tarde."}};s.onerror=()=>{box.textContent="No se pudo cargar PayPal. Inténtalo de nuevo más tarde."};document.head.appendChild(s)}
$("#copyBinance")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText("BINANCE (USDT)\nRed: BEP20 (BSC)\nID: 176067584\nCorreo: david.linaresb@gmail.com");showToast("Datos copiados")}catch{showToast("Selecciona y copia los datos mostrados")}});
async function loadCatalog(){try{const r=await fetch("/ecosistema.json?v=20261018",{cache:"default"});if(!r.ok)throw new Error("HTTP "+r.status);const d=await r.json();if(!Array.isArray(d.items))throw new Error("Formato de catálogo");catalog=d.items.filter(i=>i&&i.title&&i.id&&safeUrl(i.url)!=="#explorar");render();renderCats();$("#loadingCatalog")?.remove();}catch(err){const el=$("#loadingCatalog");if(el)el.textContent="No pudimos cargar el catálogo completo. Utiliza los accesos destacados o inténtalo nuevamente.";console.warn("Catalog not loaded",err)}}
loadCatalog();
})();