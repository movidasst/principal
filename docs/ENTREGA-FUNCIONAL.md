# Mi Movida: entrega para revisión, sin despliegue

La sección se integra en `principal`, sobre el historial existente de `main`. Se conservan sus vistas, navegación, manifiesto PWA y accesos a Registro, Directorio, Estudia y Academia. El iframe de revisión usa el mismo origen y el BFF sirve tanto la página principal como `/mi-movida/`. No se ha desplegado nada ni ejecutado SQL de escritura en producción.

## Ejecutar y revisar

Node 24 y `npm ci`; luego `npm run stage:synthetic`. Abrir http://127.0.0.1:4174/?vista=mi-movida. Cuenta **exclusivamente ficticia**: país CL, documento DEMO001, código A1B2C. PostgreSQL PGlite en memoria, Auth simulado, archivos en memoria y transporte Moodle simulado. Reiniciar elimina los cambios sintéticos. La interfaz avisa explícitamente que no se introduzcan datos reales.

`npm test` ejecuta los contratos SQL y las pruebas HTTP, autenticación, autorización, recuperación, ranking y Moodle. Resultado verificado: **42 pruebas aprobadas**. No equivale a validar Supabase Auth/Storage/Edge nativos: esos componentes necesitan la ejecución Docker descrita en STAGING.md.

## Estado verificable por sección

| Sección | Implementado en código y probado localmente | Validación pendiente |
|---|---|---|
| Acceso | Documento normalizado, código existente, enlace único, cookie cifrada HttpOnly, CSRF y límites | Auth nativo y cuentas heredadas no técnicas: revisión de vínculo, sin duplicarlas |
| Panel | Agrega perfil, XP, actividad, insignias y aprendizaje por API | Prueba de carga y disponibilidad de servicios de ensayo |
| Credencial | Identidad propia y verificación pública mínima por public_id; descarga SVG sin documento/código | Regresión del verificador existente |
| Perfil | Consulta propia, edición permitida con versión, contacto verificado separado | Directorio legado debe migrar su proyección de privacidad antes de producción |
| Foto | Ruta propia, MIME/firma/tamaño, subida única, RPC propietaria y limpieza en fallo | Storage nativo; decodificación y eliminación EXIF antes de publicación general |
| Puntos/ranking | Libro puntos_eventos, cuatro fuentes autorizadas, otras fuentes conservadas; paginación y ranking canónico | Regresión sobre copia estructural completa y consumidores heredados |
| Insignias | Reutiliza helper privado Desarrolla; excluye prueba | Motor real de emisión y permisos de su entorno de pruebas |
| Actividad | Estudios con XP, encuestas respondidas incluso sin XP, eventos de grupo y otros movimientos | Ampliar registros de estudios/Desarrolla sin evento XP según contratos existentes |
| Aprendizaje | Adaptador Moodle privado: matrícula, avance y nota propia; errores/ocultamiento explícitos | Moodle de pruebas autorizado y servicio mínimo habilitado |
| Certificados | Desarrolla emitidos/vigentes y Moodle customcert emitidos; descarga con propiedad; completar curso no emite certificado | Plugin y permisos Moodle reales, URL de verificación Desarrolla |
| Cuenta/seguridad | Canal verificado, recuperación hash de un uso/15min, revocación servidor, logout | Correo de ensayo; reintentos de entrega persistentes y monitoreo sin PII |

No se presenta la integración con producción como terminada. Las diez pantallas utilizan APIs funcionales; la prueba de extremo a extremo disponible aquí usa fuentes sintéticas independientes. El código de transporte real está separado de esas fuentes y falla explícitamente si faltan contratos/configuración.

## H1–H7: correcciones y límites

| Hallazgo | Cambio preparado | Cierre pendiente antes de producción |
|---|---|---|
| H1 | NFKC/mayúsculas, preservación de letras y ceros en BFF, RPC y adaptadores Edge; se retira constraint numérico | Migrar todos los productores heredados y formularios; residencia sigue siendo selector de acceso legado, no país emisor |
| H2 | Conserva índice documental global; UNIQUE de enlace Auth, conflictos explícitos, sin nuevo registro maestro | Resolver emisor/tipo y grupo de correo duplicado por revisión administrativa; no relajar unicidad a residencia/documento |
| H3 | Auth actual + integrante_auth_links; JWT verificado y sesión activa; no contraseña nueva | Vínculos preexistentes no técnicos se bloquean para revisión; no reutilizar identidad administrativa por código corto |
| H4 | pif_current_integrante_id resuelve vínculo y sesión; metadata editable no autoriza | Regresión PIF de pagos, roles, casos, simulador y Storage; no se cambia su interfaz ni su nivel de acceso |
| H5 | Composición única, wrappers compatibles y parche de cuerpo legacy con comprobación de origen | Comprobar firmas y definiciones en staging completo; parche aborta si la definición difiere |
| H6 | DTO propio explícito, campos editables permitidos, credencial pública mínima, sin IDs Moodle ni documento público | Proyecciones públicas y joins por correo de Directorio legado aún deben migrar; flags nuevos no garantizan privacidad en consumidores antiguos |
| H7 | Canal verificado, tokens hash, límites, respuesta genérica, caducidad y revocación | No dar recuperación por correo no verificado; asistencia administrativa y cola duradera para entrega fallida |

### Ranking recomendado y las 234 diferencias

El saldo se conserva: `SUM(puntos_eventos.puntos)` por `integrante_id`, incluidos ajustes negativos. General usa todos los eventos; ámbito estudios usa sesiones visibles. Solo se clasifican saldos positivos. Excluir IDs 1/575 y exclusiones activas **antes** de `row_number()`, ordenar por puntos DESC e integrante_id ASC, y obtener nivel de ranking_niveles. No cambiar reglas de otorgamiento, eventos ni saldos.

En la auditoría había 236 saldos positivos y dos personas excluidas por delante. La fórmula privada/Directorio numeraba antes de excluir; la pública excluía antes. Por eso las 234 personas elegibles tenían exactamente dos posiciones de desplazamiento. Los wrappers conservan firmas y columnas; no se recalcula ni reescribe XP. Son cifras del diagnóstico, no un recuento actualizado de producción.

## Contrato de identidad y datos

`integrantes.id` identifica persona; `integrante_auth_links.auth_user_id` enlaza Auth con UNIQUE en ambas direcciones. `public_id` sirve para verificación pública. Documento, correo y Moodle ID no son claves de unión para la actividad. El documento emisor/tipo queda nullable hasta verificación; no se deriva de residencia. El puente de acceso existente país registrado/documento/código se mantiene sin inventar contraseña ni usuario paralelo.

El BFF verifica JWT con Auth y sesión contra auth.sessions, luego resuelve vínculo y estampilla de credencial. Tokens de proveedor permanecen cifrados en cookie host-only, HttpOnly/Secure en HTTPS/SameSite=Lax; nunca en localStorage o JSON del cliente. Caducidad 30 min inactiva/12 h absoluta. Operaciones privadas no aceptan un integrante_id elegido por el navegador. Recuperar acceso invalida las sesiones anteriores y conserva la misma identidad. Cuentas sin canal verificado requieren atención verificada; no se promete recuperación automática insegura.

| Público mínimo | Privado del titular | Administrativo, nunca DTO cliente |
|---|---|---|
| public_id, nombres, país, profesión; foto según política actual del Directorio | Contacto, preferencias, movimientos XP, encuestas propias, matrícula/avance/notas/certificados | Código, documento de acceso, JWT/refresh, link Auth, Moodle ID/token, errores sync, tokens hash, auditoría y límites |

Las RPC propias requieren vínculo y sesión. Las operaciones de recuperación/vínculo y configuración son solo service_role. El BFF mantiene dicha clave únicamente en servidor. Las preferencias de visibilidad necesitan migración de consumidores públicos heredados antes de considerarse efectivas en todo el ecosistema.

## Archivos y evidencias

Servidor/API: `application/server`; interfaz: `application/public`; fuentes sintéticas: `application/staging`; SQL versionado: `backend/sql`; compatibilidad Edge revisable: `backend/edge`; pruebas: `application/tests` y `backend/tests`. No sustituir funciones de producción copiando estas carpetas sin el procedimiento de STAGING y despliegue.

Las capturas de `docs/evidencias` son del entorno sintético. Las pruebas automatizadas contienen aserciones por sección y de denegación entre personas. Los documentos de auditoría/prototipo previos se conservan como antecedentes; el estado de implementación vigente es este documento.


## Actualización de interfaz: acceso de dos campos y marca (2 nov 2026)

La rama de revisión ahora muestra solamente **cédula/documento y código de cinco caracteres**. Se retiraron país y tipo del formulario. El BFF utiliza los nuevos contratos `mi_movida_auth_lookup_document` y `mi_movida_recovery_prepare_document`; ambos rechazan coincidencias que no identifiquen exactamente a una sola persona y no crean cuentas duplicadas. El contrato anterior por país permanece para consumidores legacy. La recuperación sigue requiriendo un canal previamente verificado.

La interfaz referencia `/logo-oficial-movida-sst-plus.png` (recurso oficial actualmente referenciado por el HUB) y preserva proporciones sin recorte circular. **Pendiente:** verificar visualmente contra el archivo horizontal exacto instalado en Moodle; el nombre por sí solo no demuestra equivalencia.

Se actualizaron pruebas sintéticas y se añadieron casos específicos de los nuevos contratos. **No se ha ejecutado la suite completa después de estos cambios:** el entorno disponible para esta revisión no resolvió el host de GitHub para clonar y ejecutar Node. Las 42 pruebas previamente comunicadas corresponden al estado anterior de la rama. Ejecutar `npm ci && npm test` en una copia actualizada y después las pruebas nativas de Supabase antes de autorizar cualquier despliegue.
