-- Mi Movida: consultas de auditoría, solo lectura.
-- Ejecutadas mediante conexión autorizada al proyecto lfdmbkzghnwvsapxypvt.
-- No ejecutar RPC de negocio para repetir esta auditoría: algunas crean sesiones o escriben datos.
-- Corte de resultados: 2026-11-01, America/Santiago.

-- A. Columnas del esquema público (sin filas de participantes).
select table_name,column_name,data_type
from information_schema.columns where table_schema='public'
order by table_name,ordinal_position;

-- B. Índices relevantes.
select tablename,indexname,indexdef from pg_indexes
where schemaname='public'
and tablename in ('integrantes','integrante_auth_links','puntos_eventos',
'participa_respuestas','desarrolla_progreso');

-- C. Estado RLS.
select c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in
('integrantes','integrante_auth_links','puntos_eventos','participa_sesiones',
'participa_respuestas','participa_respuesta_items','calificaciones_moodle','pif_accesos');

-- D. Políticas, sin datos de personas.
select tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public'
and (tablename in ('integrantes','integrante_auth_links','puntos_eventos',
'participa_respuestas','participa_respuesta_items','calificaciones_moodle')
or tablename like 'pif_%')
order by tablename,policyname;

-- E. Definiciones relevantes; inspección, no invocación.
select p.proname,pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
('acceso_integrante','acceso_integrante_internacional',
'registrar_integrante_internacional','estudia_mi_progreso',
'ranking_publico','ranking_todos_estudios_publico',
'participa_login','participa_bootstrap','pif_current_integrante_id',
'pif_ensure_access','pif_has_full_access','directorio_internacional_v1',
'directorio_publico_actividad','directorio_publico_actividad_v2',
'verificar_credencial_internacional');

-- F. Conteos agregados; no se devuelve el correo compartido.
select count(*) as integrantes,
count(*) filter(where public_id is null) as sin_public_id,
count(*) filter(where moodle_user_id is not null) as con_moodle,
(select count(*) from public.integrante_auth_links) as enlaces_auth,
(select count(*) from (
 select lower(trim(correo)) from public.integrantes
 where nullif(trim(correo),'') is not null
 group by lower(trim(correo)) having count(*)>1
) s) as correos_compartidos_grupos
from public.integrantes;
-- Resultado: 2076, 0, 2076, 1, 1.

-- G. Comparación de fórmulas vigentes de posición, sin credenciales.
with totals as (
 select integrante_id,sum(puntos) puntos from public.puntos_eventos
 group by integrante_id having sum(puntos)>0
), all_rank as (
 select integrante_id,rank() over(order by puntos desc,integrante_id asc) pos
 from totals
), public_rank as (
 select t.integrante_id,rank() over(order by puntos desc,t.integrante_id asc) pos
 from totals t
 where t.integrante_id not in (1,575)
 and not exists(
  select 1 from public.ranking_exclusiones e
  where e.integrante_id=t.integrante_id and e.activo
 )
)
select count(*) filter(where a.pos<>p.pos) as posiciones_personales_distintas,
count(*) as clasificados
from public_rank p join all_rank a using(integrante_id);
-- Resultado: 234, 234. Contraste de fórmulas; no sesión funcional de 234 personas.

-- H. Composición del libro XP sin identidad individual.
select tipo,coalesce(metadata->>'fuente','(sin fuente)') fuente,
count(*) eventos,sum(puntos) xp
from public.puntos_eventos
group by tipo,coalesce(metadata->>'fuente','(sin fuente)')
order by eventos desc;
-- actividad/inteligencia_grupo: 234 eventos, 13050 XP.
-- whatsapp_participacion/(sin fuente): 94, 3600.
-- calidad_tecnica/(sin fuente): 72, 4475.
-- historico/(sin fuente): 20, 9370.
-- actividad/(sin fuente): 15, 1500.
-- ajuste/(sin fuente): 2, 5000.
-- No atribuir los eventos sin metadata.fuente a una app solo por tipo.

-- I. Estructura de certificados/reconocimientos sin leer filas ni claves.
select table_schema,table_name,
string_agg(column_name,', ' order by ordinal_position) as columns
from information_schema.columns
where (table_schema='private' and table_name ~ 'desarrolla_cert|insignia|mac_members|mac_sessions')
or (table_schema='public' and table_name ~ 'directorio|ranking_exclusiones')
group by table_schema,table_name;

-- J. Firmas y privilegios de RPC relevantes.
select p.oid::regprocedure::text as signature,p.prosecdef as security_definer,
p.proacl::text as grants
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
and (p.proname ~ 'integrante|ranking|estudia_mi|participa_login|participa_bootstrap|inteligencia_xp|recuper|moodle|insignia')
order by p.proname;

