/* La Movida de SST+ · GA4 · medición agregada entre subdominios
   Basic consent mode: no cargar scripts de Google ni enviar datos antes de aceptar.
   La ubicación de las páginas se reduce al dominio: no enviar querystrings ni IDs.
*/
(function(){
  "use strict";
  if (window.__movidaAnalyticsInit) return;
  window.__movidaAnalyticsInit = true;
  var host = window.location.hostname.toLowerCase();
  if (host !== "movidasst.com" && !host.endsWith(".movidasst.com")) return;
  var GA4 = "G-D0YXTL06LN";
  var cookieName = "movida_analytics_v1";
  var expires = 60 * 60 * 24 * 180;
  var loaded = false;
  var controls = null;
  var privacyURL = "https://registro.movidasst.com/privacidad.html";
  function loadCss(){
    if (document.querySelector('link[data-movida-analytics-css]')) return;
    var css=document.createElement("link");
    css.rel="stylesheet";css.setAttribute("data-movida-analytics-css","1");
    css.href="https://www.movidasst.com/analytics.css?v=20261025";
    document.head.appendChild(css);
  }
  function preference(){
    var m = document.cookie.match(/(?:^|;\s*)movida_analytics_v1=([^;]*)/);
    return m ? m[1] : "";
  }
  function save(value){
    document.cookie = cookieName + "=" + value + "; Domain=movidasst.com; Path=/; Max-Age=" + expires + "; SameSite=Lax; Secure";
  }
  function cleanCookies(){
    document.cookie.split(";").forEach(function(v){
      var name = v.trim().split("=")[0];
      if (!/^_ga(?:_|$)/.test(name)) return;
      ["", "; Domain=movidasst.com", "; Domain=." + host].forEach(function(scope){
        document.cookie = name + "=; Max-Age=0; Path=/; SameSite=Lax; Secure" + scope;
      });
    });
  }
  function gtag(){
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(arguments);
  }
  var denied = {analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"};
  function enable(){
    if (loaded) return;
    /* Evita una segunda etiqueta en los sitios con integración propia. */
    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"], script[src*="googletagmanager.com/gtm.js"]')) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || gtag;
    window.gtag("consent","default",denied);
    window.gtag("consent","update",{
      analytics_storage:"granted",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"
    });
    window.gtag("js",new Date());
    window.gtag("config",GA4,{
      send_page_view:false,
      cookie_domain:"movidasst.com",
      allow_google_signals:false,
      allow_ad_personalization_signals:false
    });
    var ref = "";
    try { if (document.referrer) ref = new URL(document.referrer).origin + "/"; }catch(e){}
    /* Evitar exposición de consultas, números de documento o datos de perfil. */
    window.gtag("event","page_view",{
      page_location:window.location.origin + "/",
      page_referrer:ref,
      page_title:"La Movida SST+ · " + host
    });
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4;
    script.onerror = function(){ console.warn("La Movida SST+: no pudo cargarse Google Analytics."); };
    document.head.appendChild(script);
  }
  function setChoice(value){
    save(value);
    if (value === "granted") enable();
    else {
      if (loaded && typeof window.gtag === "function") window.gtag("consent","update",denied);
      cleanCookies();
    }
    if (controls) { controls.remove(); controls = null; }
  }
  function openChoices(){
    if (controls) return;
    var el = document.createElement("div");
    el.id="movida-analytics-consent";
    el.setAttribute("role","region");
    el.setAttribute("aria-label","Preferencias de estadísticas");
    el.innerHTML='<strong class="movida-analytics-title">Estadísticas de La Movida SST+</strong>'+
      '<p class="movida-analytics-text">¿Nos permites medir visitas de forma agregada para mejorar las páginas? Solo activaremos Google Analytics con tu autorización. No enviaremos nombres, correos ni parámetros de las URL. <a class="movida-analytics-link" target="_blank" rel="noopener noreferrer" href="'+privacyURL+'">Privacidad</a>.</p>'+
      '<div class="movida-analytics-actions">'+
      '<button type="button" data-movida-choice="denied">Rechazar</button>'+
      '<button type="button" data-movida-choice="granted">Permitir estadísticas</button></div>';
    el.addEventListener("click",function(e){
      var btn=e.target.closest("[data-movida-choice]");
      if(btn)setChoice(btn.getAttribute("data-movida-choice"));
    });
    document.body.appendChild(el);
    controls=el;
  }
  function init(){
    loadCss();
    var pref=preference();
    if(pref==="granted") enable();
    else if(pref!=="denied")openChoices();
    /* Gestión permanente del consentimiento, sin un botón flotante superpuesto. */
    var footer = document.createElement("div");
    footer.id="movida-analytics-pref";
    var btn=document.createElement("button");
    btn.type="button";
    btn.textContent="Preferencias de estadísticas";
    btn.addEventListener("click",openChoices);
    footer.appendChild(btn);
    document.body.appendChild(footer);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();