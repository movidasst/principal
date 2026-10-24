# Programa de seguridad de la información — La Movida de SST+
**Versión:** 2026-10-24 · **Marco de referencia:** ISO/IEC 27000:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022.

> Documento operativo de referencia, sin declaración de certificación ni garantía de cumplimiento integral. Este programa excluye la administración de grupos de mensajería, conforme al alcance solicitado.

## Alcance
Ecosistema de páginas y aplicaciones `movidasst.com`, Registro, Directorio, Academia/Estudia, Inscripciones, PARTICIPA, Biblioteca, PSST y las funciones y bases de datos asociadas.

## Inventario de activos y clasificación preliminar
| Activo | Información que procesa | Clasificación recomendada | Responsable funcional por designar |
|---|---|---|---|
| Registro / Supabase | Documento, nombre, foto, correo, teléfonos, código de integrante | Restringida | Administración de integrantes |
| Directorio | Perfil profesional, imagen, preferencias de publicación | Mixta (datos públicos configurables y privados) | Administración del directorio |
| Academia / Moodle | Matrícula, tareas, calificaciones, certificados, registros académicos | Restringida | Administración de Academia |
| PARTICIPA | Identidad del integrante, respuestas, puntos, tokens de sesión | Restringida | Administración de participación |
| Biblioteca / Drive | Catálogo técnico, archivos y accesos | Mixta según permisos | Administración de biblioteca |
| Aplicación PSST y otras herramientas IA | Documentos introducidos voluntariamente en servicios externos | Potencialmente confidencial | Responsable de cada aplicación |
| GitHub, Supabase y cuentas de proveedores | Código, configuración, credenciales administrativas, respaldos | Confidencial / crítica | Responsable técnico |
| Sitio público y material educativo | Contenidos publicados | Público | Responsable editorial |

No se debe publicar inventario detallado de claves, direcciones de infraestructura interna o rutas de respaldo.

## Control de acceso
1. Mantener cuentas personales para personal administrativo, con mínimos privilegios y autenticación multifactor cuando el proveedor lo admita.
2. Revisar altas, cambios y bajas de permisos ante cambio de responsabilidades.
3. No usar el código de integrante de cinco caracteres como sustituto de una autenticación administrativa reforzada.
4. Mantener segregados los servicios públicos, las consultas de integrantes y las operaciones administrativas privilegiadas.
5. Revisar expresamente funciones `SECURITY DEFINER` y validar su control interno antes de retirar o conceder permisos.

## Conservación y eliminación
- Recoger solo los datos necesarios para el servicio informado.
- Documentar para cada tipo de dato el objetivo, los usuarios autorizados, la ubicación, el plazo de conservación y el método de eliminación; no afirmar un periodo fijo hasta verificar obligaciones legales y operativas.
- Permitir solicitudes de acceso, rectificación y eliminación cuando correspondan, previa verificación razonable de identidad.
- Evitar copias de documentos personales en reportes abiertos, capturas, registros de depuración o repositorios.
- Si el servicio usa proveedores externos, revisar sus condiciones de tratamiento, conservación y transferencias internacionales.

## Copias de seguridad y recuperación
**Pendiente de verificación administrativa.** No consta en este diagnóstico una prueba de restauración de Supabase, Moodle o Google Drive.

Para cada servicio registrar:
- responsable de la copia y permisos de acceso;
- ubicación separada del entorno de producción;
- frecuencia configurada realmente y retención;
- cifrado y protección de accesos;
- fecha de última prueba de restauración;
- objetivos aprobados de recuperación (RPO y RTO).

Una captura de configuración o la existencia de un archivo no sustituyen una prueba real de restauración.

## Procedimiento de gestión de incidentes
**Canal de reporte:** info@movidasst.com.

1. **Recepción:** registrar fecha, reportante, activo afectado, síntomas y posible impacto sin almacenar contraseñas ni códigos.
2. **Clasificación:** valorar confidencialidad, integridad y disponibilidad; distinguir incidente confirmado de aviso o sospecha.
3. **Contención:** limitar el daño; aprobar cambios que alteren accesos, tráfico o funciones productivas.
4. **Investigación:** conservar pruebas mínimas y autorizadas, revisar registros y determinar alcance.
5. **Recuperación:** restaurar servicio, verificar operaciones importantes y registrar resultado.
6. **Cierre:** acciones correctivas, responsable y evaluación de avisos a personas afectadas y autoridades cuando proceda.

## Seguimiento y verificación
| Control | Situación a 2026-10-24 |
|---|---|
| Aviso de privacidad actualizado en Registro | Implementado en GitHub |
| Enlace al aviso desde HUB y PARTICIPA | Implementado en GitHub |
| Confirmación antes de enviar documentos PSST a Gemini | Implementado en GitHub |
| Tokens de PARTICIPA en almacenamiento de pestaña | Implementado en GitHub |
| 16 vistas con `security_invoker = true` | Verificado en Supabase |
| Rutas de búsqueda fijadas en cuatro funciones generales | Verificado en Supabase |
| Ejecución externa de dos funciones exclusivas de trigger restringida | Verificado en Supabase |
| Auditoría individual de todas las RPC privilegiadas restantes | Pendiente: retirar permisos masivamente puede romper servicios |
| Protección de Supabase Auth contra contraseñas filtradas | Pendiente de configuración en dashboard y elegibilidad de plan |
| Política de recuperación, copias y pruebas de restauración | Pendiente de ejecución por los administradores |
| Revisión integral de Moodle y cuentas administrativas | Pendiente de acceso administrativo y pruebas |
| Rediseño de credencial de 5 caracteres con compatibilidad de sistemas | Pendiente de proyecto de migración y pruebas |
| Revisión de la publicación efectiva en dominios personalizados | Pendiente de confirmar propagación y despliegue |

**Advertencia:** las tablas con RLS activo y sin políticas pueden estar cerradas intencionalmente; no crear políticas abiertas automáticamente.

## Revisión del programa
Revisar el inventario, nuevos riesgos y permisos cuando se incorporen servicios o funciones importantes y de manera periódica. Documentar incidentes reales, causas y acciones para mejorar el programa.
