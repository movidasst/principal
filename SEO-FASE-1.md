# Fase 1 de SEO — Auditoría y correcciones técnicas
Fecha de revisión del código: 8 de noviembre de 2026.

## Alcance seguro

Este cambio solo altera metadatos públicos y el sitemap. No se modifican
JavaScript de la aplicación, datos, configuración de Supabase, Moodle,
la autenticación, la PWA, lógica de registro ni el diseño visual.

### Cambios
- Portada: título y descripción centrados en el tema "Seguridad y Salud en el Trabajo (SST)", manteniendo la identidad de La Movida. Nombre de WebPage y fecha de modificación del JSON-LD armonizados.
- Catálogo `explorar.html`: título y descripción más precisos, sin cambiar su catálogo ni sus enlaces.
- `sitemap.xml`: únicamente portada, `explorar.html` y `seguridad.html`; se eliminan `changefreq` y `priority`, ignorados por Google. `lastmod` se especifica solo cuando se revisó una página significativamente en esta fase.
- `mi-movida/index.html`: `noindex,follow` para evitar que la pantalla privada de acceso aparezca como resultado de búsqueda. Esto NO sustituye ni cambia la protección de los datos.
- `offline.html`: `noindex,follow` para evitar indexar una pantalla de contingencia.
- `diagnostico-ga4.html`: conserva su `noindex,nofollow` previo.
- `robots.txt`: se mantiene igual, porque ya permite el rastreo y referencia el sitemap correcto.

### Validación automatizada
Ejecutar `node --test tests/seo-static.test.mjs`.
GitHub Actions verificará el sitemap, las URLs canónicas, títulos y descripciones,
el marcado `noindex` y el JSON-LD en cada cambio relevante.

## Pendientes de validación operativa (no son resultados ya verificados)

- Confirmar publicación de esta rama después del merge y accesibilidad HTTP 200 de las tres URLs del sitemap.
- Confirmar que `https://movidasst.com/` redirige de modo permanente a `https://www.movidasst.com/`.
- En Google Search Console, verificar propiedad de dominio, enviar `https://www.movidasst.com/sitemap.xml`, inspeccionar las tres URL y solicitar nueva indexación cuando corresponda.
- Verificar renderizado del catálogo por Googlebot. Una página con contenido dinámico requiere prueba con inspección de URL; estar en sitemap no basta para posicionarse.
- Ejecutar PageSpeed Insights/Lighthouse móvil y medir LCP, CLS e INP. No se atribuye puntuación sin medición.
- Comprobar enlaces internos rotos y documentar su destino correcto antes de cambiarlos (en `explorar.html` hay referencias heredadas a `grupos.movidasst.com`).
- No añadir otras páginas de aplicaciones privadas ni URLs en otros subdominios al sitemap de `www.movidasst.com` sin evaluar su indexabilidad, canonical y accesibilidad.

## Fase 2 prevista
Biblioteca SST con URLs públicas, contenido técnico de calidad y HTML rastreable.
No se crean rutas futuras ni páginas vacías en el sitemap antes de publicarlas.
