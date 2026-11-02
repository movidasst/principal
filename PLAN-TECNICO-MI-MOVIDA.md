# Mi Movida — Plan técnico de correcciones y contratos v0.1
1 de noviembre de 2026 · Rama local: codex/mi-movida-prototipo
Estado: propuesta revisable; prototipo ficticio. Ninguna corrección de backend descrita aquí está aplicada.

## Resultado y alcance
Se propone un portal privado sobre integrantes, puntos_eventos y Moodle. El prototipo no contiene SDK de Supabase, claves, formularios de credenciales operativos ni llamadas a servicios de negocio. No se crearon cuentas, no se desplegaron funciones/migraciones y no se modificaron Directorio, Estudia o productores de XP.

Este documento concreta H1–H7 de AUDITORIA-MI-MOVIDA.md, un contrato de sesión, una clasificación por campo y la transición compatible del ranking. Los nombres mi_movida_* y rutas /api/* siguientes son **contratos propuestos**, no servicios implementados. Las estructuras SQL de ejemplo son especificación, no migraciones.

La base y fuentes se inspeccionaron antes en lectura. En esta etapa se repitió únicamente una comparación agregada de ranking y la lectura de la definición de ranking_sesion_publico. No se usaron credenciales de participantes ni se probaron ataques en producción.

## 1. Cambios concretos H1–H7
### H1 · Normalización internacional única · P0
**Problema:** algunas rutas conservan país/documento, otras suprimen letras, y otras no reciben país.

**Diseño:** integrantes.id es la clave de persona; el documento es una prueba de acceso y un atributo sensible, nunca una clave para joins de actividad. Para documento canónico: Unicode NFKC, trim y mayúsculas; conservar letras y ceros iniciales. Una política explícita por tipo/país define qué separadores pueden ignorarse. No eliminar todos los caracteres no numéricos. Persistir valor original y normalizado si la normalización no es reversible; evitar introducir un segundo documento canónico en cedula. El alias cedula permanece para compatibilidad.

**Código:** módulo compartido versionado de normalización para futuros consumidores; geo/app.html acceso/editor, REGISTRO/index.html validación; estudia/index.html submitProgress; ranking-/app.js; participa/app.js; drive-api y auth.js de herramientas. Las restricciones de largo/formato deben responder al tipo de documento, no asumir Venezuela.

**Edge:** corregir normalizeDocument de crear-sesion-integrante v12 y validar-integrante v13. Entrada país emisor/tipo/documento. Rechazar identidad ambigua; no escoger el primer resultado con limit 1. Un nuevo consumidor no debe encadenar variantes numéricas para “encontrar” personas.

**RPC:** conservar firmas legacy y ofrecer adaptadores versionados hacia un único resolvedor privado; nuevos contratos personales resuelven desde auth_links, sin pedir documentos. El acceso legado a Estudia sigue disponible durante transición; las personas internacionales usan el portal nuevo cuando esté autorizado.

**RLS/autenticación:** ninguna política debe unir por correo/documento. Añadir pruebas con AB00123, 00123 y 123: son diferentes salvo regla documentada de la jurisdicción.

**Salida:** matriz de ejemplos país/tipo aprobada; mismo resultado en JS/Edge/RPC; cero vínculos ambiguos automáticos.
**Reversión:** volver al consumidor previo por flag conservando endpoint versionado y datos originales; no aplicar una normalización destructiva al padrón.

### H2 · Unicidad y prevención de duplicados · P0
La restricción real integrantes_documento_uidx es global sobre upper(trim(documento)); contradice el mensaje del registro “en el país seleccionado”.

1. No sustituir todavía ese índice por (pais_iso2,documento). El editor trata pais_iso2 como residencia: una mudanza no puede cambiar la identidad documental.
2. Acordar país emisor y taxonomía de tipo_documento. Propuesta: añadir documento_pais_emisor y documento_normalizado a integrantes cuando se apruebe el modelo. Mantener pais_iso2 como residencia. Si la jurisdicción garantiza unicidad independientemente de tipo, la clave documental será (país emisor, documento normalizado); en caso contrario incluir tipo normalizado. Esta decisión es bloqueante.
3. Antes de backfill: informe de conflictos por documento, correo, Moodle ID, Auth ID y alias. No deducir país emisor de residencia sin validación. Clasificar “verificado”, “pendiente” y “ambiguo”; no completar por defecto con VE.
4. Mantener PK id, public_id, FK y enlaces existentes. No fusionar homónimos o correos compartidos. Hay al menos un grupo de correo compartido observado: una recuperación por correo debe identificar explícitamente a qué cuenta pertenece.
5. Futuro cambio de restricción aditivo y ensayado: índice único parcial de identidad documental verificada; revisión de filas pendientes; conservar índice antiguo hasta que los consumidores no asuman unicidad global. No permitir nuevos documentos iguales entre países hasta haber corregido todos los resolvedores que omiten país.
6. Registrar desde un backend la asociación del nuevo documento a la misma persona tras comprobación; la edición ordinaria de residencia no toca documento emisor ni id.

**Cambios:** registrar_integrante_internacional y actualizar_integrante_internacional; mensaje de unique_violation debe identificar la restricción que falló, no interpretar cualquier unique_violation como documento duplicado. Códigos/public_id/Moodle ya tienen su propia unicidad. La generación de código necesita retry por restricción de código ante concurrencia.
**RLS:** cambios documentales solo por procedimiento revisado/administrativo, no UPDATE genérico del propietario.
**Rollback:** no eliminar datos de país emisor ni restablecer a ciegas una restricción global si ya se admitieron documentos iguales de países distintos. Desactivar altas nuevas afectadas, conservar lecturas y resolver conflictos. Una fusión exige operación distinta con auditoría y mapa reversible de FK; fuera de esta fase.

### H3 · Sesión y vínculo Auth confiables · P0
Reutilizar Supabase Auth. No crear tabla users ni nueva contraseña.

| Componente | Cambio propuesto | Compatibilidad |
|---|---|---|
| crear-sesion-integrante | Normalización H1, validación de identidad + código, límites servidor, DTO mínimo, canje solo backend; vincular usuario Auth real a integrante_auth_links | Nuevo modo/versionado para Mi Movida; no cambiar silenciosamente respuesta del consumidor PIF |
| integrante_auth_links | Mantener UNIQUE(auth_user_id), UNIQUE(integrante_id), FK y lectura propia. Escritura solo servidor con prueba de identidad, auditoría e idempotencia | No recrear enlaces válidos ni regenerar usuarios existentes |
| private.current_integrante_id propuesto | Resolver integrante_auth_links por auth.uid(); rechazar cero/enlace inválido; sin metadatos editables | Usarlo en nuevas RPC y progresivamente en PIF |
| BFF de Mi Movida propuesto | Canjear token de un uso de Auth; cookie host-only HttpOnly/Secure/SameSite=Lax; refresh y CSRF en servidor | Portal nuevo; sesiones existentes de apps continúan separadas |
| RPC privadas de lectura/edición | Derivar propietario del JWT; sin p_integrante_id solicitado por navegador | Mantener RPC legacy hasta finalizar inventario y pruebas |
| Puntos | Reutilizar política self_read por auth_links; proteger DTO de movimientos | Ningún permiso INSERT/UPDATE/DELETE de XP para el integrante |
| Tokens custom MAC/PP/Participa/Drive | Definir revocación por cambio de código o credencial-version; respetar expiración actual hasta adaptar cada productor | No declarar SSO o logout global si todavía no se implementó |

El correo técnico determinista integrante-ID@auth.movidasst.com sirve para resolver la cuenta existente, no para recuperar por email. Primero revisar usuarios Auth técnicos y cualquier trigger existente. Antes de crear, resolver identidad Auth ya existente por vínculo o correo técnico exacto mediante servicio privilegiado mínimo. Si hay otro usuario Auth legítimo para la persona, conciliar administrativamente; no crearlo de nuevo porque auth_links esté vacío.

Alta de vínculo: comprobar primero cualquier enlace en ambos sentidos. Si existe y coincide, reutilizar. Si existe y contradice, bloquear. Si no existe, usar identidad Auth ya comprobada y escribir con unicidad; en carrera, releer y aceptar solo si coincide. La unicidad del correo técnico y del vínculo, idempotencia y reconciliación ante fallo parcial evitan doble usuario; no borrar una cuenta Auth preexistente al fallar un canje.

Registrar acciones técnicas de vinculación con quién/cuándo/motivo, sin códigos ni tokens. Confirmar existencia y alcance de auditoría actual antes de añadir otro log. Los contadores de abuso/tokens de recuperación pueden necesitar estado efímero privado; no constituyen un padrón paralelo ni credenciales nuevas.

### H4 · Corregir PIF · P0 antes de ampliar acceso
**Confirmado:** pif_current_integrante_id lee auth.jwt()->user_metadata->integrante_id. pif_ensure_access, pif_has_full_access y políticas dependen de él.

- Sustituir implementación por vínculo autenticado de servidor de H3. El frontend pif/app.js puede usar nombres para mostrar, nunca metadatos para autorización.
- Revisar pif_accesos, pif_casos, pif_simulador_intentos, evidencias, storage y funciones pif_is_admin/ensure/has_full_access. Ser propietario auth.uid() y tener acceso pagado son condiciones diferentes.
- No autoelevar nivel gratuito a completo al crear sesión. Leer rol/admin desde fuente administrativa comprobada; un integrante no hereda roles por coincidencia de correo.
- Migración futura por lotes de enlaces verificados, sin cuentas nuevas. Si falta vínculo, denegar operación privada y ofrecer asistencia; no usar metadata como fallback.
- Prueba staging: A cambia user_metadata.integrante_id al de B; sigue resolviendo A. A no lee acceso, casos, archivos o intentos de B; admin sin rol denegado; pago de otra persona no habilita A.
- Reversión segura: desactivar la función privada afectada o la integración y mantener acceso seguro; nunca restaurar la confianza en metadatos editables.

### H5 · Ranking común · P0 antes de migrar Mis puntos
La especificación completa está en la sección 2. Cambiar consultas, no datos. Crear composición interna única por ámbito, usando el mismo predicado de elegibilidad, orden y niveles; wrappers preservan nombres, firmas y columnas legacy.

Archivos consumidores: estudia/index.html, ranking-/app.js, geo/app.html y consumidores del inventario (por ejemplo malo/index.html). Evitar ordenar en cliente una página paginada y presentarla como ranking global. No unir actividad del Directorio por correo: devolver public_id en las dos proyecciones y enlazar por ese identificador.

### H6 · Perfil mínimo y privacidad · P0
- geo/app.html debe consumir proyecciones públicas y DTO propio separados.
- Sustituir to_jsonb(i) - codigo en acceso_integrante_internacional por lista explícita; no exponer moodle_sync_error, pending_email, intentos, timestamps de correo, IDs técnicos o futuros campos añadidos.
- Las RPC directorio_internacional_v1 y directorio_publico_actividad/v2 hoy exponen correo/edad/género; diseñar versiones mínimas y migrar consumidores. No añadir campos privados a un contrato público para simplificar el portal.
- verificar_credencial_internacional: DTO mínimo por public_id, documento completo fuera de la respuesta pública. QR nuevo con public_id; revisar legacy de miembros, no copiar código de acceso a enlaces.
- Preferencias faltantes: propuesta aditiva de mostrar_correo=false y política explícita de perfil/insignias. Registrar consentimiento y fecha/versión cuando corresponda. No interpretar la visibilidad WhatsApp como permiso de email.
- RLS: integrantes sin lectura pública amplia; nuevos RPC self derivan id; auditoría y enlaces no editables por cliente. Grants explícitos; SECURITY DEFINER con search_path vacío, nombres cualificados, autorización interna y EXECUTE mínimo. Usar invoker cuando el acceso permita cumplir el contrato.
- Eliminar datos de logs, analítica, errores, URL y service worker. Caché privada no compartida; Cache-Control: no-store. El prototipo solo cachea estáticos ficticios.
- Cambios que reducen exposición pública requieren migración de consumidores y decisión del responsable de datos. La reversión de UI no vuelve a publicar datos sensibles.

### H7 · Recuperación y resistencia al abuso · P0
**Hoy:** código corto y Apps Script de recuperación con cédula numérica sin país; backend de recuperación no disponible para revisión.

**Propuesta:** mantener la credencial existente solo como puente mientras se incorpora un acceso seguro sin nueva contraseña. Respuestas de recuperación siempre genéricas, mismo status y tiempos no reveladores, sin correo enmascarado que confirme la existencia de una persona.

**Cambios de código:** geo/app.html formulario país/tipo/documento; retirar dependencia del Apps Script solo después de revisar su código y ensayar el reemplazo. Registro/foto/correo mantienen su continuidad actual. Formularios personales no envían código a varios subdominios.

**Servicio de recuperación propuesto:** request/resend limitado por identidad, IP y ventana; token aleatorio de al menos 256 bits, almacenado como hash, 15 minutos, un uso, revocación al canjear y auditoría. Enlace sin documentos; proteger referrer, logs y analítica. GET abre confirmación; no consumir por previsualizador de correo. Canje por POST con prueba del token y protección CSRF. Token no se devuelve por la respuesta de request.

**Canal:** correo u otro canal previamente verificado. La presencia de correo en integrantes no acredita control. Contacto no verificado/compartido/inaccesible: revisión administrativa y prueba de identidad; no enviar enlaces a dirección arbitraria proporcionada en recuperación. Cambio de correo requiere confirmar nuevo destino y reautenticación; no usarlo como prueba retroactiva de titularidad.

**Abuso — parámetros iniciales para validar:** 5 intentos/15 min por identidad, límites adicionales por IP y global, demoras progresivas y detección de bloqueo abusivo de terceros. Nunca solo localStorage. Reutilizar protecciones servidor existentes cuando cubran el mismo propósito. Un bloqueo de IP compartida no debe cerrar sesiones legítimas de toda una organización.

**Ciclo de vida:** revocar refresh tokens y sesiones verificables tras recuperación/cambio de código, y adaptar tokens custom según credencial-version. Revocar refresh no invalida inmediatamente JWT emitidos: para operaciones sensibles comprobar que session_id siga activo y que el vínculo/versión continúen vigentes. TTL corto y reautenticación para contacto, identidad o seguridad. No prometer cierre global hasta cubrir cada app.

**Pruebas:** internacional, replay, expirado, varios requests, escáner de email, caída de cola, canal no verificado, cédula inexistente, ataques distribuidos y cambio de código con sesiones abiertas.
**Reversión:** fallback administrativo seguro; no restaurar recuperación insegura o un canal ya comprometido.

## 2. Regla única de ranking
### Comparación comprobada de fórmulas
| Consulta | Total/ámbito | Exclusiones | Orden | Resultado |
|---|---|---|---|---|
| ranking_publico | SUM(puntos_eventos.puntos) por integrante, total > 0 | IDs 1/575 y ranking_exclusiones.activo ANTES de rank | puntos DESC, integrante_id ASC | Regla de referencia compatible |
| estudia_mi_progreso | Mismo saldo personal, total > 0 para clasificar | Calcula rank con todos; solo pone posición 0 si consultante excluido | Igual | Los excluidos desplazan las posiciones de las demás personas |
| directorio_publico_actividad y v2 | Saldo general; actividad de estudios visibles se calcula por separado | Sin filtro competitivo antes de rank | Igual | Posición de actividad no coincide con pública; además frontend une por correo |
| ranking_todos_estudios_publico | Solo eventos con estudio_sesiones.visible=true | ANTES de rank | Igual | Ámbito diferente, diferencia de total esperada |
| ranking_sesion_publico | Solo eventos de sesion_id solicitado | ANTES de rank | Igual | Preservar contrato; decidir separadamente exposición de estudio oculto |

**Las 234 diferencias, explicadas:** a las 20:27 de Chile (23:27 UTC) del 1 de noviembre se observaron 236 integrantes con total positivo y 2 excluidos con total positivo. Al comparar las fórmulas, los **234 elegibles tenían exactamente +2 posiciones** en la fórmula sin exclusiones previas. Los dos excluidos quedaban antes que cada elegible en ese orden. Por tanto, posición_personal_actual = posición_pública + 2 en esta fotografía. No son 234 saldos erróneos, eventos duplicados ni pérdida de XP. Es una diferencia del conjunto que se ordena.

No se fija un ajuste “restar 2”: el número varía con las exclusiones y los puntos. Se debe filtrar el conjunto correcto antes de calcular. La comprobación fue agregada mediante SELECT; no se iniciaron 234 sesiones.

Ejemplo sintético: Excluido A 5.000 XP, Excluido B 4.000 XP, C 3.000 XP, D 2.000 XP. Fórmula personal da C #3 y D #4; pública da C #1 y D #2. C y D conservan exactamente sus puntos.

### Regla recomendada v1
1. Total por ámbito = SUM de todos los eventos oficiales del ámbito, incluidos ajustes negativos. No recalcular el XP de cada evento ni tocar productores.
2. Elegible = total > 0 y sin exclusión competitiva vigente. Preservar inicialmente la unión de IDs legacy 1/575 y tabla activa; centralizarla en un único predicado. La conversión futura de IDs hardcodeados a filas de exclusiones requiere comprobar equivalencia y aprobación separada.
3. Posición = RANK() OVER (ORDER BY total DESC, integrante_id ASC) sobre los elegibles. La PK única deshace empates: dos saldos iguales tienen posiciones diferentes, como hoy. No cambiar a DENSE_RANK solo por puntos: alteraría la regla pública.
4. Perfil propio: mostrar saldo y nivel aunque esté excluido; posición JSON null y estado excluded. Para total <=0: posición null y estado not_ranked. Adaptadores legacy pueden conservar 0 donde el cliente actual lo espera.
5. Nivel = umbral más alto de ranking_niveles cuyo xp_min <= total; conservar fallback Participante para saldo inferior. No redefinir niveles al implementar el portal. Los niveles del prototipo son fixtures, no se usan para la base.
6. Ranking siempre calculado antes de limit/offset/cursor. Filtros de búsqueda se aplican sobre posiciones ya calculadas; no renumerar resultados de búsqueda ni una página.
7. General suma el libro completo. Estudios suma solo sesiones visibles. Un estudio específico usa su sesion_id; la política de visibilidad de estudios individuales necesita resolución sin confundirla con un cambio de puntos.
8. Lecturas del mismo bloque deben salir de una misma consulta/snapshot con as_of; si ranking cambia entre páginas, reiniciar la navegación o documentar consistencia eventual. Sin tabla de saldos permanente nueva.

Especificación SQL conceptual para el ámbito general:
~~~sql
WITH totales AS (
  SELECT integrante_id, SUM(puntos)::bigint AS total
  FROM public.puntos_eventos
  GROUP BY integrante_id
),
elegibles AS (
  SELECT t.*
  FROM totales t
  WHERE total > 0
    AND integrante_id NOT IN (1, 575)
    AND NOT EXISTS (
      SELECT 1 FROM public.ranking_exclusiones e
      WHERE e.integrante_id = t.integrante_id AND e.activo
    )
),
ordenados AS (
  SELECT integrante_id, total,
    RANK() OVER (ORDER BY total DESC, integrante_id ASC) AS posicion
  FROM elegibles
)
-- Proyección personal: LEFT JOIN desde la persona autorizada a totales/ordenados.
-- Proyección pública: solo ordenados + campos públicos, y paginar al final.
SELECT integrante_id, total, posicion FROM ordenados;
~~~

**Implementación futura:** vista/función interna no expuesta de totales por ámbito y elegibilidad, wrappers de RPC actuales con firmas conservadas; nuevo DTO personal por auth_links; public_id en proyecciones del Directorio. Compartir lógica dentro de PostgreSQL, no copiarla a cada JS. El servidor aplica autorización, no el cliente.

**Aceptación:** saldo personal antes/después idéntico para todos; XP por tipo/fuente idéntico; persona elegible con misma posición en Directorio, Estudia, ranking- y Mi Movida; excluido conserva historial y saldo sin podio; empate mantiene orden por id; páginas no recalculan posiciones. Probar tabla de exclusión sin hardcodes, combinación y reactivación.

**Reversión:** flags por consumidor y RPC versionadas; no restaurar tabla puntos_eventos, no emitir ajustes para compensar posiciones. Mantener una sola regla competitiva activa; si falla el lector nuevo, volver al ranking público de referencia y suspender la posición personal inconsistente antes que mostrar dos verdades.

## 3. Contrato de identidad y sesión
### Modelo mínimo
| Campo | Función | Exposición |
|---|---|---|
| integrantes.id bigint | Identidad canónica estable | Interno; en contrato privado serializado como string para evitar pérdida de precisión JS |
| integrantes.public_id UUID | Enlaces y proyección pública | Público; no secreto, no permiso |
| integrante_auth_links.auth_user_id UUID | Sujeto Supabase Auth único | Servidor/sesión, no directorio |
| integrante_auth_links.integrante_id bigint | Vínculo único con persona | Solo lectura propia; servidor único escritor |
| integrantes.moodle_user_id | Referencia académica única | Solo adaptador servidor; no aceptarla del navegador |
| Código vigente | Credencial legacy de transición | Solo entrada protegida; nunca respuesta, URL o almacenamiento de cliente |
| session_id / versión | Validación/revocación de sesión | Backend; no usar user_metadata como fuente de propiedad |

### Flujos propuestos
**Bootstrap de acceso existente:** POST /api/session/bootstrap {issuer_country,document_type,document,member_code}. Limitar y validar en servidor. Resolver un integrante, localizar/reutilizar Auth y verificar/escribir vínculo sin conflicto. Canjear token Auth de un uso en backend. No retornar hashed_token/access_token/refresh_token en JSON. Emitir cookie host-only; no Domain=.movidasst.com. Cliente recibe exclusivamente el DTO mínimo.

**Sesión existente:** GET /api/session valida usuario Auth y sesión activa; obtiene integrante_auth_links por auth_user_id; si falta, identity_link_required. No pedir registrarse otra vez ni permitir elegir integrante_id arbitrario. Correo técnico/no verificado no sirve para recuperar.

**Refresh:** POST /api/session/refresh con CSRF, rotación y persistencia de refresh protegida; no fabricar otro usuario ni otro sistema de credenciales.

**Logout:** POST /api/session/logout revoca sesión del portal y borra cookie/datos del cliente incluso si proveedor falla; registrar revocación pendiente si hace falta. “Cerrar todas” solo cuando revocación alcance los contratos custom de cada app. No borrar trabajos locales o vínculos.

**Recovery:** POST request devuelve siempre 202 con mensaje genérico; canje separado de token de uso único; como H7. No cambia contraseña de Moodle. No requiere definir una nueva contraseña en Mi Movida.

DTO privado de sesión (ejemplo ficticio, no token):
~~~json
{
  "contract_version": "1",
  "authenticated": true,
  "person": {"id": "900001", "public_id": "00000000-0000-4000-8000-000000000001", "display_name": "Alex Rivera"},
  "permissions": ["profile:read:self", "profile:edit:self", "xp:read:self"],
  "expires_at": "2026-11-01T23:45:00Z",
  "reauth_required": false
}
~~~
permissions informa a la UI; el backend vuelve a verificar. No incluir rol administrativo por defecto. Los IDs ficticios de ejemplo no corresponden al padrón.

TTL propuesto a validar: inactividad 30 min y máximo 12 h de sesión; reautenticación reciente para acciones sensibles. La sesión real de cada app tiene sus reglas actuales: no afirmar unificación todavía.

Estados de error: 401 session_expired, 403 forbidden, 409 identity_link_required/conflict, 422 validation_error sin eco de secretos, 429 retry_after y 503 source_unavailable. Las respuestas de login/recuperación no distinguen persona inexistente de código erróneo.

### Consulta y edición
| Contrato propuesto | Autorización y respuesta |
|---|---|
| GET /api/me/profile | Sesión + enlace, campos privados propios mínimos; versión de perfil para control de concurrencia |
| PATCH /api/me/profile | Lista permitida de contacto/formación/residencia/preferencias; no id, documento, país emisor, roles, XP, Moodle ID o Auth ID; If-Match/version para evitar sobrescritura |
| GET /api/me/xp?cursor=&scope=general | Saldo/nivel/posición común + movimientos de propietario; cursor opaco fecha+id y fuente explícita, total separado de página |
| GET /api/me/activity?source=&cursor= | Historial de consultas/estudios/confirmados propios; sin mensajes ajenos |
| GET /api/me/learning | Adaptador resuelve moodle_user_id desde enlace; fuentes y fecha; fallo no equivale a matrícula ausente |
| GET /api/me/certificates | Separar fuente/emitido/anulado/elegible; ninguna emisión por visitar |
| GET /api/public/profile/:public_id | Lista pública y preferencias; sin documentos, correo privado, id interno o estado administrativo |
| GET /api/public/credential/:public_id | Existencia pública mínima; sin código de acceso; rate limit y sin documento completo |
| GET /api/public/ranking | Mismo ranking de referencia; public_id, nombre público, foto autorizada, XP, nivel, posición; nunca actividad sensible |

RPC propuestas mi_movida_perfil, mi_movida_actualizar_perfil, mi_movida_xp y mi_movida_actividad reciben filtros, no dueño. Resolver auth.uid → auth_links en servidor. EXECUTE solo authenticated; sin grants a PUBLIC/anon para operaciones privadas. Las proyecciones públicas sí tienen grant deliberado y lista de campos separada. RLS sigue activado; usuario no escribe auth_links ni puntos.

Con BFF, llamadas ordinarias a PostgreSQL usan JWT del usuario, no service_role como atajo general. Privilegios altos solo para bootstrap/administración delimitados. Un SECURITY DEFINER necesario verifica sesión/enlace antes de acceder, cualifica tablas y no acepta SQL dinámico del usuario. Véase [RLS oficial](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 4. Campos públicos, privados y administrativos
Esta es la política **propuesta**; no cambia aún la exposición actual. Default restrictivo en el nuevo portal. Confirmar consentimiento con responsable de datos.

| Campos actuales / grupo | Público propuesto | Privado del titular | Administrativo / reglas |
|---|---|---|---|
| public_id | Sí | Sí | Inmutable; UUID no autoriza acceso |
| id, auth_user_id, moodle_user_id | No | id puede existir en API propia, no necesario en UI | Referencias internas; no editables |
| nombres/apellidos | Nombre profesional autorizado | Completo | Cambios legales/canónicos con verificación; demo permite nombre ficticio únicamente |
| foto_url | Foto autorizada | Sí | Evitar rutas de archivo/documento en URL; carga autenticada y tipo/tamaño controlado |
| pais_iso2/pais_nombre | País de residencia si perfil publicado | Sí | No usar como país emisor por defecto |
| estado/municipio | Región general solo si autorizado | Sí | No domicilio preciso ni coordenadas identificables por defecto |
| grado/carrera/postgrado/doctorado | Declarados y publicados por titular | Sí | Diferenciar dato declarado de título validado |
| laboral/linkedin | Opcional por titular | Sí | URL validada, sin scripts/redirecciones arbitrarias |
| correo | Oculto por defecto; solo consentimiento específico | Sí | Verificación/actualización con prueba de control; nunca clave de join |
| wasap/telefono_e164 | Solo mostrar_wasap=true y consentimiento | Sí | E.164 conserva país de teléfono; no llave de identidad |
| whatsapp_username | Solo mostrar_whatsapp_username=true | Sí | Preferencia independiente de teléfono y correo |
| cedula/documento/tipo_documento/país emisor propuesto | No | Enmascarado; completo solo en proceso con necesidad y reautenticación | Modificación verificada; no verificador público |
| edad/genero | No por defecto | Sí cuando exista propósito | Evaluar minimización/retención y si basta rango agregado |
| mostrar_* y consentimiento | Solo efecto de preferencia | Consultable/editable propio | Versión/fecha de consentimiento auditables |
| codigo_integrante/codigo_actualizado_at | Nunca | Código no se devuelve; opción de recuperación segura | Secreto legacy; no QR, logs o DTO; almacenamiento seguro a evaluar en fase de endurecimiento |
| XP/nivel/posición | Resumen competitivo autorizado | Sí, incluidos excluidos | Origen libro; propietario no cambia puntos |
| Historial de XP, días/rachas, detalle encuestas | No | Solo propio, minimizado | Importaciones y evidencias de evaluación a roles autorizados |
| Insignias y certificados | Solo reconocimiento autorizado/verificación mínima | Propios con fuente y vigencia | Pagos, overrides, anulación y diagnóstico detallado fuera del público |
| Notas/matrículas/avance Moodle | No | Propios | Acceso corporativo separado por empresa/curso/rol |
| moodle_sync_*, moodle_email_*, moodle_pending_* | No | Solo estado útil: listo/pendiente/error genérico | Detalles, reintentos, email pendiente y errores administrativos |
| created_at/fecha | No fecha precisa por defecto | Fecha de alta propia si útil | Auditoría de sistema |
| Roles, bloqueos, sesiones, colas, hashes | Nunca | Lista de dispositivos/sesiones sanitizada propia | Control servidor; ningún UPDATE de cliente |
| TXT, alias aprendidos, mensajes, inferencias de grupos | No | Solo reconocimiento confirmado útil | Administrativo con retención definida; no portal personal |

Las respuestas existentes que incluyen más campos deben mantenerse temporalmente solo con un plan de compatibilidad y retirada, sin ampliar su uso. La reducción de exposición no es un simple CSS: debe ocurrir en la consulta/DTO y sus grants.

## 5. Orden de trabajo, validación y reversión
| Paso | Entregable futuro | Prueba obligatoria | Reversión segura |
|---|---|---|---|
| A | Decisiones identidad/privacidad, snapshots de RPC/grants y staging sintético | Normalización diferencial, unicidad y mapa de consumidores | Sin cambio de negocio |
| B | Link Auth y corrección PIF + sesiones | Carreras de bootstrap, enlace existente, falta de enlace, metadata manipulada, refresh/revoke | Desactivar acceso nuevo; conservar links correctos |
| C | Ranking interno común + wrappers | Comparación de saldos antes/después = 0 diferencias; posiciones cruzadas = 0 diferencias; empate/exclusiones/negativos | Flags, mantener consulta pública correcta; cero UPDATE de XP |
| D | DTO y proyección pública mínima, recuperación probada | Anónimo/A/B/admin/empresa ajena; leak red/log/SW; email escáner/replay | Fallback seguro y revisión administrativa; no restaurar fuga |
| E | Integración del portal por módulos | Contratos versionados, edición concurrente, foto/correo falla, historial >120 | Volver a secciones existentes, datos intactos |
| F | Academia/SSO transversal después | Alcance Moodle propio, fallo de fuente, handoff de un uso, preservación de expedientes | Login de cada app y enlace nativo |

Para cada futura corrección: diff revisable separado, responsable, prueba en staging y plan de rollback ensayado. Evitar una “migración general” irreversible. Backups no reemplazan la reversión por flags y contratos: restaurar toda la base perdería actividad posterior.

No se proporcionan migraciones ejecutables ni se despliega nada en esta entrega. El siguiente paso de backend requiere confirmar las decisiones de la sección 6 y autorizar implementación sobre staging, no producción.

## 6. Decisiones pendientes para revisión
| Decisión | Recomendación | Consecuencia de posponer |
|---|---|---|
| País emisor/tipo y unicidad documental | Separar residencia/emisor y confirmar regla por jurisdicción | Bloquea admitir documentos iguales de países distintos |
| Ranking y empates | Mantener puntos DESC/id ASC; excluir antes; no modificar XP | Bloquea migración de posición personal, no saldo |
| IDs competitivos 1/575 | Preservar en v1; centralizar después con equivalencia demostrada | No retirar exclusiones silenciosamente |
| Exposición de estudio oculto por RPC individual | Definir permiso/publicación, conservar contrato hasta decidir | No confundir un estudio oculto con dato público aprobado |
| Campos públicos/contacto/edad/género | Perfil mínimo, contacto opt-in independiente | Bloquea publicación del nuevo Directorio/DTO público |
| Recuperación/canal verificado | Enlace de un uso + fallback administrativo; no correo sin verificar | No lanzar autoservicio de recuperación hasta validar |
| Backend de sesión y hosting del portal | BFF mismo origen + cookie host-only; Auth existente | Local HTML actual es solo prototipo, no arquitectura desplegable de login |
| Duración y logout transversal | 30 min inactivo/12 h máximo propuesto; acciones sensibles reauth | No prometer cierre global de sesiones legacy |
| Cuentas Auth ya existentes y triggers | Conciliación antes de provisión; mantener relación 1:1 | No hacer backfill automático solo por email |
| Reconocimientos académicos | Moodle como autoridad; verificar plugin de certificados | Mostrar emisión por confirmar sin descargar un diploma inventado |
| Propietario de Apps Script y correos | Revisar código/configuración y continuidad antes de reemplazar | Mantener funciones actuales y asistencia, sin reescritura a ciegas |

## 7. Prototipo y revisión
Ruta: prototipo/index.html. Ejecutar desde la raíz: node prototipo/server.mjs. Abrir http://127.0.0.1:4173. Detener el proceso al terminar la revisión. No requiere npm install ni variables de entorno de producción.

Login visual con datos readonly → panel → nueve secciones privadas. Edición ficticia en memoria, filtros de actividad/XP, ranking de ejemplo con búsqueda/ámbito, diálogos de reconocimientos/curso/certificados, muestra de credencial SVG y salida de sesión. No hay creación de usuario ni verificación real.

Identidad visual: logo oficial, Outfit local, azul marino/turquesa/amarillo del Directorio, e insignias SVG existentes. Assets se sirven localmente; sin CDN, analítica o imágenes de participantes. Navegación hash y botón atrás, menú lateral en escritorio, barra inferior y menú completo en móvil, manifest standalone, safe-area y SW limitado a estáticos del prototipo. No representa instalación o SSO de la PWA productiva.

Los números, umbrales, nombre y reconocimientos son ficticios; no son política de asignación ni datos de la comunidad. El encabezado lo mantiene visible y la descarga indica SIN VALIDEZ.

## Fuentes
- Auditoría e inventario local, corte 2026-11-01, y definiciones de RPC del proyecto central consultadas en lectura.
- [Directorio](https://github.com/movidasst/geo/blob/main/app.html), [Estudia](https://github.com/movidasst/estudia/blob/main/index.html), [ranking público](https://github.com/movidasst/ranking-/blob/main/app.js), [Participa](https://github.com/movidasst/participa/blob/main/app.js), [PIF](https://github.com/movidasst/pif/blob/main/app.js).
- Definiciones desplegadas crear-sesion-integrante v12, validar-integrante v13 y RPC privadas/públicas inspeccionadas en la auditoría; revisar de nuevo antes de construir porque pueden evolucionar.
- [Guía oficial RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): grants, políticas y metadatos; no usar user_metadata para autorización.

