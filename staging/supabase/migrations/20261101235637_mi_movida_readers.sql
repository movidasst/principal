-- Read contracts and ranking. Staged for isolated validation only; never assigns XP.
BEGIN;
CREATE OR REPLACE FUNCTION private.mm_source(p public.puntos_eventos) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE
 WHEN p.metadata->>'fuente'='inteligencia_grupo' THEN 'Inteligencia'
 WHEN EXISTS(SELECT 1 FROM public.participa_puntos_otorgados a WHERE a.puntos_evento_id=p.id) THEN 'Participa'
 WHEN EXISTS(SELECT 1 FROM public.desarrolla_puntos_otorgados a WHERE a.puntos_evento_id=p.id) THEN 'Desarrolla'
 WHEN p.sesion_id IS NOT NULL THEN 'Estudia'
 ELSE 'Otros' END;
$$;
CREATE OR REPLACE FUNCTION private.mm_rank(p_scope text DEFAULT 'general')
RETURNS TABLE(integrante_id bigint,puntos bigint,posicion bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH total AS(
 SELECT p.integrante_id,sum(p.puntos)::bigint puntos FROM public.puntos_eventos p
 WHERE (p_scope='general' OR (p_scope='estudios' AND EXISTS(SELECT 1 FROM public.estudio_sesiones s WHERE s.id=p.sesion_id AND s.visible)))
 GROUP BY p.integrante_id HAVING sum(p.puntos)>0
 ), elegible AS(
 SELECT t.* FROM total t WHERE t.integrante_id NOT IN(1,575)
 AND NOT EXISTS(SELECT 1 FROM public.ranking_exclusiones e WHERE e.integrante_id=t.integrante_id AND e.activo)
 )
 SELECT e.integrante_id,e.puntos,rank() OVER(ORDER BY e.puntos DESC,e.integrante_id ASC)::bigint FROM elegible e;
$$;
CREATE OR REPLACE FUNCTION public.mi_movida_xp(p_limit integer DEFAULT 30,p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint:=private.mm_require_integrante(); v_total bigint; v_level record; v_next record; v_rank bigint; v_excluded boolean; v_history jsonb; v_cursor jsonb; v_sources jsonb;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 100 OR (p_before IS NULL)<>(p_before_id IS NULL) THEN RAISE EXCEPTION 'invalid_pagination' USING ERRCODE='22023'; END IF;
 SELECT coalesce(sum(puntos),0) INTO v_total FROM public.puntos_eventos WHERE integrante_id=v_id;
 SELECT * INTO v_level FROM public.ranking_niveles WHERE xp_min<=v_total ORDER BY xp_min DESC LIMIT 1;
 SELECT * INTO v_next FROM public.ranking_niveles WHERE xp_min>v_total ORDER BY xp_min LIMIT 1;
 SELECT posicion INTO v_rank FROM private.mm_rank('general') WHERE integrante_id=v_id;
 v_excluded:=v_id IN(1,575) OR EXISTS(SELECT 1 FROM public.ranking_exclusiones WHERE integrante_id=v_id AND activo);
 SELECT coalesce(jsonb_agg(jsonb_build_object('fuente',x.fuente,'puntos',x.puntos) ORDER BY x.fuente),'[]') INTO v_sources
 FROM(SELECT private.mm_source(p) fuente,sum(p.puntos) puntos FROM public.puntos_eventos p WHERE p.integrante_id=v_id GROUP BY 1)x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',h.id,'fecha',h.created_at,'tipo',h.tipo,'fuente',private.mm_source(h),'puntos',h.puntos,'motivo',h.motivo) ORDER BY h.created_at DESC,h.id DESC),'[]') INTO v_history
 FROM(SELECT p.* FROM public.puntos_eventos p WHERE p.integrante_id=v_id AND (p_before IS NULL OR (p.created_at,p.id)<(p_before,p_before_id)) ORDER BY p.created_at DESC,p.id DESC LIMIT p_limit)p_row
 CROSS JOIN LATERAL(SELECT p_row.*)h;
 IF jsonb_array_length(v_history)=p_limit AND EXISTS(SELECT 1 FROM public.puntos_eventos p WHERE p.integrante_id=v_id AND (p.created_at,p.id)<((v_history->-1->>'fecha')::timestamptz,(v_history->-1->>'id')::uuid)) THEN v_cursor:=jsonb_build_object('fecha',v_history->-1->>'fecha','id',v_history->-1->>'id'); END IF;
 RETURN jsonb_build_object('ranking',jsonb_build_object('puntos',v_total,'posicion',v_rank,'nivel',coalesce(v_level.nombre,'Participante'),'nivel_icono',coalesce(v_level.icono,'🥉'),'siguiente_nivel',v_next.nombre,'siguiente_nivel_xp',v_next.xp_min,'xp_faltante',greatest(0,v_next.xp_min-v_total),'fuera_de_ranking',v_excluded),'historial',v_history,'desglose',v_sources,'next_cursor',v_cursor,'as_of',statement_timestamp());
END; $$;

CREATE OR REPLACE FUNCTION public.mi_movida_activity(p_limit integer DEFAULT 30,p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_source text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id bigint:=private.mm_require_integrante(); v_rows jsonb; v_cursor jsonb;
BEGIN
 IF p_limit NOT BETWEEN 1 AND 100 OR (p_before IS NULL)<>(p_before_id IS NULL) OR (p_source IS NOT NULL AND p_source NOT IN('Estudia','Participa','Inteligencia','Desarrolla','Otros')) THEN RAISE EXCEPTION 'invalid_pagination' USING ERRCODE='22023'; END IF;
 WITH activities AS(
 SELECT md5('study:'||s.id)::uuid id,s.tema titulo,'Estudia'::text fuente,max(p.created_at) fecha,'Participación en estudio'::text detalle,sum(p.puntos)::bigint puntos
 FROM public.puntos_eventos p JOIN public.estudio_sesiones s ON s.id=p.sesion_id WHERE p.integrante_id=v_id GROUP BY s.id,s.tema
 UNION ALL
 SELECT md5('survey:'||r.id)::uuid,q.titulo,'Participa',r.submitted_at,'Respuesta propia registrada',
 (SELECT coalesce(sum(pe.puntos),0)::bigint FROM public.participa_puntos_otorgados po JOIN public.puntos_eventos pe ON pe.id=po.puntos_evento_id WHERE po.respuesta_id=r.id)
 FROM public.participa_respuestas r JOIN public.participa_consultas q ON q.id=r.consulta_id WHERE r.integrante_id=v_id
 UNION ALL
 SELECT p.id,p.motivo,private.mm_source(p),p.created_at,'Movimiento confirmado de XP',p.puntos::bigint
 FROM public.puntos_eventos p WHERE p.integrante_id=v_id AND p.sesion_id IS NULL AND private.mm_source(p)<>'Participa'
 ), selected AS(SELECT * FROM activities a WHERE (p_source IS NULL OR a.fuente=p_source) AND (p_before IS NULL OR (a.fecha,a.id)<(p_before,p_before_id)) ORDER BY fecha DESC,id DESC LIMIT p_limit+1)
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY fecha DESC,id DESC),'[]') INTO v_rows FROM selected s;
 IF jsonb_array_length(v_rows)>p_limit THEN v_rows:=v_rows-(p_limit);v_cursor:=jsonb_build_object('id',v_rows->-1->>'id','fecha',v_rows->-1->>'fecha'); END IF;
 RETURN jsonb_build_object('items',v_rows,'next_cursor',v_cursor);
END; $$;

CREATE OR REPLACE FUNCTION public.mi_movida_badges() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('diagnostico',b->>'codigo','nombre',initcap(replace(b->>'codigo','_',' ')),'fuente','Desarrolla','estado','Confirmada','fecha',b->>'obtenida_at')) FILTER(WHERE coalesce((b->>'prueba')::boolean,false)=false),'[]'))
 FROM jsonb_array_elements(private.desarrolla_insignias_integrante(private.mm_require_integrante())) b;
$$;
CREATE OR REPLACE FUNCTION public.mi_movida_certificates() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',b->>'codigo_certificado','title',initcap(replace(b->>'codigo_competencia','_',' ')),'source','Desarrolla SST','status',CASE WHEN (b->>'vigente')::boolean THEN 'issued' ELSE 'revoked' END,'issued_at',b->>'emitida_at','verification_url','https://desarrolla.movidasst.com/verificar.html?codigo='||(b->>'codigo_certificado'))),'[]'))
 FROM jsonb_array_elements(private.desarrolla_certificados_integrante(private.mm_require_integrante())) b;
$$;
CREATE OR REPLACE FUNCTION public.mi_movida_public_credential(p_public_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('public_id',public_id,'nombres',nombres,'apellidos',apellidos,'pais_nombre',pais_nombre,'carrera',carrera,'grado',grado)
 FROM public.integrantes WHERE public_id=p_public_id;
$$;

-- Existing public signatures preserved. No XP event updates.
CREATE OR REPLACE FUNCTION public.ranking_publico(p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS TABLE(posicion bigint,integrante_id bigint,nombre text,foto_url text,estado text,puntos bigint,nivel text,nivel_icono text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.posicion,i.id,trim(concat_ws(' ',i.nombres,i.apellidos)),i.foto_url,i.estado,r.puntos,
 coalesce(n.nombre,'Participante'),coalesce(n.icono,'🥉')
 FROM private.mm_rank('general') r JOIN public.integrantes i ON i.id=r.integrante_id
 LEFT JOIN LATERAL(SELECT l.nombre,l.icono FROM public.ranking_niveles l WHERE l.xp_min<=r.puntos ORDER BY l.xp_min DESC LIMIT 1)n ON true
 ORDER BY r.posicion LIMIT greatest(1,least(coalesce(p_limit,100),500)) OFFSET greatest(coalesce(p_offset,0),0);
$$;
CREATE OR REPLACE FUNCTION public.ranking_todos_estudios_publico(p_limit integer DEFAULT 500,p_offset integer DEFAULT 0)
RETURNS TABLE(posicion bigint,integrante_id bigint,nombre text,foto_url text,estado text,puntos bigint,nivel text,nivel_icono text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT r.posicion,i.id,trim(concat_ws(' ',i.nombres,i.apellidos)),i.foto_url,i.estado,r.puntos,
 coalesce(n.nombre,'Participante'),coalesce(n.icono,'🥉')
 FROM private.mm_rank('estudios') r JOIN public.integrantes i ON i.id=r.integrante_id
 LEFT JOIN LATERAL(SELECT l.nombre,l.icono FROM public.ranking_niveles l WHERE l.xp_min<=r.puntos ORDER BY l.xp_min DESC LIMIT 1)n ON true
 ORDER BY r.posicion LIMIT greatest(1,least(coalesce(p_limit,500),500)) OFFSET greatest(coalesce(p_offset,0),0);
$$;
-- Patch the verified legacy function body in-place; abort rather than guess if its source changed.
DO $$
DECLARE original text; updated text; name text;
BEGIN
 IF to_regprocedure('public.estudia_mi_progreso(text,text)') IS NOT NULL THEN
  SELECT replace(pg_get_functiondef('public.estudia_mi_progreso(text,text)'::regprocedure),chr(13),'') INTO original;
  updated:=replace(original,E'from public.puntos_eventos p\n    group by p.integrante_id',E'from public.puntos_eventos p\n    where p.integrante_id not in (1,575) and not exists (select 1 from public.ranking_exclusiones e where e.integrante_id=p.integrante_id and e.activo)\n    group by p.integrante_id');
  IF updated=original THEN RAISE EXCEPTION 'Legacy Estudia changed; review compatibility patch before applying'; END IF;
  EXECUTE updated;
 END IF;
 FOREACH name IN ARRAY ARRAY['directorio_publico_actividad','directorio_publico_actividad_v2'] LOOP
  IF to_regprocedure('public.'||name||'()') IS NOT NULL THEN
   SELECT pg_get_functiondef(to_regprocedure('public.'||name||'()')) INTO original;
   updated:=replace(original,'r.posicion::bigint','(select k.posicion from private.mm_rank(''general'') k where k.integrante_id=i.id)::bigint');
   IF updated=original THEN RAISE EXCEPTION 'Legacy Directorio changed; review compatibility patch'; END IF;
   EXECUTE updated;
  END IF;
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION private.mm_source(public.puntos_eventos),private.mm_rank(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mi_movida_xp(integer,timestamptz,uuid),public.mi_movida_activity(integer,timestamptz,uuid,text),public.mi_movida_badges(),public.mi_movida_certificates() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mi_movida_xp(integer,timestamptz,uuid),public.mi_movida_activity(integer,timestamptz,uuid,text),public.mi_movida_badges(),public.mi_movida_certificates() TO authenticated;
REVOKE ALL ON FUNCTION public.mi_movida_public_credential(uuid),public.ranking_publico(integer,integer),public.ranking_todos_estudios_publico(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mi_movida_public_credential(uuid),public.ranking_publico(integer,integer),public.ranking_todos_estudios_publico(integer,integer) TO anon,authenticated,service_role;
COMMIT;
