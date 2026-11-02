import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Puerta Edge aislada: sin claves privadas ni rutas de datos de miembros activas',async()=>{
 const text=await readFile(new URL('../../staging/supabase/functions/mi-movida-api/index.ts',import.meta.url),'utf8');
 assert.match(text,/MM_ENABLE_MEMBER_READS/);
 assert.match(text,/code:'not_enabled'/);assert.match(text,/\/auth\/v1\/user/);assert.match(text,/\/rest\/v1\/rpc\//);
 assert.match(text,/origin_denied/);
 assert.match(text,/https:\/\/www\.movidasst\.com/);
 assert.match(text,/MM_ENABLE_MOODLE_READS/);
 assert.doesNotMatch(text,/sb_secret_[A-Za-z0-9]{8,}|sk-proj-[A-Za-z0-9]{8,}/);
});

test('Migración Mi Movida completamente independiente de funciones PIF',async()=>{
 for(const path of ['../../backend/sql/001_identity_and_profile.sql','../../staging/supabase/migrations/20261101235635_mi_movida_identity.sql']){
  const migration=await readFile(new URL(path,import.meta.url),'utf8');
  assert.doesNotMatch(migration,/\bpif_current_integrante_id\b|\bpif_ensure_access\b|\bpif_has_full_access\b/i);
 }
});
