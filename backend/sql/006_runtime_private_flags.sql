-- Mi Movida runtime release switches. Never expose admin keys to clients.
ALTER TABLE private.mi_movida_config
  ADD COLUMN IF NOT EXISTS allow_login boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_private_reads boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_member_writes boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_public_reads boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_moodle_reads boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_recovery boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.mi_movida_runtime_flags() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object(
 'MM_ENABLE_MEMBER_LOGIN',allow_login,
 'MM_ENABLE_MEMBER_READS',allow_private_reads,
 'MM_ENABLE_MEMBER_WRITES',allow_member_writes,
 'MM_ENABLE_PUBLIC_READS',allow_public_reads,
 'MM_ENABLE_MOODLE_READS',allow_moodle_reads,
 'MM_ENABLE_RECOVERY',allow_recovery
 ) FROM private.mi_movida_config WHERE singleton IS TRUE;
$$;
REVOKE ALL ON FUNCTION public.mi_movida_runtime_flags() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mi_movida_runtime_flags() TO service_role;
-- The existing GEO verifier remains official. Do not expose a second verifier.
REVOKE ALL ON FUNCTION public.mi_movida_public_credential(uuid) FROM PUBLIC,anon,authenticated;
