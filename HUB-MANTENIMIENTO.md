# HUB de La Movida de SST+ — Guía de mantenimiento

Actualizado: 18 de octubre de 2026 · Responsable editorial: La Movida de SST+

## Arquitectura

- `index.html`: portada pública, enlaces esenciales, navegación, SEO y accesibilidad.
- `hub.css`: diseño responsive sin Tailwind en tiempo de ejecución, barra móvil, botones y tarjetas.
- `hub.js`: iconos SVG locales, catálogo, filtros, búsqueda por necesidad, favoritos por dispositivo y donaciones bajo demanda.
- `ecosistema.json`: **fuente editorial del inventario de la portada**. Cada elemento tiene `id`, `title`, `category`, `group`, `description`, `url`, `keywords`, `status`, `featured`, `icon`.
- `site.webmanifest`: metadatos de la experiencia instalable del sitio.

## Alta y modificación de herramientas

1. Verificar que el sitio de destino funciona, que su contenido es público y que el propósito está descrito con precisión.
2. Añadir/editar una entrada en `ecosistema.json` sin duplicar el `id`. El catálogo **no lee automáticamente todos los repositorios** para impedir que herramientas internas se anuncien como públicas.
3. Usar `status=disponible` solo si hay confirmación de acceso; `experimental` muestra “En prueba”; `acceso` muestra “Acceso privado”.
4. Completar `keywords` con sinónimos que utilizaría un profesional (p. ej., exposición, ruido, decibelios). No almacenar datos personales ni credenciales.
5. Cuando se publique una nueva versión, actualizar `?v=AAAAMMDD` de las referencias a `hub.css`, `hub.js` y `ecosistema.json`, si es necesario invalidar caché.

## Verificaciones de publicación

- Verificar carga de `/`, `/hub.css`, `/hub.js`, `/ecosistema.json` y `/site.webmanifest` mediante HTTP real.
- Comprobar búsqueda por **ruido**, **contratistas**, **accidentes** e **ISO**; categorías y “Ver más”.
- Probar a 320, 360, 390, 768, 1024 y 1440 píxeles; revisar que la barra inferior de cinco iconos no tape contenido.
- Confirmar favoritos, menús, navegación por teclado, estados de foco y preferencia `prefers-reduced-motion`.
- Confirmar que Registro, Directorio, Estudia, Academia, MovidaLab HO y todas las herramientas prioritarias abren el destino correcto.
- Probar con JavaScript deshabilitado: deben seguir accesibles los destinos esenciales (aunque no habrá búsqueda dinámica).
- Comprobar que el modal de donaciones únicamente carga el SDK de PayPal cuando la persona lo abre.
- Ejecutar Lighthouse en un dispositivo móvil real y seguir los indicadores LCP, INP y CLS. No se establece ninguna puntuación hasta efectuar las mediciones.

## Límites importantes

- **Portal principal** y **Aplicaciones SST** son hoy catálogos distintos: el nuevo JSON gobierna la portada, mientras que Aplicaciones SST sigue obteniendo sus entradas del RPC de Supabase `catalogo_aplicaciones_publico`. No se modificó su gestión administrativa ni se eliminaron las reglas existentes.
- “Mi Movida” agrupa accesos a plataformas existentes. No supone una cuenta unificada nueva ni permite ver datos privados sin las autenticaciones de origen.
- Los simuladores son recursos educativos, no instrumentos de medición real.
- La disponibilidad editorial no equivale a una prueba automatizada de todos los destinos.
- Los cambios del sitio principal se gestionan en el repositorio `movidasst/principal`; no se han alterado repositorios de apps ni bases de datos externas.

## Navegación interna del HUB (corrección 18-oct-2026)

La barra inferior del móvil y el menú superior del escritorio son **pestañas internas**, no accesos directos a plataformas externas ni enlaces que desplazan a otra altura de la misma página.

- Las pestañas usan botones `data-hub-tab` y se corresponden con los paneles `data-hub-view`: `inicio`, `explorar`, `aprender`, `comunidad`, `mi-movida` y `empresas`.
- Un panel está visible por vez. `hub.js` activa el nuevo panel, sincroniza botones superiores e inferiores, y actualiza `?vista=...` sin recargar para conservar historial del navegador.
- Los enlaces externos están **dentro de los paneles**, como botones explícitos para abrir la aplicación en otra pestaña.
- El Directorio tiene un bloque destacado dentro de Comunidad y su acceso en Mi Movida. Las acciones rápidas de la portada conducen a pestañas internas.
- `explorar.html` sigue disponible como ruta independiente para compartir el catálogo, pero **no** es el destino de la pestaña Explorar en la portada.
- Después de alterar `hub.js` o `hub.css`, actualizar el parámetro de versión de los archivos en `index.html` para evitar que el usuario cargue una versión anterior desde caché.

### Pruebas específicas
En un teléfono, tocar **Explorar** no debe abrir otra pestaña ni saltar al pie de página: debe mostrar la vista de catálogo con su buscador. **Aprender** muestra opciones de Estudia, Academia, Desarrolla SST y MovidaLab HO; **Comunidad** presenta Directorio, grupos y PARTICIPA; **Mi Movida** da acceso al perfil y a las plataformas personales. Al pulsar **Abrir Directorio** sí debe abrir `directorio.movidasst.com` en una pestaña nueva. La navegación Atrás/Adelante debe restaurar las vistas internas.
