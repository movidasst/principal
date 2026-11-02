# Promoción y reversión, pendientes de aprobación

## Fases y puertas de revisión

1. Revisar rama y diferencias contra main. Mantener página principal y sus accesos. Validar las diez pantallas sintéticas y pruebas automáticas.
2. Ejecutar Supabase nativo local con Docker y Moodle/correo de pruebas. Resolver pendientes de ENTREGA-FUNCIONAL, especialmente privacidad legacy, acceso internacional y permisos PIF. Ensayar migración/reversión en esquema completo sin PII.
3. Crear migraciones incrementales para la base existente: **solo backend/sql revisado**, nunca baseline local. Comparar firmas, grants, políticas, índices y definiciones de consumidores con snapshot anterior. Revisar impacto de revocaciones. Verificar snapshot/backup y recuperación antes de cualquier promoción.
4. Revisión explícita del resultado y autorización de despliegue. No fusionar ni publicar producción en esta entrega. Publicar primero cambios compatibles de DB/API; habilitar sección bajo bandera solo tras regresión. No retirar interfaces privadas originales hasta aceptación funcional.
5. Observar errores, denegaciones, latencia, entregas de correo y consistencia de ranking sin registrar PII/tokens. Ampliar acceso solo con métricas y validación.

## Hosting

El principal actual es estático. GitHub Pages por sí solo **no ejecuta el BFF Node**. Se requiere runtime privado/reverse proxy del mismo origen para `/api/*` y `/mi-movida/*`, o servir principal desde el host integrado; cookies, CSRF y origen deben conservarse. No poner service_role/Moodle/Resend en JavaScript estático. La rama no crea workflows de despliegue.

El service worker del principal permanece intacto; la sección usa su manifiesto. API y páginas privadas responden no-store y no se añade caché privada offline. Probar instalación PWA, navegación móvil, volver, pestañas originales, logout y modo sin conexión en cada navegador objetivo.

## Reversión segura

Primero desactivar sección funcional/iframe y volver al HTML/CSS previo, conservando enlaces originales. Detener BFF y revocar sesiones de Mi Movida si hay incidente; rotar secretos solo mediante operación autorizada. No revertir XP: ninguna migración los modifica.

Guardar definiciones previas exactas de RPC, Edge, grants y políticas antes de promover; restaurarlas mediante migración compensatoria revisada si el cambio compatible falla. El parche legacy de ranking aborta si cambió el cuerpo esperado para evitar reemplazar código ajeno. No ejecutar un DROP genérico para revertir. Columnas aditivas/enlaces/canales verificados permanecen hasta revisión y respaldo; no borrar identidades, fotografías ni registros nuevos. Ensayar recuperación de backup en instancia aislada.

El rollback local desechable consiste en detener el proceso sintético (estado en memoria) o resetear únicamente el contenedor local. Nunca resetear el proyecto de producción. No se adjunta rollback SQL destructivo automático.
