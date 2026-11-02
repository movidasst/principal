# Mi Movida — estado de publicación

Actualizado: 2026-11-02.

## Hecho y comprobado
- Código de las diez pantallas en rama de revisión, sin merge a main.
- Formulario de acceso documento + código de cinco caracteres.
- Migraciones SQL probadas sobre Supabase nativo aislado y fixtures sintéticos en GitHub Actions.
- Gateway `mi-movida-api` desplegado en el proyecto Supabase existente, versión 2, sin modificaciones a funciones antiguas.
- Gateway Edge con rutas de sesión, perfil, XP, actividad, ranking, credencial y adaptador Moodle; controles por bandera apagados.
- Build estático de la sección `/mi-movida/` preparado para GitHub Pages y adjunto como artefacto CI.
- Pruebas sintéticas y Deno de gateway aprobadas en la revisión, con nuevo smoke local agregado.

## Importante: el acceso de usuarios todavía NO está habilitado
La función desplegada usa `verify_jwt=false` para aceptar la solicitud inicial de login sin token. El código exige JWT Auth y pertenencia para rutas privadas, pero **las banderas de acceso no están habilitadas**. No configurar `MM_ENABLE_MEMBER_LOGIN`, `MM_ENABLE_MEMBER_READS`, `MM_ENABLE_MEMBER_WRITES`, `MM_ENABLE_PUBLIC_READS` ni `MM_ENABLE_MOODLE_READS` en producción antes de validar contratos.

## Bloqueos concretos de publicación
1. **Migración real de base**: comparar SQL incremental con todas las definiciones y políticas existentes, hacer backup, revisión Directorio, ranking y consumidores heredados. No aplicar el baseline sintético a producción.
2. **Prueba Auth real controlada**: generar y enlazar una identidad de ensayo en Auth y validar el login corto contra el esquema real, revocación, rate limits, bloqueo de suplantación y sesiones entre pestañas. No usar cédulas/códigos de participantes reales en CI.
3. **Fotos**: `GET/POST /api/me/photo` todavía no está portado al gateway Edge ni existe aquí una implementación final de transcodificación/limpieza EXIF. No habilitar edición de foto hasta resolverlo.
4. **Recuperación**: `POST /api/session/recovery/request/consume` y verificación de canal están implementados para Node, pero pendientes en Edge. Requieren correo autenticado y ensayo autorizado.
5. **Moodle**: adaptador portado a Edge; comprobar con servicio Moodle de pruebas, token solo en Secret del servidor, matrículas, notas, customcert y PDF con estudiante ficticio.
6. **Frontend Pages**: publicar el build estático solo después de validar la comunicación JWT/CORS, acceso a imágenes y descarga PDF desde origen diferente. En la rama existe el modo Edge opt-in vía meta, pero no está activo en www.
7. **Logo**: verificar visualmente que la imagen del HUB es la misma fuente horizontal exacta instalada en Moodle.
8. **Regresión y lanzamiento**: pruebas móviles/PWA, privacidad de legacy, rollback de DB y de frontend, monitorización sin PII, aprobación de activación.

## Qué NO se ha hecho
No se modificaron datos de integrantes, XP, certificados ni contraseñas de producción. No se fusionó el PR. No se cambiaron DNS/GoDaddy. No se inició un hosting externo.

## Procedimiento seguro de activación
Primero validar contratos y cerrar los ocho puntos. Después habilitar flags en ensayo, ejecutar E2E nativa, probar el build en navegador, desplegar migración incremental revisada, habilitar al grupo piloto y finalmente a la comunidad. Si hay fallo, deshabilitar flags y revertir frontend sin borrar integrantes ni XP.

## Comprobación específica del Supabase existente — 2026-11-02

Se efectuaron consultas **solo de catálogo** (sin leer cédulas, códigos ni perfiles). El proyecto tiene la tabla `integrante_auth_links` y en `integrantes` existen `cedula`, `documento` y `codigo_integrante`. Sin embargo, en el esquema actual **no existen** `public.mi_movida_auth_lookup_document`, `public.mi_movida_session_context`, `public.mi_movida_profile` ni `private.mi_movida_rate_limits`; tampoco existen todavía las columnas `mi_movida_auth_epoch` y `mi_movida_profile_version`.

Por lo tanto la función Edge instalada con las banderas apagadas **no puede iniciar sesión realmente** hasta aplicar migraciones incrementales compatibles. No confundir el éxito de migraciones aisladas con su instalación en la base compartida. No ejecutar directamente el baseline sintético ni el script general contra producción: contienen cambios de constraints y permisos que afectan a consumidores existentes; requieren comparación de DDL, respaldo y regresiones del Directorio antes de promover.

La normalización de cédula `V-12.345.678` → `12345678` fue incorporada al login de Edge y al RPC bajo revisión. Los usuarios siguen ingresando con cédula y código de cinco caracteres, sin país obligatorio ni nuevo registro.

## Avance posterior: fotografías Edge

Se prepararon rutas GET y POST de fotografía con autenticación, ruta de objeto asignada al usuario y límite de 5 MB en lectura por streaming. La interfaz obtiene la imagen autenticada como blob de sesión y vuelve a codificar la foto con Canvas antes de enviarla a Edge para no transmitir metadatos EXIF originales. La función requiere simultáneamente `MM_ENABLE_MEMBER_READS=true`, `MM_ENABLE_PHOTOS=true` y, para escribir, `MM_ENABLE_MEMBER_WRITES=true`. **Estos interruptores están desactivados en producción**. No se ha probado aún la lectura de fotos legacy ni la migración SQL real y el navegador requiere pruebas en dispositivos móviles.

PIF no forma parte de Mi Movida: eliminadas sus referencias de las migraciones, tests y políticas Storage, y añadida regresión que impide reintroducirlas.

## Avance — recuperación y versión 5 de Edge

La función Edge incorpora solicitud de recuperación por correo verificado, enlace de un solo uso y consumo del token, además de alta y confirmación del canal de recuperación. Requieren `MM_ENABLE_RECOVERY=true`, correo de salida autorizado y, para el canal, `MM_ENABLE_MEMBER_WRITES=true`. **No se han activado en producción ni se ha enviado ningún correo real durante las pruebas**. El navegador ya recibe la sesión resultante de la recuperación sin pasar por un servidor Node.

La función `mi-movida-api` está instalada en el Supabase existente como versión 5, pero no es una publicación utilizable por integrantes: faltan migraciones SQL revisadas y banderas autorizadas. Las suites sintéticas y Deno estaban aprobadas al publicarla; no sustituye una prueba integral real de login, RLS y Moodle.
