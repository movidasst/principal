-- LOCAL-ONLY synthetic structural baseline. Never apply to an existing hosted project.
CREATE SCHEMA IF NOT EXISTS private;
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

-- Do not inherit permissive hosted default privileges in this synthetic environment.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon,authenticated;
GRANT SELECT ON public.integrante_auth_links,public.puntos_eventos TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.tablename);
 END LOOP;
END; $$;
