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
