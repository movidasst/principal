import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync('hub.js','utf8');
const catalog=JSON.parse(readFileSync('ecosistema.json','utf8')).items;
const searchSource=code.slice(code.indexOf('const stopWords='),code.indexOf('function syncSearchUrl'));
function search(term,category='all',favorites=[]){
 const sandbox={catalog,term,category,onlyFavs:category==='favoritos',favorites:new Set(favorites),label:{recursos:'Recursos'},normalize:s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[-_]/g,' ')};
 return vm.runInNewContext(searchSource+';currentItems().map(i=>i.id)',sandbox);
}
test('Busca normativa pública, tareas y acentos sin perder los recursos existentes',()=>{
 assert.equal(search('LOPCYMAT')[0],'lopcymat');
 assert.equal(search('investigar un accidente')[0],'mac');
 assert.equal(search('investigación de accidentes')[0],'mac');
 assert.equal(search('evaluar riesgos')[0],'iperc');
 assert.ok(search('ruido').includes('sonometro'));
 assert.ok(search('PSST').includes('psst'));
 assert.ok(search('PSST').includes('nt-04-2023'));
 assert.equal(search('encontrar profesionales')[0],'directorio');
 assert.equal(search('consultar normativa')[0],'biblioteca-publica');
});
test('Los favoritos se filtran por ID y una consulta desconocida no produce resultados falsos',()=>{
 assert.deepEqual(Array.from(search('', 'favoritos',['mac'])),['mac']);
 assert.equal(search('recurso inexistente xyz').length,0);
 assert.equal(search('ruido','comunidad').length,0);
});
test('La URL comparte consulta y categoría y elimina filtros al borrar',()=>{
 const source=code.slice(code.indexOf('function syncSearchUrl'),code.indexOf('function render(){'));
 for(const [term,category,expected] of [['accidentes','all','?vista=explorar&q=accidentes'],['','favoritos','?vista=explorar&categoria=favoritos'],['','all','?vista=explorar']]){
  let result;
  vm.runInNewContext(source+';syncSearchUrl();',{URL,location:{href:'https://www.movidasst.com/?vista=explorar&q=ruido&categoria=recursos'},history:{state:null,replaceState:(s,t,u)=>result=u},viewPanels:[1],$:()=>({hidden:false}),term,category});
  assert.equal(result,'/'+expected);
 }
});
test('El contador sigue usando el total exacto de GEO y no la fuente antigua',async()=>{
 const html=readFileSync('index.html','utf8');
 const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('directoryRegisteredCount'))[1];
 for(const range of ['0-0/2127','0-0/2128','0-0/*']){
  const nodes={directoryRegisteredCount:{textContent:'—'},directoryRegisteredStatus:{textContent:''}};let requested;
  vm.runInNewContext(inline,{document:{hidden:false,getElementById:id=>nodes[id],addEventListener(){}},localStorage:{getItem:()=>null,setItem(){}},fetch:async(url,options)=>{requested={url,options};return{ok:true,headers:{get:()=>range}}},Intl,Date,JSON,Number,AbortSignal,window:{setInterval(){}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(requested.url,/rpc\/directorio_internacional_v1\?limit=1/);
  assert.equal(requested.options.headers.Prefer,'count=exact');
  assert.equal(nodes.directoryRegisteredCount.textContent,range.endsWith('2127')?'2.127':range.endsWith('2128')?'2.128':'—');
 }
});
