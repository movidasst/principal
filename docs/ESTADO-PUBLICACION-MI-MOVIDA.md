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
1. **Migración real de base**: comparar SQL incremental con todas las definiciones y políticas existentes, hacer backup, revisión PIF, Directorio, ranking y consumidores heredados. No aplicar el baseline sintético a producción.
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
