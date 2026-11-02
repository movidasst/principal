// Sync local-only CLI migrations from reviewed release SQL. No network or DB operations.
import fs from 'node:fs/promises';
const root=new URL('../',import.meta.url),dir=new URL('staging/supabase/migrations/',root);
const files=await fs.readdir(dir),fixture=await fs.readFile(new URL('backend/tests/sql/schema-synthetic.sql',root),'utf8');
const schema="-- LOCAL-ONLY synthetic structural baseline. Never apply to an existing hosted project.\nCREATE SCHEMA IF NOT EXISTS private;\n"+fixture.slice(fixture.indexOf('CREATE TABLE public.integrantes'),fixture.indexOf('-- Synthetic fixtures:'))+`
-- Do not inherit permissive hosted default privileges in this synthetic environment.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
GRANT SELECT ON public.integrante_auth_links,public.puntos_eventos TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.tablename);
 END LOOP;
END; $$;
`;
const seed='-- SYNTHETIC data only. No production data or secrets.\n'+fixture.slice(fixture.indexOf('INSERT INTO public.integrantes'))+"\nSELECT public.mi_movida_configure('http://127.0.0.1:54321');\n";
await fs.writeFile(new URL('staging/supabase/seed.sql',root),seed);
for(const [suffix,content]of [['local_only_business_baseline.sql',schema],['mi_movida_identity.sql',await fs.readFile(new URL('backend/sql/001_identity_and_profile.sql',root),'utf8')],['mi_movida_readers.sql',await fs.readFile(new URL('backend/sql/002_readers_and_ranking.sql',root),'utf8')],['mi_movida_photos.sql',await fs.readFile(new URL('backend/sql/003_photos.sql',root),'utf8')]]){
 const file=files.find(f=>f.endsWith(suffix));if(!file)throw Error('Generate missing migration with supabase migration new '+suffix);
 await fs.writeFile(new URL(file,dir),content);
}
await fs.cp(new URL('backend/edge/',root),new URL('staging/supabase/functions/',root),{recursive:true});
console.log('Local migrations and Edge sources synchronized; no database contacted.');
