import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = path => readFile(new URL(path,import.meta.url),'utf8');

test('Mi Movida solicita documento y código, no país ni tipo de documento',async()=>{
 const app=await read('../public/app.js');
 const form=app.match(/function loginFields\(prefix=''\)\{return (.*?);\}/s)?.[1]||'';
 assert.match(form,/name="document"/);
 assert.doesNotMatch(form,/name="issuer_country"|name="document_type"/);
 assert.match(app,/name="member_code"[^\n]*maxlength="5"/);
 assert.match(app,/\['document','member_code'\]/);
});

test('Mi Movida carga logo oficial compartido por HUB y preserva su proporción',async()=>{
 const app=await read('../public/app.js');
 const css=await read('../public/styles.css');
 const hub=await read('../../index.html');
 assert.match(hub,/logo-oficial-movida-sst-plus\.png/);
 assert.match(app,/\/logo-oficial-movida-sst-plus\.png/);
 assert.match(css,/\.brand img\{width:162px;[^}]*height:auto/);
});

test('Mi credencial utiliza GEO por identificador público, sin replicar emisor ni exponer secretos',async()=>{
 const app=await read('../public/app.js');
 const html=await read('../public/index.html');
 const css=await read('../public/styles.css');
 assert.match(app,/function geoCredentialUrl\(publicId\)/);
 assert.match(app,/directorio\.movidasst\.com\/\?id=/);
 assert.match(app,/state\.profile\?\.public_id/);
 assert.match(app,/iframe class="geo-credential-frame"/);
 assert.match(app,/data-action="geo-credential-verify"/);
 assert.match(app,/data-action="geo-credential-access"/);
 assert.match(app,/directorio\.movidasst\.com\/#\/credencial/);
 assert.match(app,/if\(route==='credencial'\)return \{profile:state\.profile\}/);
 assert.doesNotMatch(app,/function downloadCredential\(|Mi-Movida-Credencial\.svg|geoCredentialUrl\(state\.profile\?\.documento/);
 assert.match(html,/frame-src https:\/\/directorio\.movidasst\.com;/);
 assert.match(css,/\.geo-credential-frame\{display:block;width:100%/);
});
