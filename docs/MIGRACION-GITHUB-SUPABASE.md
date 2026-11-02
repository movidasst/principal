# Mi Movida: GitHub Pages + Supabase Edge Functions (sin otro hosting)

## Decisión
- GitHub Pages continúa sirviendo el HUB en www.movidasst.com.
- Supabase existente presta DB, Auth, Storage y Edge Functions.
- Moodle existente sigue siendo la fuente académica.
- La API Node del PR **no se puede trasladar tal cual** a Edge: depende de Node HTTP, filesystem, cookies de mismo origen y APIs que no equivalen a una función Deno.

## Estado concreto de la migración
Se añadió `staging/supabase/functions/mi-movida-api/index.ts`, una puerta aislada **sin acceso a datos personales**, con CORS restringido, preflight y rutas privadas cerradas. Es una base para migración, NO sustituye el backend funcional Node.

### Pendiente antes de habilitar en el HUB
1. Rediseñar sesión entre GitHub Pages y el subdominio de Supabase: no compartir cookies host-only entre orígenes. Utilizar flujo seguro de Auth con JWT en memoria/cliente según modelo verificado, políticas RLS, expiración y revocación. Nunca enviar service_role al navegador.
2. Migrar cada ruta `/api/me/*` a Edge con validación de JWT y propiedad comprobada, reutilizando RPC `mi_movida_*` del contrato revisado.
3. Login con documento + código: endpoint de sesión con comprobación privilegiada, límites por identidad y por origen, y sesión Auth sin exponer códigos ni tokens administrativos.
4. Recuperación por correo previamente verificado; URLs y CORS correctos; no introducir tokens en logs.
5. Moodle solo desde Edge con token secreto, validación del integrante por el vínculo autoritativo y manejo explícito de indisponibilidad.
6. Migración incremental revisada sobre estructura real, NO baseline local; regresión PIF y privacidad Directorio/Ranking.
7. Pruebas nativas Edge/Auth/Storage, navegador real, rollback y posterior activación por bandera. No desplegar la función de review sobre producción ni enlazar el frontend antes de ello.

### Publicación
El objetivo **no requiere contratar Render, Cloudflare ni otro servidor**. La compatibilidad de los límites del plan de Supabase y las reglas de autenticación deben comprobarse. El servidor Node anterior permanece como referencia funcional hasta que Edge supere las mismas pruebas.

## Primeras lecturas Edge preparadas

La función ahora implementa consultas exclusivamente de lectura de perfil, insignias y certificados Desarrolla **solo si** `MM_ENABLE_MEMBER_READS=true`, una sesión JWT válida y las RPC existentes autorizan al titular mediante RLS. El interruptor está apagado por defecto. No copia información a otro sistema ni expone `service_role`.

La interfaz existente todavía usa `/api/*` en el mismo origen y **no debe apuntarse directamente a esta función**: los mecanismos de sesión son diferentes. Faltan el login de dos campos portado y el adaptador de transporte del navegador; también el resto de rutas académicas y de XP.
