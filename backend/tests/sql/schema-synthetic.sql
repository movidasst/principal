-- Minimal structural staging schema, no production rows. Test identities only.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA storage;
-- PostgreSQL-only policy fixture; not the native Storage HTTP service.
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text);
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT INSERT,SELECT,DELETE ON storage.objects TO authenticated;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text UNIQUE,email_confirmed_at timestamptz);
CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users(id),created_at timestamptz DEFAULT clock_timestamp(),not_after timestamptz);

-- Fix explicit UUID cast is required by auth.uid contract.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
CREATE TABLE public.integrantes(
 id bigint PRIMARY KEY,public_id uuid UNIQUE DEFAULT gen_random_uuid(),nombres text,apellidos text,cedula text,documento text UNIQUE,tipo_documento text,
 pais_iso2 text,pais_nombre text,estado text,municipio text,edad integer,genero text,grado text,carrera text,postgrado text,doctorado text,laboral text,
 correo text,codigo_integrante text UNIQUE,codigo_actualizado_at timestamptz,foto_url text,wasap text,telefono_e164 text,telefono_pais_iso2 text,
 whatsapp_username text,linkedin text,mostrar_wasap boolean DEFAULT false,mostrar_whatsapp_username boolean DEFAULT false,moodle_user_id bigint UNIQUE
);
CREATE TABLE public.integrante_auth_links(auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id),integrante_id bigint UNIQUE REFERENCES public.integrantes(id),linked_at timestamptz DEFAULT now(),linked_by uuid);
ALTER TABLE public.integrantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrante_auth_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY self_link ON public.integrante_auth_links FOR SELECT TO authenticated USING(auth_user_id=auth.uid());
GRANT SELECT ON public.integrante_auth_links TO authenticated;
CREATE TABLE public.estudio_sesiones(id uuid PRIMARY KEY,tema text,codigo text,visible boolean DEFAULT true);
CREATE TABLE public.puntos_eventos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),integrante_id bigint REFERENCES public.integrantes(id),sesion_id uuid REFERENCES public.estudio_sesiones(id),tipo text,puntos integer,motivo text,metadata jsonb DEFAULT '{}',created_at timestamptz DEFAULT clock_timestamp());
ALTER TABLE public.puntos_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY points_self ON public.puntos_eventos FOR SELECT TO authenticated USING(integrante_id IN(SELECT integrante_id FROM public.integrante_auth_links WHERE auth_user_id=auth.uid()));
GRANT SELECT ON public.puntos_eventos TO authenticated;
CREATE TABLE public.ranking_exclusiones(integrante_id bigint PRIMARY KEY,activo boolean DEFAULT true);
CREATE TABLE public.ranking_niveles(xp_min integer PRIMARY KEY,nombre text,icono text);
CREATE TABLE public.participa_consultas(id uuid PRIMARY KEY,titulo text);
CREATE TABLE public.participa_respuestas(id uuid PRIMARY KEY,consulta_id uuid REFERENCES public.participa_consultas(id),integrante_id bigint REFERENCES public.integrantes(id),submitted_at timestamptz DEFAULT now(),UNIQUE(consulta_id,integrante_id));
CREATE TABLE public.participa_puntos_otorgados(respuesta_id uuid PRIMARY KEY REFERENCES public.participa_respuestas(id),puntos_evento_id uuid REFERENCES public.puntos_eventos(id));
CREATE TABLE public.desarrolla_puntos_otorgados(resultado_id uuid PRIMARY KEY,puntos_evento_id uuid REFERENCES public.puntos_eventos(id));
CREATE TABLE private.desarrolla_insignias_fixture(integrante_id bigint,codigo text,obtenida_at timestamptz,prueba boolean DEFAULT false);
CREATE TABLE private.desarrolla_certificados_fixture(integrante_id bigint,codigo_competencia text,codigo_certificado text,emitida_at timestamptz,vigente boolean DEFAULT true);
CREATE FUNCTION private.desarrolla_insignias_integrante(p_integrante_id bigint) RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('codigo',codigo,'obtenida_at',obtenida_at,'prueba',prueba)),'[]') FROM private.desarrolla_insignias_fixture WHERE integrante_id=p_integrante_id $$;
CREATE FUNCTION private.desarrolla_certificados_integrante(p_integrante_id bigint) RETURNS jsonb LANGUAGE sql AS $$ SELECT coalesce(jsonb_agg(jsonb_build_object('codigo_competencia',codigo_competencia,'codigo_certificado',codigo_certificado,'emitida_at',emitida_at,'vigente',vigente)),'[]') FROM private.desarrolla_certificados_fixture WHERE integrante_id=p_integrante_id $$;
-- Synthetic fixtures: eligibility/issuance helpers above emulate their deployed contracts;
-- they do not replace or claim to test the production Desarrolla evaluation engine.
INSERT INTO public.integrantes(id,nombres,apellidos,documento,cedula,pais_iso2,pais_nombre,correo,codigo_integrante,carrera,moodle_user_id)
VALUES(1,'Coordinación','Ficticia','DEMO0001',NULL,'VE','Venezuela','coordinacion@example.invalid','A0001','Coordinación',1),
(900001,'Alex','Sintético','DEMO001',NULL,'CL','Chile','alex@example.invalid','A1B2C','Prevención de riesgos',101),
(900002,'Sol','Sintética','DEMO002',NULL,'VE','Venezuela','sol@example.invalid','D3E4F','Seguridad y salud',102);
INSERT INTO public.ranking_niveles VALUES(0,'Participante','🥉'),(1000,'Colaborador','⭐'),(2000,'Impulsor','🏅');
INSERT INTO public.estudio_sesiones VALUES('10000000-0000-4000-8000-000000000001','Cultura preventiva','SYN01',true);
INSERT INTO public.puntos_eventos(id,integrante_id,sesion_id,tipo,puntos,motivo,metadata,created_at) VALUES
('20000000-0000-4000-8000-000000000001',1,NULL,'actividad',5000,'Coordinación ficticia','{}','2026-10-25'),
('20000000-0000-4000-8000-000000000002',900001,'10000000-0000-4000-8000-000000000001','whatsapp_participacion',780,'Estudio sintético','{}','2026-10-25'),
('20000000-0000-4000-8000-000000000003',900001,NULL,'actividad',480,'Participación de grupo sintética','{"fuente":"inteligencia_grupo"}','2026-10-28'),
('20000000-0000-4000-8000-000000000004',900001,NULL,'actividad',250,'Consulta sintética','{}','2026-10-29'),
('20000000-0000-4000-8000-000000000005',900001,NULL,'actividad',150,'Competencia sintética','{}','2026-10-30'),
('20000000-0000-4000-8000-000000000006',900002,NULL,'actividad',1600,'Saldo sintético','{}','2026-10-30');
INSERT INTO public.participa_consultas VALUES('30000000-0000-4000-8000-000000000001','Próximos estudios · sintético');
INSERT INTO public.participa_respuestas VALUES('30000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',900001,'2026-10-29');
INSERT INTO public.participa_puntos_otorgados VALUES('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004');
INSERT INTO public.desarrolla_puntos_otorgados VALUES('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005');
INSERT INTO private.desarrolla_insignias_fixture VALUES(900001,'negociacion','2026-10-30',false),(900002,'liderazgo_preventivo','2026-10-30',false);
INSERT INTO private.desarrolla_certificados_fixture VALUES(900001,'negociacion','SYN-CERT-001','2026-10-30',true);
