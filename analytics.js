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
    el.style.cssText="position:fixed;z-index:2147483000;bottom:calc(82px + env(safe-area-inset-bottom, 0px));left:12px;right:12px;margin:auto;max-width:650px;padding:16px;border-radius:16px;background:#fff;color:#00205b;border:2px solid #007b85;box-shadow:0 10px 42px rgba(0,32,91,.22);font:500 14px/1.5 system-ui,Arial,sans-serif;";
    el.innerHTML='<strong style="display:block;font-size:16px;margin-bottom:6px">Estadísticas de La Movida SST+</strong>'+
      '<p style="margin:0 0 10px;color:#475569">¿Nos permites medir visitas de forma agregada para mejorar las páginas? Solo activaremos Google Analytics con tu autorización. No enviaremos nombres, correos ni parámetros de las URL. <a style="color:#007b85;text-decoration:underline" target="_blank" rel="noopener noreferrer" href="'+privacyURL+'">Privacidad</a>.</p>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap">'+
      '<button type="button" data-movida-choice="denied" style="padding:11px 16px;border:1px solid #9eafc1;border-radius:10px;background:#fff;color:#00205b;font-weight:750;cursor:pointer;flex:1;min-width:130px">Rechazar</button>'+
      '<button type="button" data-movida-choice="granted" style="padding:11px 16px;border:1px solid #007b85;border-radius:10px;background:#007b85;color:white;font-weight:750;cursor:pointer;flex:1;min-width:130px">Permitir estadísticas</button></div>';
    el.addEventListener("click",function(e){
      var btn=e.target.closest("[data-movida-choice]");
      if(btn)setChoice(btn.getAttribute("data-movida-choice"));
    });
    document.body.appendChild(el);
    controls=el;
  }
  function init(){
    var pref=preference();
    if(pref==="granted") enable();
    else if(pref!=="denied")openChoices();
    /* Gestión permanente del consentimiento, sin un botón flotante superpuesto. */
    var footer = document.createElement("div");
    footer.style.cssText="text-align:center;margin:12px auto 18px;padding:10px 12px;font:500 12px system-ui,Arial,sans-serif;";
    var btn=document.createElement("button");
    btn.type="button";
    btn.textContent="Preferencias de estadísticas";
    btn.style.cssText="border:0;background:none;color:#007b85;text-decoration:underline;cursor:pointer;font:inherit;padding:8px;min-height:36px;";
    btn.addEventListener("click",openChoices);
    footer.appendChild(btn);
    document.body.appendChild(footer);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();