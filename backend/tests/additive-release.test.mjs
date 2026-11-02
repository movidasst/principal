import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('Migración aditiva de Mi Movida mantiene contratos existentes intactos',async()=>{
 const source=await readFile(new URL('../sql/004_production_additive_review.sql',import.meta.url),'utf8');
 assert.doesNotMatch(source,/CREATE OR REPLACE FUNCTION public\.(?:pif_|ranking_publico|ranking_todos_estudios_publico|estudia_|directorio_)/i);
 assert.doesNotMatch(source,/DROP CONSTRAINT|DROP TABLE|DELETE FROM|TRUNCATE/i);
 assert.doesNotMatch(source,/REVOKE .*integrante_auth_links/i);
 const db=new PGlite();
 try{
  const fixture=await readFile(new URL('./sql/schema-synthetic.sql',import.meta.url),'utf8');
  await db.exec(fixture);
  await db.exec(source);
  assert.equal((await db.query("select to_regprocedure('public.mi_movida_auth_lookup_document(text,text)') is not null as ok")).rows[0].ok,true);
  assert.equal((await db.query("select to_regprocedure('public.mi_movida_profile()') is not null as ok")).rows[0].ok,true);
  assert.equal((await db.query("select to_regclass('private.mi_movida_tokens') is not null as ok")).rows[0].ok,true);
 }finally{await db.close();}
});
