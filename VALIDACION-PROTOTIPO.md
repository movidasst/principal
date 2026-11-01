# Validación de Mi Movida · 1 de noviembre de 2026

Entorno: servidor estático en 127.0.0.1:4173, navegador integrado de Codex. Solo fixtures. No hubo escritura a producción, despliegue de Edge, migración o autenticación de personas reales.

| Comprobación ejecutada | Resultado |
|---|---|
| Sintaxis Node de app.js, sw.js y server.mjs | Correcta |
| Respuesta HTTP de la portada local | 200 |
| Login visual | Entra con datos precargados de solo lectura; no pide claves reales |
| Nueve vistas privadas en escritorio de 1280 px | Navegación correcta; encabezados presentes; cero imágenes rotas |
| Navegación móvil a 320 px | Menú completo y barra inferior operativos. Se detectó y corrigió desbordamiento de insignias; nueva medición: scrollWidth 305 / viewport 320 |
| Credencial y panel a 390 × 844 px | Revisión visual realizada; contenido legible y barra inferior visible; sin desbordamiento de página |
| Perfil ficticio | Cambio de ciudad y preferencia de correo reflejado al guardar; continúa indicando demostración |
| Búsqueda del ranking por Alex | Muestra solo la fila ficticia del titular, conservando #8 |
| Filtro de movimientos Participa | 2 filas ficticias; no modifica total ni saldo |
| Ámbito Solo estudios | Fila propia: 780 XP, #8 en el conjunto ficticio; sin sumar otras fuentes |
| Insignias | Diálogo de criterio/alcance ficticio correcto |
| Certificado académico pendiente | Diálogo diferencia curso finalizado de certificado emitido |
| Recarga | Vuelve al acceso visual y reinicia los datos ficticios del perfil |
| Consola de navegador durante la revisión | Sin errores/advertencias registrados en la comprobación |

Medidas verificadas en código: sin SDK/credenciales/API de producción; sin almacenamiento persistente de perfil/credenciales; CSP connect-src none y form-action none; assets locales; service worker con lista estática, origen y caché propios; servidor vinculado solo a loopback.

Capturas guardadas en previsualizaciones/panel-escritorio.png y panel-movil.png. Se restableció el viewport de pruebas a su tamaño normal.

## Límites

No se validaron backend, SSO, RLS, emails, revocación, sincronización o certificados reales: no están implementados en el prototipo. Manifest y SW están preparados; no se certificó instalación ni funcionamiento offline en dispositivos iOS/Android. La descarga de credencial está implementada como SVG de muestra, con marca SIN VALIDEZ; no es un certificado ni un QR verificable. Falta una evaluación formal de accesibilidad y pruebas con lectores de pantalla antes de producción.

## Revisión recomendada

Abrir la demo y recorrer perfil/privacidad, credencial, filtros de puntos, insignias, actividad y aprendizaje. Revisar por separado las decisiones pendientes del plan técnico antes de conectar servicios reales. La aprobación visual no equivale a autorizar despliegue o migraciones.
