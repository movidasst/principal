# Hosting privado de Mi Movida — preparación sin despliegue

Mi Movida NO puede ejecutarse únicamente desde GitHub Pages: necesita Node para `/api/*` y sesiones HttpOnly del mismo origen.

## Imagen contenedorizada

`docker build -f Dockerfile.mi-movida -t mi-movida:review .`

La imagen no contiene secretos y no se conecta a producción durante el build. El proveedor deberá permitir HTTPS, configurar el puerto `4174` y establecer `APP_ORIGIN` exactamente igual al origen público que atiende frontend y `/api/*`.

**No iniciar con `APP_ENV=production` sin completar validaciones de staging.**

Variables de servidor (solo en gestor de secretos del host): `APP_ORIGIN`, `APP_ENV`, `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MOODLE_BASE_URL`, `MOODLE_TOKEN`, `MAIL_FROM`, `RESEND_API_KEY`. No publicarlas en GitHub ni exponerlas por JavaScript.

## Puerta de publicación

1. CI sintética aprobada y Supabase nativo validado (Auth, Storage, Edge, RLS) con datos ficticios.
2. Pruebas de Moodle y correos en servicios de ensayo.
3. Revisar compatibilidad con Directorio y privacidad pública; no declarar resueltas preferencias legacy por una nueva interfaz.
4. Prueba en origen HTTPS real con navegador, cookies seguras, CSRF, login, logout, recuperación y dispositivo móvil.
5. Confirmar equivalencia visual del logo con Moodle y preparar reversión.
6. Solo entonces autorizar el despliegue. No apuntar staging al proyecto Supabase de producción.

## Importante

El Dockerfile es una preparación de infraestructura, no evidencia de un despliegue ni de funcionamiento integral. El sitio principal contiene otros recursos que pueden requerir ajustes antes de servir íntegramente el HUB desde el contenedor. Revisar esas rutas antes de sustituir la publicación estática.
