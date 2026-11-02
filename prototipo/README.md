# Mi Movida · Prototipo local

Rama: `codex/mi-movida-prototipo`. Revisión visual, sin producción.

Desde la raíz del proyecto:

```powershell
node prototipo/server.mjs
```

Abrir [Mi Movida local](http://127.0.0.1:4173). No requiere instalar paquetes. Detener con Ctrl+C cuando se ejecute en terminal. El servidor solo escucha en 127.0.0.1 y sirve esta carpeta; no usarlo como servidor productivo.

Elegir «Entrar a la demostración». Los campos de acceso son de solo lectura y no aceptan credenciales. Explorar el panel y sus nueve vistas privadas. El perfil se puede editar con datos inventados; los cambios desaparecen al recargar o cerrar sesión. La credencial SVG descargable lleva «EJEMPLO FICTICIO · SIN VALIDEZ». Certificados, recuperación y continuación de cursos muestran diálogos de revisión, sin acciones externas.

## Separación de datos

- Sin Supabase SDK, claves, tokens, variables de producción, cuentas ni endpoints de negocio.
- Sin localStorage/sessionStorage para perfil o credenciales. Datos ficticios en memoria.
- CSP bloquea conexiones a APIs, envíos de formularios y recursos externos. No hay analítica.
- Manifest y service worker solo para probar navegación standalone y caché de estáticos. El worker usa una caché propia con prefijo mi-movida-prototipo; no borra cachés de otras aplicaciones.
- No hay autenticación, autorización, certificado o ranking real implementado. Los umbrales XP son fixtures ilustrativos, no una regla de negocio desplegada.

## Archivos

`index.html`, `styles.css` y `app.js`: interfaz. `manifest.webmanifest` y `sw.js`: soporte de PWA de prueba. `server.mjs`: servidor local. `assets/`: logo, tipografía e insignias locales.

## Identidad gráfica y procedencia

Logo: movidasst/geo, logo-oficial-movida-sst-plus.png. Insignias: geo/assets/badges/negociacion.svg, comunicacion-asertiva.svg y liderazgo-preventivo.svg. Paleta del Directorio: navy #082f5b, teal #007c83, amarillo #f4b400. Tipografía Outfit, archivos públicos de Google Fonts (Outfit v15). No se crearon insignias institucionales nuevas ni se descargaron fotografías de personas.

Fuentes originales: [Directorio](https://github.com/movidasst/geo), [Outfit](https://github.com/Outfitio/Outfit-Fonts). No se alteraron los repositorios originales.

## Alcance de validación

Ver `../VALIDACION-PROTOTIPO.md`. Este prototipo permite aprobar información, jerarquía y navegación; no acredita que login/SSO, recuperación, permisos, certificados o sincronización funcionen en producción.
