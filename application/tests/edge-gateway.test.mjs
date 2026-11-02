import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Puerta Edge aislada: sin claves privadas ni rutas de datos de miembros activas',async()=>{
 const text=await readFile(new URL('../../staging/supabase/functions/mi-movida-api/index.ts',import.meta.url),'utf8');
 assert.match(text,/member_access:'disabled'/);
 assert.match(text,/code:'not_enabled'/);
 assert.match(text,/origin_denied/);
 assert.match(text,/https:\/\/www\.movidasst\.com/);
 assert.doesNotMatch(text,/SUPABASE_SERVICE_ROLE_KEY|MOODLE_TOKEN|RESEND_API_KEY/);
});
