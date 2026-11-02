-- Mi Movida functional release, staged only. DO NOT run against production in this review.
-- Apply in an isolated Supabase clone, then execute backend/tests/sql assertions.
-- This is a release script, not a migration-history file. All data changes are additive.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;

ALTER TABLE public.integrantes
  ADD COLUMN IF NOT EXISTS mi_movida_profile_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mi_movida_auth_epoch timestamptz NOT NULL DEFAULT '-infinity',
  ADD COLUMN IF NOT EXISTS mostrar_correo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mostrar_insignias boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS documento_pais_emisor text,
  ADD COLUMN IF NOT EXISTS documento_emisor_verificado boolean NOT NULL DEFAULT false;

-- Do not infer issuer from residence or remove the existing global uniqueness index.
ALTER TABLE public.integrantes DROP CONSTRAINT IF EXISTS integrantes_documento_numerico_check;
ALTER TABLE public.integrantes ADD CONSTRAINT integrantes_documento_internacional_check
 CHECK (documento IS NULL OR (char_length(documento) BETWEEN 3 AND 64 AND documento !~ '[[:cntrl:]]')) NOT VALID;

CREATE TABLE IF NOT EXISTS private.mi_movida_config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 api_url text
);
INSERT INTO private.mi_movida_config(singleton,api_url)
VALUES(true,nullif(current_setting('app.settings.api_external_url',true),''))
ON CONFLICT(singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS private.mi_movida_verified_channels (
 integrante_id bigint PRIMARY KEY REFERENCES public.integrantes(id) ON DELETE CASCADE,
 email text NOT NULL,
 verified_at timestamptz NOT NULL,
 verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 CHECK(email=lower(btrim(email)) AND position('@' in email)>1)
);
CREATE TABLE IF NOT EXISTS private.mi_movida_tokens (
 token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 integrante_id bigint NOT NULL REFERENCES public.integrantes(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK(purpose IN('recovery','verify_channel')),
 email text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 consumed_at timestamptz,
 CHECK(expires_at>created_at)
);
CREATE INDEX IF NOT EXISTS mi_movida_tokens_owner ON private.mi_movida_tokens(integrante_id,purpose,expires_at);
CREATE TABLE IF NOT EXISTS private.mi_movida_rate_limits (
 bucket_hash text PRIMARY KEY,
 attempts integer NOT NULL,
 window_started timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS private.mi_movida_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 integrante_id bigint REFERENCES public.integrantes(id) ON DELETE SET NULL,
 auth_user_id uuid,
 action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.mi_movida_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.mi_movida_verified_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.mi_movida_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.mi_movida_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.mi_movida_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.mi_movida_config,private.mi_movida_verified_channels,private.mi_movida_tokens,
 private.mi_movida_rate_limits,private.mi_movida_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.integrante_auth_links FROM anon;
REVOKE INSERT,UPDATE,DELETE ON public.integrante_auth_links FROM authenticated;

CREATE OR REPLACE FUNCTION private.mm_document(p_document text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT upper(btrim(normalize(coalesce(p_document,''),NFKC)));
$$;

CREATE OR REPLACE FUNCTION private.mm_credential_stamp(p_integrante_id bigint) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT md5(i.id::text||':'||i.codigo_integrante||':'||coalesce(i.codigo_actualizado_at::text,'')||':'||i.mi_movida_auth_epoch::text)
 FROM public.integrantes i WHERE i.id=p_integrante_id;
$$;

CREATE OR REPLACE FUNCTION private.mm_linked_integrante() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.integrante_id FROM public.integrante_auth_links l
 JOIN public.integrantes i ON i.id=l.integrante_id
 JOIN auth.sessions s ON s.user_id=l.auth_user_id
  AND s.id=nullif(auth.jwt()->>'session_id','')::uuid
 WHERE l.auth_user_id=auth.uid()
  AND s.created_at>i.mi_movida_auth_epoch
  AND (s.not_after IS NULL OR s.not_after>now());
$$;
CREATE OR REPLACE FUNCTION private.mm_require_integrante() RETURNS bigint
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint;
BEGIN
 v_id:=private.mm_linked_integrante();
 IF v_id IS NULL THEN RAISE EXCEPTION 'session_expired' USING ERRCODE='28000'; END IF;
 RETURN v_id;
END;
$$;

-- H4: no user-editable metadata fallback, no automatic paid/admin access.
CREATE OR REPLACE FUNCTION public.pif_current_integrante_id() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.mm_linked_integrante();
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_configure(p_api_url text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_api_url !~ '^(https://[a-zA-Z0-9.-]+(:[0-9]+)?|http://(127[.]0[.]0[.]1|localhost):[0-9]+)$' THEN
  RAISE EXCEPTION 'invalid_api_origin' USING ERRCODE='22023';
 END IF;
 UPDATE private.mi_movida_config SET api_url=p_api_url WHERE singleton;
 RETURN true;
END;
$$;

-- Distributed, atomic counters; caller supplies a server-side HMAC bucket identifier.
CREATE OR REPLACE FUNCTION public.mi_movida_rate_limit(p_bucket text,p_limit integer DEFAULT 5,p_window_seconds integer DEFAULT 900)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r private.mi_movida_rate_limits;
BEGIN
 IF p_bucket !~ '^[a-f0-9]{64}$' OR p_limit NOT BETWEEN 1 AND 1000 OR p_window_seconds NOT BETWEEN 1 AND 86400 THEN
  RAISE EXCEPTION 'invalid_limit' USING ERRCODE='22023';
 END IF;
 INSERT INTO private.mi_movida_rate_limits(bucket_hash,attempts,window_started)
 VALUES(p_bucket,1,clock_timestamp())
 ON CONFLICT(bucket_hash) DO UPDATE SET
  attempts=CASE WHEN private.mi_movida_rate_limits.window_started<clock_timestamp()-make_interval(secs=>p_window_seconds)
   THEN 1 ELSE private.mi_movida_rate_limits.attempts+1 END,
  window_started=CASE WHEN private.mi_movida_rate_limits.window_started<clock_timestamp()-make_interval(secs=>p_window_seconds)
   THEN clock_timestamp() ELSE private.mi_movida_rate_limits.window_started END
 RETURNING * INTO r;
 RETURN jsonb_build_object('allowed',r.attempts<=p_limit,'retry_after',
  greatest(1,ceil(extract(epoch FROM r.window_started+make_interval(secs=>p_window_seconds)-clock_timestamp()))::integer));
END;
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_auth_lookup(p_country text,p_document text,p_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.integrantes; v_count integer; v_auth uuid; v_email text;
BEGIN
 IF upper(btrim(coalesce(p_country,''))) !~ '^[A-Z]{2}$'
  OR char_length(private.mm_document(p_document)) NOT BETWEEN 3 AND 64
  OR upper(btrim(coalesce(p_code,''))) !~ '^[A-Z0-9]{5}$' THEN RETURN NULL; END IF;
 SELECT count(*) INTO v_count FROM public.integrantes i
 WHERE i.pais_iso2=upper(btrim(p_country))
  AND private.mm_document(i.documento)=private.mm_document(p_document)
  AND upper(btrim(i.codigo_integrante))=upper(btrim(p_code));
 IF v_count<>1 THEN RETURN NULL; END IF;
 SELECT * INTO r FROM public.integrantes i WHERE i.pais_iso2=upper(btrim(p_country))
  AND private.mm_document(i.documento)=private.mm_document(p_document)
  AND upper(btrim(i.codigo_integrante))=upper(btrim(p_code));
 SELECT auth_user_id INTO v_auth FROM public.integrante_auth_links WHERE integrante_id=r.id;
 IF v_auth IS NULL THEN
  SELECT u.id INTO v_auth FROM auth.users u
  WHERE lower(u.email)='integrante-'||r.id::text||'@auth.movidasst.com';
 END IF;
 v_email:='integrante-'||r.id::text||'@auth.movidasst.com';
 IF v_auth IS NOT NULL THEN
  SELECT email INTO v_email FROM auth.users WHERE id=v_auth;
 END IF;
 RETURN jsonb_build_object('integrante_id',r.id::text,'auth_user_id',v_auth,'auth_email',v_email);
END;
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_link_auth(p_integrante_id bigint,p_auth_user_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_existing uuid; v_email text;
BEGIN
 PERFORM 1 FROM public.integrantes WHERE id=p_integrante_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'identity_not_found' USING ERRCODE='22023'; END IF;
 SELECT auth_user_id INTO v_existing FROM public.integrante_auth_links WHERE integrante_id=p_integrante_id;
 IF v_existing IS NOT NULL THEN
  IF v_existing=p_auth_user_id THEN RETURN true; END IF;
  RAISE EXCEPTION 'identity_link_conflict' USING ERRCODE='23505';
 END IF;
 SELECT lower(email) INTO v_email FROM auth.users WHERE id=p_auth_user_id;
 IF v_email IS DISTINCT FROM 'integrante-'||p_integrante_id::text||'@auth.movidasst.com' THEN
  RAISE EXCEPTION 'identity_link_requires_review' USING ERRCODE='42501';
 END IF;
 INSERT INTO public.integrante_auth_links(auth_user_id,integrante_id) VALUES(p_auth_user_id,p_integrante_id);
 INSERT INTO private.mi_movida_audit(integrante_id,auth_user_id,action)
 VALUES(p_integrante_id,p_auth_user_id,'auth_link_created');
 RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_session_context(p_auth_user_id uuid,p_session_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('integrante_id',i.id::text,'public_id',i.public_id,
  'nombres',i.nombres,'apellidos',i.apellidos,'moodle_user_id',i.moodle_user_id::text,
  'credential_stamp',private.mm_credential_stamp(i.id),'active',true)
 FROM public.integrante_auth_links l JOIN public.integrantes i ON i.id=l.integrante_id
 JOIN auth.sessions s ON s.user_id=l.auth_user_id AND s.id=p_session_id
 WHERE l.auth_user_id=p_auth_user_id AND s.created_at>i.mi_movida_auth_epoch
  AND (s.not_after IS NULL OR s.not_after>now());
$$;

CREATE OR REPLACE FUNCTION private.mm_profile(p_id bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
  'id',i.id::text,'public_id',i.public_id,'nombres',i.nombres,'apellidos',i.apellidos,
  'pais_iso2',i.pais_iso2,'pais_nombre',i.pais_nombre,'estado',i.estado,'municipio',i.municipio,
  'edad',i.edad,'genero',i.genero,'grado',i.grado,'carrera',i.carrera,'postgrado',i.postgrado,
  'doctorado',i.doctorado,'laboral',i.laboral,'correo',i.correo,'telefono_e164',i.telefono_e164,
  'telefono_pais_iso2',i.telefono_pais_iso2,'wasap',i.wasap,'whatsapp_username',i.whatsapp_username,
  'linkedin',i.linkedin,'foto_url',i.foto_url,'mostrar_wasap',i.mostrar_wasap,
  'mostrar_whatsapp_username',i.mostrar_whatsapp_username,'mostrar_correo',i.mostrar_correo,
  'mostrar_insignias',i.mostrar_insignias,'profile_version',i.mi_movida_profile_version,
  'documento_enmascarado',CASE WHEN length(i.documento)>4 THEN repeat('*',length(i.documento)-4)||right(i.documento,4) ELSE '****' END,
  'recovery_channel_verified',EXISTS(SELECT 1 FROM private.mi_movida_verified_channels c
   WHERE c.integrante_id=i.id AND c.email=lower(btrim(i.correo))))
 FROM public.integrantes i WHERE i.id=p_id;
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_profile() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT private.mm_profile(private.mm_require_integrante());
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_update_profile(p_changes jsonb,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint:=private.mm_require_integrante(); r public.integrantes; k text;
BEGIN
 IF jsonb_typeof(p_changes)<>'object' THEN RAISE EXCEPTION 'validation_error' USING ERRCODE='22023'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
  IF NOT k=ANY(ARRAY['pais_iso2','pais_nombre','estado','municipio','edad','grado','carrera','postgrado','doctorado','laboral',
   'telefono_e164','telefono_pais_iso2','whatsapp_username','linkedin','mostrar_wasap','mostrar_whatsapp_username','mostrar_correo','mostrar_insignias']) THEN
   RAISE EXCEPTION 'field_not_editable: %',k USING ERRCODE='22023';
  END IF;
  IF length(coalesce(p_changes->>k,''))>500 THEN RAISE EXCEPTION 'validation_error' USING ERRCODE='22023'; END IF;
 END LOOP;
 SELECT * INTO r FROM public.integrantes WHERE id=v_id FOR UPDATE;
 IF p_version IS DISTINCT FROM r.mi_movida_profile_version THEN RAISE EXCEPTION 'profile_version_conflict' USING ERRCODE='40001'; END IF;
 IF p_changes ? 'linkedin' AND coalesce(p_changes->>'linkedin','')<>'' AND p_changes->>'linkedin' !~ '^https://([a-zA-Z0-9-]+\.)?linkedin\.com/' THEN
  RAISE EXCEPTION 'invalid_linkedin' USING ERRCODE='22023';
 END IF;
 IF p_changes ? 'telefono_e164' AND coalesce(p_changes->>'telefono_e164','')<>'' AND p_changes->>'telefono_e164' !~ '^[+][1-9][0-9]{6,14}$' THEN
  RAISE EXCEPTION 'invalid_phone' USING ERRCODE='22023';
 END IF;
 UPDATE public.integrantes i SET
  pais_iso2=CASE WHEN p_changes?'pais_iso2' THEN upper(btrim(p_changes->>'pais_iso2')) ELSE i.pais_iso2 END,
  pais_nombre=CASE WHEN p_changes?'pais_nombre' THEN nullif(btrim(p_changes->>'pais_nombre'),'') ELSE i.pais_nombre END,
  estado=CASE WHEN p_changes?'estado' THEN nullif(btrim(p_changes->>'estado'),'') ELSE i.estado END,
  municipio=CASE WHEN p_changes?'municipio' THEN nullif(btrim(p_changes->>'municipio'),'') ELSE i.municipio END,
  edad=CASE WHEN p_changes?'edad' THEN (p_changes->>'edad')::integer ELSE i.edad END,
  grado=CASE WHEN p_changes?'grado' THEN nullif(btrim(p_changes->>'grado'),'') ELSE i.grado END,
  carrera=CASE WHEN p_changes?'carrera' THEN nullif(btrim(p_changes->>'carrera'),'') ELSE i.carrera END,
  postgrado=CASE WHEN p_changes?'postgrado' THEN nullif(btrim(p_changes->>'postgrado'),'') ELSE i.postgrado END,
  doctorado=CASE WHEN p_changes?'doctorado' THEN nullif(btrim(p_changes->>'doctorado'),'') ELSE i.doctorado END,
  laboral=CASE WHEN p_changes?'laboral' THEN nullif(btrim(p_changes->>'laboral'),'') ELSE i.laboral END,
  telefono_e164=CASE WHEN p_changes?'telefono_e164' THEN nullif(btrim(p_changes->>'telefono_e164'),'') ELSE i.telefono_e164 END,
  wasap=CASE WHEN p_changes?'telefono_e164' THEN nullif(regexp_replace(p_changes->>'telefono_e164','[^0-9]','','g'),'') ELSE i.wasap END,
  telefono_pais_iso2=CASE WHEN p_changes?'telefono_pais_iso2' THEN upper(nullif(btrim(p_changes->>'telefono_pais_iso2'),'')) ELSE i.telefono_pais_iso2 END,
  whatsapp_username=CASE WHEN p_changes?'whatsapp_username' THEN nullif(btrim(p_changes->>'whatsapp_username'),'') ELSE i.whatsapp_username END,
  linkedin=CASE WHEN p_changes?'linkedin' THEN nullif(btrim(p_changes->>'linkedin'),'') ELSE i.linkedin END,
  mostrar_wasap=CASE WHEN p_changes?'mostrar_wasap' THEN (p_changes->>'mostrar_wasap')::boolean ELSE i.mostrar_wasap END,
  mostrar_whatsapp_username=CASE WHEN p_changes?'mostrar_whatsapp_username' THEN (p_changes->>'mostrar_whatsapp_username')::boolean ELSE i.mostrar_whatsapp_username END,
  mostrar_correo=CASE WHEN p_changes?'mostrar_correo' THEN (p_changes->>'mostrar_correo')::boolean ELSE i.mostrar_correo END,
  mostrar_insignias=CASE WHEN p_changes?'mostrar_insignias' THEN (p_changes->>'mostrar_insignias')::boolean ELSE i.mostrar_insignias END,
  mi_movida_profile_version=i.mi_movida_profile_version+1
 WHERE i.id=v_id;
 INSERT INTO private.mi_movida_audit(integrante_id,auth_user_id,action) VALUES(v_id,auth.uid(),'profile_updated');
 RETURN private.mm_profile(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_set_photo(p_url text,p_version bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint:=private.mm_require_integrante(); v_origin text; v_prefix text;
BEGIN
 SELECT api_url INTO v_origin FROM private.mi_movida_config WHERE singleton;
 IF v_origin IS NULL THEN RAISE EXCEPTION 'photo_storage_not_configured' USING ERRCODE='55000'; END IF;
 v_prefix:=v_origin||'/storage/v1/object/public/mi-movida-photos/'||auth.uid()::text||'/';
 IF left(p_url,length(v_prefix))<>v_prefix OR substring(p_url FROM length(v_prefix)+1) !~ '^[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$' THEN
  RAISE EXCEPTION 'invalid_photo_path' USING ERRCODE='22023';
 END IF;
 UPDATE public.integrantes SET foto_url=p_url,mi_movida_profile_version=mi_movida_profile_version+1
 WHERE id=v_id AND mi_movida_profile_version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile_version_conflict' USING ERRCODE='40001'; END IF;
 INSERT INTO private.mi_movida_audit(integrante_id,auth_user_id,action) VALUES(v_id,auth.uid(),'photo_updated');
 RETURN private.mm_profile(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_channel_begin(p_email text,p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint:=private.mm_require_integrante(); v_email text:=lower(btrim(p_email));
BEGIN
 IF p_token_hash !~ '^[a-f0-9]{64}$' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  OR length(v_email)>254 OR v_email LIKE '%@auth.movidasst.com' THEN
  RAISE EXCEPTION 'invalid_channel' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT 1 FROM public.integrantes WHERE id<>v_id AND lower(btrim(correo))=v_email) THEN
  RAISE EXCEPTION 'channel_requires_review' USING ERRCODE='22023';
 END IF;
 UPDATE private.mi_movida_tokens SET consumed_at=now() WHERE integrante_id=v_id AND purpose='verify_channel' AND consumed_at IS NULL;
 INSERT INTO private.mi_movida_tokens(token_hash,integrante_id,purpose,email,expires_at)
 VALUES(p_token_hash,v_id,'verify_channel',v_email,now()+interval '15 minutes');
 RETURN jsonb_build_object('email',v_email);
END;
$$;
CREATE OR REPLACE FUNCTION public.mi_movida_channel_confirm(p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint:=private.mm_require_integrante(); t private.mi_movida_tokens;
BEGIN
 UPDATE private.mi_movida_tokens SET consumed_at=now()
 WHERE token_hash=p_token_hash AND integrante_id=v_id AND purpose='verify_channel'
 AND consumed_at IS NULL AND expires_at>now() RETURNING * INTO t;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.integrantes WHERE id<>v_id AND lower(btrim(correo))=t.email) THEN
  RAISE EXCEPTION 'channel_requires_review' USING ERRCODE='22023';
 END IF;
 INSERT INTO private.mi_movida_verified_channels(integrante_id,email,verified_at,verified_by)
 VALUES(v_id,t.email,now(),auth.uid()) ON CONFLICT(integrante_id)
 DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at,verified_by=excluded.verified_by;
 UPDATE public.integrantes SET correo=t.email,mi_movida_profile_version=mi_movida_profile_version+1 WHERE id=v_id;
 INSERT INTO private.mi_movida_audit(integrante_id,auth_user_id,action) VALUES(v_id,auth.uid(),'recovery_channel_verified');
 RETURN private.mm_profile(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_recovery_prepare(p_country text,p_document text,p_token_hash text,p_ip_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.integrantes; v_count integer; v_email text; v_rate jsonb;
BEGIN
 IF p_token_hash !~ '^[a-f0-9]{64}$' OR p_ip_hash !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'invalid_request' USING ERRCODE='22023';
 END IF;
 v_rate:=public.mi_movida_rate_limit(p_ip_hash,5,900);
 IF NOT (v_rate->>'allowed')::boolean THEN RETURN jsonb_build_object('delivery',NULL); END IF;
 SELECT count(*) INTO v_count FROM public.integrantes i WHERE i.pais_iso2=upper(btrim(p_country))
  AND private.mm_document(i.documento)=private.mm_document(p_document);
 IF v_count<>1 THEN RETURN jsonb_build_object('delivery',NULL); END IF;
 SELECT * INTO r FROM public.integrantes i WHERE i.pais_iso2=upper(btrim(p_country))
  AND private.mm_document(i.documento)=private.mm_document(p_document);
 SELECT c.email INTO v_email FROM private.mi_movida_verified_channels c
 WHERE c.integrante_id=r.id AND c.email=lower(btrim(r.correo));
 -- A confirmed non-synthetic Auth email may be reused, but never an unverified member contact.
 IF v_email IS NULL THEN
  SELECT lower(btrim(u.email)) INTO v_email FROM auth.users u
  JOIN public.integrante_auth_links l ON l.auth_user_id=u.id AND l.integrante_id=r.id
  WHERE u.email_confirmed_at IS NOT NULL AND lower(btrim(u.email))=lower(btrim(r.correo))
   AND lower(u.email) NOT LIKE '%@auth.movidasst.com';
 END IF;
 IF v_email IS NULL OR EXISTS(SELECT 1 FROM public.integrantes WHERE id<>r.id AND lower(btrim(correo))=v_email) THEN
  RETURN jsonb_build_object('delivery',NULL);
 END IF;
 v_rate:=public.mi_movida_rate_limit(md5('recovery:'||r.id::text)||md5('recovery:identity:'||r.id::text),3,900);
 IF NOT (v_rate->>'allowed')::boolean THEN RETURN jsonb_build_object('delivery',NULL); END IF;
 UPDATE private.mi_movida_tokens SET consumed_at=now() WHERE integrante_id=r.id AND purpose='recovery' AND consumed_at IS NULL;
 INSERT INTO private.mi_movida_tokens(token_hash,integrante_id,purpose,email,expires_at)
 VALUES(p_token_hash,r.id,'recovery',v_email,now()+interval '15 minutes');
 RETURN jsonb_build_object('delivery',jsonb_build_object('email',v_email,'integrante_id',r.id::text));
END;
$$;

CREATE OR REPLACE FUNCTION public.mi_movida_recovery_consume(p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t private.mi_movida_tokens; v_auth uuid; v_email text;
BEGIN
 UPDATE private.mi_movida_tokens SET consumed_at=now() WHERE token_hash=p_token_hash AND purpose='recovery'
  AND consumed_at IS NULL AND expires_at>now() RETURNING * INTO t;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.integrantes i WHERE i.id=t.integrante_id AND lower(btrim(i.correo))=t.email) THEN RETURN NULL; END IF;
 UPDATE public.integrantes SET mi_movida_auth_epoch=clock_timestamp() WHERE id=t.integrante_id;
 SELECT l.auth_user_id,u.email INTO v_auth,v_email FROM public.integrante_auth_links l
 JOIN auth.users u ON u.id=l.auth_user_id WHERE l.integrante_id=t.integrante_id;
 IF v_auth IS NULL THEN
  v_email:='integrante-'||t.integrante_id::text||'@auth.movidasst.com';
  SELECT id INTO v_auth FROM auth.users WHERE lower(email)=v_email;
 END IF;
 INSERT INTO private.mi_movida_audit(integrante_id,auth_user_id,action) VALUES(t.integrante_id,v_auth,'access_recovered');
 RETURN jsonb_build_object('integrante_id',t.integrante_id::text,'auth_user_id',v_auth,'auth_email',v_email);
END;
$$;

-- Channel tokens are generated only by the BFF. Clients must never choose hashes.
DROP FUNCTION IF EXISTS public.mi_movida_channel_begin(text,text);
DROP FUNCTION IF EXISTS public.mi_movida_channel_confirm(text);
CREATE OR REPLACE FUNCTION public.mi_movida_channel_begin(p_auth_user_id uuid,p_session_id uuid,p_email text,p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint; v_email text:=lower(btrim(p_email)); v_rate jsonb;
BEGIN
 SELECT (public.mi_movida_session_context(p_auth_user_id,p_session_id)->>'integrante_id')::bigint INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'session_expired' USING ERRCODE='28000'; END IF;
 IF p_token_hash !~ '^[a-f0-9]{64}$' OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(v_email)>254 OR v_email LIKE '%@auth.movidasst.com'
 THEN RAISE EXCEPTION 'invalid_channel' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.integrantes WHERE id<>v_id AND lower(btrim(correo))=v_email)
 THEN RAISE EXCEPTION 'channel_requires_review' USING ERRCODE='22023'; END IF;
 v_rate:=public.mi_movida_rate_limit(md5('channel:'||v_id)||md5('channel:limit:'||v_id),3,900);
 IF NOT (v_rate->>'allowed')::boolean THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE='22023'; END IF;
 UPDATE private.mi_movida_tokens SET consumed_at=now() WHERE integrante_id=v_id AND purpose='verify_channel' AND consumed_at IS NULL;
 INSERT INTO private.mi_movida_tokens(token_hash,integrante_id,purpose,email,expires_at)
 VALUES(p_token_hash,v_id,'verify_channel',v_email,now()+interval '15 minutes');
 RETURN jsonb_build_object('email',v_email);
END; $$;
CREATE OR REPLACE FUNCTION public.mi_movida_channel_confirm(p_auth_user_id uuid,p_session_id uuid,p_token_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint; t private.mi_movida_tokens;
BEGIN
 SELECT (public.mi_movida_session_context(p_auth_user_id,p_session_id)->>'integrante_id')::bigint INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'session_expired' USING ERRCODE='28000'; END IF;
 UPDATE private.mi_movida_tokens SET consumed_at=now() WHERE token_hash=p_token_hash AND integrante_id=v_id AND purpose='verify_channel'
 AND consumed_at IS NULL AND expires_at>now() RETURNING * INTO t;
 IF NOT FOUND THEN RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.integrantes WHERE id<>v_id AND lower(btrim(correo))=t.email) THEN RAISE EXCEPTION 'channel_requires_review' USING ERRCODE='22023'; END IF;
 INSERT INTO private.mi_movida_verified_channels(integrante_id,email,verified_at,verified_by) VALUES(v_id,t.email,now(),p_auth_user_id)
 ON CONFLICT(integrante_id) DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at,verified_by=excluded.verified_by;
 UPDATE public.integrantes SET correo=t.email,mi_movida_profile_version=mi_movida_profile_version+1 WHERE id=v_id;
 RETURN private.mm_profile(v_id);
END; $$;
CREATE OR REPLACE FUNCTION public.mi_movida_revoke_session(p_auth_user_id uuid,p_session_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN UPDATE auth.sessions SET not_after=now() WHERE id=p_session_id AND user_id=p_auth_user_id; RETURN FOUND; END; $$;
-- All helpers and service RPCs fail closed by default. Restore only explicit execution.
REVOKE ALL ON FUNCTION private.mm_document(text),private.mm_credential_stamp(bigint),private.mm_linked_integrante(),private.mm_require_integrante(),private.mm_profile(bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mi_movida_configure(text),public.mi_movida_rate_limit(text,integer,integer),
 public.mi_movida_auth_lookup(text,text,text),public.mi_movida_link_auth(bigint,uuid),public.mi_movida_session_context(uuid,uuid),
 public.mi_movida_recovery_prepare(text,text,text,text),public.mi_movida_recovery_consume(text),
 public.mi_movida_channel_begin(uuid,uuid,text,text),public.mi_movida_channel_confirm(uuid,uuid,text),
 public.mi_movida_revoke_session(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mi_movida_configure(text),public.mi_movida_rate_limit(text,integer,integer),
 public.mi_movida_auth_lookup(text,text,text),public.mi_movida_link_auth(bigint,uuid),public.mi_movida_session_context(uuid,uuid),
 public.mi_movida_recovery_prepare(text,text,text,text),public.mi_movida_recovery_consume(text),
 public.mi_movida_channel_begin(uuid,uuid,text,text),public.mi_movida_channel_confirm(uuid,uuid,text),
 public.mi_movida_revoke_session(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mi_movida_profile(),public.mi_movida_update_profile(jsonb,bigint),public.mi_movida_set_photo(text,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mi_movida_profile(),public.mi_movida_update_profile(jsonb,bigint),public.mi_movida_set_photo(text,bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.pif_current_integrante_id() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pif_current_integrante_id() TO authenticated;
COMMIT;
