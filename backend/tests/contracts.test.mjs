import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSyntheticStore} from '../../application/staging/store.mjs';
test('PostgreSQL staged contracts, ownership, recovery and XP regression',async t=>{
 const {db,exec,gateway,close}=await createSyntheticStore();
 try{
 let auth,claims;
 await t.test('international normalization preserves letters and zeroes',async()=>{
  const row=await exec('mi_movida_auth_lookup',{p_country:'cl',p_document:' demo001 ',p_code:'a1b2c'});assert.equal(row.integrante_id,'900001');
  assert.equal(await exec('mi_movida_auth_lookup',{p_country:'CL',p_document:'001',p_code:'A1B2C'}),null);
  assert.equal(await exec('mi_movida_auth_lookup',{p_country:'VE',p_document:'DEMO001',p_code:'A1B2C'}),null);
 });
 await t.test('existing identity links idempotently without a parallel member',async()=>{
  const id=await exec('mi_movida_auth_lookup',{p_country:'CL',p_document:'DEMO001',p_code:'A1B2C'});
  auth=await gateway.authenticate(id);claims=JSON.parse(Buffer.from(auth.access_token.split('.')[1],'base64url'));
  await exec('mi_movida_link_auth',{p_integrante_id:'900001',p_auth_user_id:auth.user.id});
  assert.equal((await db.query('select count(*)::int n from public.integrantes')).rows[0].n,3);
  assert.equal((await db.query('select count(*)::int n from public.integrante_auth_links')).rows[0].n,1);
  await assert.rejects(exec('mi_movida_link_auth',{p_integrante_id:'900002',p_auth_user_id:auth.user.id}));
 });
 await t.test('service functions inaccessible to anon/authenticated and tokens protected',async()=>{
  const r=await db.query("select has_function_privilege('anon','public.mi_movida_auth_lookup(text,text,text)','execute') a,has_function_privilege('authenticated','public.mi_movida_channel_confirm(uuid,uuid,text)','execute') b,has_table_privilege('authenticated','private.mi_movida_tokens','select') c");assert.deepEqual(r.rows[0],{a:false,b:false,c:false});
 });
 await t.test('private profile rejects impersonation through user_metadata and ID fields',async()=>{
  const profile=await exec('mi_movida_profile',{}, {...claims,user_metadata:{integrante_id:900002}});
  assert.equal(profile.id,'900001');assert.equal(profile.codigo_integrante,undefined);assert.equal(profile.documento,undefined);
  assert.equal(await exec('pif_current_integrante_id',{},claims),900001);
  await assert.rejects(exec('mi_movida_update_profile',{p_changes:{id:900002},p_version:1},claims));
  const p=await exec('mi_movida_update_profile',{p_changes:{municipio:'Ciudad sintética',mostrar_correo:false},p_version:1},claims);assert.equal(p.profile_version,2);
  await assert.rejects(exec('mi_movida_update_profile',{p_changes:{municipio:'stale'},p_version:1},claims));
 });
 await t.test('RLS denies points of other identities and denies writing own XP',async()=>{
  await db.transaction(async tx=>{await tx.query('select set_config($1,$2,true)',['request.jwt.claims',JSON.stringify(claims)]);await tx.exec('set local role authenticated');const r=await tx.query('select distinct integrante_id::text id from public.puntos_eventos');assert.deepEqual(r.rows,[{id:'900001'}]);});
  assert.equal((await db.query("select has_table_privilege('authenticated','public.puntos_eventos','insert') ok")).rows[0].ok,false);
 });
 await t.test('photo policy allows own path, denies another identity and forbids overwriting',async()=>{
  const own=claims.sub+'/synthetic.png';
  await db.transaction(async tx=>{await tx.query('select set_config($1,$2,true)',['request.jwt.claims',JSON.stringify(claims)]);await tx.exec('set local role authenticated');await tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',['mi-movida-photos',own]);assert.equal((await tx.query('select name from storage.objects')).rows[0].name,own);});
  await assert.rejects(db.transaction(async tx=>{await tx.query('select set_config($1,$2,true)',['request.jwt.claims',JSON.stringify(claims)]);await tx.exec('set local role authenticated');await tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',['mi-movida-photos','another-user/synthetic.png']);}));
  assert.equal((await db.query("select has_table_privilege('authenticated','storage.objects','update') ok")).rows[0].ok,false);
 });
 await t.test('canonical rank excludes before ordering; XP, all four sources and pagination consistent',async()=>{
  const before=(await db.query('select sum(puntos)::int n from public.puntos_eventos')).rows[0].n;
  const p=await exec('mi_movida_xp',{p_limit:2,p_before:null,p_before_id:null},claims);
  assert.equal(p.ranking.puntos,1660);assert.equal(p.ranking.posicion,1);assert.equal(p.historial.length,2);assert.ok(p.next_cursor);
  assert.deepEqual(p.desglose.map(x=>x.fuente).sort(),['Desarrolla','Estudia','Inteligencia','Participa']);
  const p2=await exec('mi_movida_xp',{p_limit:2,p_before:p.next_cursor.fecha,p_before_id:p.next_cursor.id},claims);assert.equal(p2.historial.length,2);assert.equal(new Set([...p.historial,...p2.historial].map(x=>x.id)).size,4);
  const ranks=await gateway.rpc('ranking_publico',{p_limit:50,p_offset:0});assert.equal(String(ranks[0].integrante_id),'900001');assert.equal(ranks[0].posicion,1);
  assert.equal((await db.query('select sum(puntos)::int n from public.puntos_eventos')).rows[0].n,before);
 });
 await t.test('own participation, badges, certificates and public credential minimize fields',async()=>{
  const a=await exec('mi_movida_activity',{p_limit:30,p_before:null,p_before_id:null,p_source:'Participa'},claims);assert.equal(a.items.length,1);assert.equal(a.items[0].puntos,250);
  assert.equal((await exec('mi_movida_badges',{},claims)).items.length,1);assert.equal((await exec('mi_movida_certificates',{},claims)).items[0].status,'issued');
  const pub=(await db.query('select public_id from public.integrantes where id=900001')).rows[0].public_id;
  const credential=await exec('mi_movida_public_credential',{p_public_id:pub},null,'anon');assert.equal(credential.documento,undefined);assert.equal(credential.correo,undefined);assert.equal(credential.codigo_integrante,undefined);
 });
 await t.test('unverified recovery is generic; channel confirmation and recovery are single use',async()=>{
  const args={p_country:'CL',p_document:'DEMO001',p_token_hash:'a'.repeat(64),p_ip_hash:'1'.repeat(64)};
  assert.equal((await exec('mi_movida_recovery_prepare',args)).delivery,null);
  await exec('mi_movida_channel_begin',{p_auth_user_id:auth.user.id,p_session_id:claims.session_id,p_email:'alex@example.invalid',p_token_hash:'b'.repeat(64)});
  await exec('mi_movida_channel_confirm',{p_auth_user_id:auth.user.id,p_session_id:claims.session_id,p_token_hash:'b'.repeat(64)});
  await assert.rejects(exec('mi_movida_channel_confirm',{p_auth_user_id:auth.user.id,p_session_id:claims.session_id,p_token_hash:'b'.repeat(64)}));
  assert.equal((await exec('mi_movida_recovery_prepare',args)).delivery.email,'alex@example.invalid');
  const recovered=await exec('mi_movida_recovery_consume',{p_token_hash:'a'.repeat(64)});assert.equal(recovered.integrante_id,'900001');
  assert.equal(await exec('mi_movida_recovery_consume',{p_token_hash:'a'.repeat(64)}),null);
  await assert.rejects(exec('mi_movida_profile',{},claims));
  assert.equal(await exec('pif_current_integrante_id',{},claims),null);
 });
 }finally{await close();}
});


test('login de dos campos y recuperación rechazan documentos desconocidos sin depender de país',async()=>{
 const {db,exec}=await createSyntheticStore();
 try{
  const match=await exec('mi_movida_auth_lookup_document',{p_document:' demo001 ',p_code:'a1b2c'});
  assert.equal(match?.integrante_id,'900001');
  assert.equal(await exec('mi_movida_auth_lookup_document',{p_document:'ZZZ999',p_code:'A1B2C'}),null);
  assert.equal(await exec('mi_movida_auth_lookup_document',{p_document:'DEMO001',p_code:'BAD99'}),null);
  await db.query("insert into public.integrantes(id,documento,codigo_integrante,pais_iso2) values (900099,' demo001 ','a1b2c','VE')");
  assert.equal(await exec('mi_movida_auth_lookup_document',{p_document:'DEMO001',p_code:'A1B2C'}),null,'no elegir arbitrariamente entre documentos normalizados iguales');
  const grants=await db.query("select has_function_privilege('anon','public.mi_movida_auth_lookup_document(text,text)','execute') as public_login,has_function_privilege('authenticated','public.mi_movida_recovery_prepare_document(text,text,text)','execute') as public_recovery");
  assert.equal(grants.rows[0].public_login,false);assert.equal(grants.rows[0].public_recovery,false);
  const rec=await exec('mi_movida_recovery_prepare_document',{p_document:'ZZZ999',p_token_hash:'a'.repeat(64),p_ip_hash:'b'.repeat(64)});
  assert.equal(rec?.delivery,null);
 }finally{await db.close();}
});
