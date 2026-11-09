# Biblioteca SST — SEO Fase 2
Revisión editorial inicial: 8 de noviembre de 2026.

## Objetivo
Crear páginas HTML públicas, informativas e indexables para búsquedas sobre legislación, normas y reglamentos técnicos de Seguridad y Salud en el Trabajo de Venezuela.

## Arquitectura y URL canónicas
- `/biblioteca/` — portada y navegación.
- `/biblioteca/lopcymat/` — ley orgánica y aplicación preventiva.
- `/biblioteca/nt-04-2023/` — programa SST, planes del artículo 17.
- `/biblioteca/normas-covenin/` — orientación sobre COVENIN.
- `/biblioteca/reglamentos-tecnicos/` — índice público de reglamentos técnicos.
- `/biblioteca/reglamentos-tecnicos/calzado-seguridad/` — Resolución N.º 151/2024 y COVENIN 39:2023.

Archivos `index.html` estáticos en cada directorio: publicación en GitHub Pages sin necesidad de backend, autenticación ni ejecutar JavaScript para leer el contenido.

## Acceso
Toda la biblioteca es pública y gratuita, sin requerir cédula, registro, códigos, autenticación o matrícula.
Cada guía normativa tiene tres botones:
- Registro opcional: https://registro.movidasst.com/
- Canal oficial: https://whatsapp.com/channel/0029Va0mlH5Jf05mrcCz8r3e
- Volver a la página principal: /

## Identidad y usabilidad
- Logo original: `/logo-horizontal-movida-sst-plus.webp`; se reutiliza el archivo existente, no se crea un reemplazo.
- Inter, paleta pastel, `#007b85` como principal, fondo blanco `#f8fafc`, móvil primero.
- Sin dependencias JS, con navegación por teclado, skip link, rutas de navegación y tabla de contenidos.
- Los enlaces a aplicaciones existentes siguen iguales; sin cambios de autenticación ni integraciones.

## SEO
- Metadatos title/description independientes, canonical absolutos, Open Graph y JSON-LD.
- Article/CollectionPage y BreadcrumbList; indicación `isAccessibleForFree: true`.
- Entradas en `sitemap.xml` solo para URLs que existen y son públicas.
- Enlace directo desde la página principal y desde Explorar.
- CSS único `biblioteca/biblioteca.css` para mantener el diseño aislado.
- Pruebas SEO extendidas; el workflow corre cuando cambia `biblioteca/**`.

## Fuentes consultadas para los materiales
- LOPCYMAT: G.O. 38.236 (26-07-2005), copia en PreventionWeb.
- NT-04:2023: G.O. 42.712 (12-09-2023), Resolución N.º 648; artículo 17 y contenido general contrastados con copia documental.
- Regl. Técnico Calzado de Seguridad y Protección: Resolución N.º 151/2024, G.O. 43.029 (16-12-2024). Referencia cruzada con norma COVENIN 39:2023.
- COVENIN: verificar cada edición y su exigibilidad ante SENCAMER y Gaceta.
En cada artículo se enlazan las referencias y se advierte que las explicaciones no sustituyen el texto íntegro ni la interpretación de la autoridad.

## Comprobaciones tras desplegar
1. Verificar HTTP 200 en las seis URLs nuevas y la carga de la hoja de estilos.
2. Verificar redireccionamiento de URLs del directorio al `index.html` correspondiente sin duplicados.
3. Abrir las seis URLs sin sesión, en incógnito y con JS deshabilitado.
4. Comprobar vista móvil a 320px, 360px, 390px, tableta y escritorio.
5. Revisar Core Web Vitals y Search Console, validar URLs y reenviar sitemap.
6. Revisar periódicamente vigencia de normas, enlaces externos y fecha de actualización editorial.
7. No interpretar indexación como garantía de posicionamiento ni simular tráfico.

## Exclusiones
No se tocó `hub.js`, Supabase, Moodle, datos de perfiles, reglas de ingreso, PWA o API de otras aplicaciones. No se modifica la visibilidad de las áreas privadas ya existentes.

## Enlace con Biblioteca colaborativa de Google Drive
- Sitio de la biblioteca colaborativa existente: https://drive.movidasst.com/
- Repositorio independiente: movidasst/drive. Este PR **no altera** sus reglas de sesión ni de autorización.
- Se añadió enlace directo desde la portada del HUB y la cabecera, los botones y el pie de las seis páginas de Biblioteca SST.
- Las seis guías HTML siguen públicas y no piden credenciales. El explorador Drive **sigue requiriendo cédula y código de credencial** por ahora. Una eventual apertura de archivos de Drive requeriría auditar permisos, datos personales, documentos y derechos de distribución antes de realizar cambios.
- El enlace no importa documentos al sitio, no duplica contenido y no añade archivos de Drive al sitemap.
