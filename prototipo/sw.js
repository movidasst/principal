'use strict';
const CACHE='mi-movida-prototipo-v1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/icon.svg','./assets/logo-sst.png','./assets/outfit-regular.ttf','./assets/outfit-bold.ttf','./assets/negociacion.svg','./assets/comunicacion-asertiva.svg','./assets/liderazgo-preventivo.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('mi-movida-prototipo-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==self.location.origin)return;
 const allowed=ASSETS.some(a=>new URL(a,self.registration.scope).pathname===url.pathname);
 if(!allowed)return;
 e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});

