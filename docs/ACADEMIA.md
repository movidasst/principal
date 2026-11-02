# Integración privada de Academia Moodle

Implementación: application/server/academia.mjs.
Pruebas: application/tests/academia.test.mjs.
Estado: adaptador funcional con transporte real y pruebas de contrato aisladas. No desplegado; no se han usado credenciales ni consultado expedientes académicos reales.

## Autoridad e identidad
La aplicación llama Moodle desde el servidor. El controlador de Mi Movida debe validar sesión y consultar el vínculo de integrantes para obtener moodle_user_id. Nunca debe utilizar un Moodle user ID o URL de descarga enviados por el cliente como autorización.

El adaptador no crea cuentas, matrículas, notas ni certificados. No llama servicios de administración, reconciliación o cambios de contraseña. La lista de cursos se obtiene del usuario resuelto; los detalles se consultan exclusivamente para los cursos de esa lista. Cada resultado de notas y cada emisión de certificado verifica nuevamente la identidad devuelta por Moodle. Un resultado de otro alumno produce error cerrado.

## Contrato del módulo
~~~js
import { createAcademia, AcademiaError } from './academia.mjs';

const academia = createAcademia({
  baseUrl: process.env.MOODLE_BASE_URL,
  token: process.env.MOODLE_LECTURA_TOKEN,
});
const learning = await academia.getLearning(serverResolvedMoodleUserId);
const certificates = await academia.getCertificates(serverResolvedMoodleUserId, {offset: 0, limit: 50});
const pdf = await academia.downloadCertificate(serverResolvedMoodleUserId, requestedIssueId);
~~~

El token debe pertenecer a un servicio de lectura delimitado. No se selecciona automáticamente MOODLE_TOKEN administrativo como fallback. La configuración debe proporcionarla el servidor; nada de ella llega al navegador. No pasar objetos de request a createAcademia.

getLearning devuelve source, status, as_of, total, truncated y courses. Cada curso incluye id, title, URL canónica sin token, fechas, enrollment_status, completion_status, completed_at, progress, grade, certificate_status y errores por campo. enrollment_status=enrolled significa “devuelto por la consulta de matrícula de Moodle”; no certifica que una cuenta esté activa ni que todos los permisos del curso estén abiertos. Los detalles parciales se marcan como partial; una indisponibilidad de Moodle nunca se interpreta como cero matrículas, cero avance o curso reprobado.

getCertificates devuelve status=unsupported cuando la instalación o el servicio no expone el proveedor verificado. No hay una lista vacía que finja que el alumno carece de certificados. Con proveedor disponible, devuelve únicamente registros emitidos de la fuente, su código y fecha y una URL de verificación canónica. La URL puede requerir permisos de Moodle: no se afirma que sea públicamente verificable sin comprobar su configuración verifyany/verifyallcertificates.

downloadCertificate vuelve a buscar una emisión de ese alumno y solicita su PDF por customcertid resuelto en servidor. Si la emisión desapareció, falla con certificate_not_found. El resultado contiene Buffer content, content_type, filename y metadata. El controlador debe responder con Content-Disposition: attachment y Cache-Control: no-store, nunca con un enlace Moodle que incorpore wstoken.

## API de Moodle contrastada con código fuente
Antes de consultar datos se descubre la lista real habilitada en core_webservice_get_site_info; se conserva únicamente durante 60 segundos en memoria del servidor.

Funciones de lectura:
- core_enrol_get_users_courses(userid,returnusercount).
- core_completion_get_course_completion_status(courseid,userid).
- core_completion_get_activities_completion_status(courseid,userid).
- gradereport_user_get_grade_items(courseid,userid).
- mod_customcert_list_issues(userid,customcertid,includepdf,limit,offset), cuando figure en el servicio externo.

La integración de cursos reproduce los contratos observados en [Gestión de SST+](https://github.com/movidasst/gestion/blob/main/supabase/functions/moodle-admin/index.ts), pero no expone el endpoint administrativo de Gestión al alumno.

El contrato de Custom Certificate se comprobó directamente en la rama oficial MOODLE_500_STABLE: [db/services.php](https://github.com/mdjnelson/moodle-mod_customcert/blob/MOODLE_500_STABLE/db/services.php), [classes/external.php](https://github.com/mdjnelson/moodle-mod_customcert/blob/MOODLE_500_STABLE/classes/external.php) y [verify_certificate.php](https://github.com/mdjnelson/moodle-mod_customcert/blob/MOODLE_500_STABLE/verify_certificate.php). La respuesta contiene issue, user, template y pdf. No se dedujo un endpoint a partir del nombre del plugin.

El servicio list_issues exige mod/customcert:viewallcertificates en el servidor. Su token tiene por ello privilegios amplios en Moodle: mantenerlo exclusivamente en servidor, con filtros obligatorios por userid y comprobación del dueño de cada fila. No devolver fullname, email o username incluidos por la fuente cuando no son necesarios.

## Emisión, vigencia y finalización
- Curso completado: completion_status=completed, certificate_status=completion_only; no inventa descarga ni diploma.
- Certificado emitido: requiere un registro en customcert_issues devuelto por la API de la fuente.
- Registro ausente: descarga denegada, sin volver a emitir.
- La API list_issues inspeccionada no ofrece estado explícito de revocación/expiración; validity=source_record_exists informa exactamente lo comprobado. No equivale a “vigente para siempre”.
- El enlace de verificación de Moodle es la fuente para política de verificación y validez; si la institución usa otro plugin, se debe implementar y probar su contrato antes de habilitarlo. No se cambia de proveedor de manera automática.
- El PDF se genera desde una emisión ya existente mediante la función de lectura oficial. No se invoca el generador como método para obtener una nueva emisión.

## Seguridad y operación
- HTTPS obligatorio excepto loopback de prueba; URL base sin userinfo, query ni fragmento.
- REST siempre POST con wstoken en body; no token en URL, logs ni respuesta.
- Sin redirects, para evitar reenviar el secreto a otro origen.
- Tiempo máximo por llamada, concurrencia limitada a cuatro cursos y máximo cien cursos por respuesta; si se trunca, se informa.
- No caché compartida de alumnos; solo catálogo de funciones disponible.
- Nota oculta permanece oculta aun con token de lectura amplio. No se usa el primer gradeitem como sustituto de una nota global ausente.
- Se sanitizan títulos HTML a texto; el frontend debe seguir escapándolos.
- Errores upstream no se propagan: pueden contener datos privados o tokens.
- PDF validado por tamaño y cabecera; nombre de descarga generado por el servidor y ajeno al nombre upstream.

## Pruebas ejecutadas
Comando: node --test application/tests/academia.test.mjs.
Resultado: 16 pruebas aprobadas.

Cubre contrato de matrícula/notas/avance, transporte sin token en URL, curso completado sin certificado, caída de Moodle, fallo parcial, nota oculta, respuesta de otro alumno, actividad completada-fallida sin aprobar el curso, proveedor ausente, metadatos y paginación de emisiones, lectura/descarga de PDF propio, retirada de emisión, respuesta de dueño diferente en segunda lectura, PDF inválido y validación previa a red.

Son pruebas de integración del adaptador con transporte simulado, no evidencia de comunicación con el LMS de producción. Para certificar integración real faltan credenciales del servicio privado en staging, confirmar funciones habilitadas/plugin y verificar alumnos sintéticos propios/ajenos contra ese entorno.

## Despliegue y reversión
1. Configurar únicamente en staging el URL y token de lectura; revisar funciones y capacidades del servicio.
2. Vincular alumnos sintéticos existentes en integrantes; no aprovisionar duplicados para probar.
3. Probar matrícula propia, ajena, curso sin notas, nota oculta, fuente caída, certificado emitido/retirado y una configuración sin proveedor.
4. Habilitar rutas del alumno con flag y acceso autenticado. No cambiar interfaces privadas originales de Academia/Gestión.
5. Producción requiere autorización y prueba de contrato real. Este trabajo no despliega servicios ni cambia configuración del LMS.
6. Revertir desactivando la integración del portal y manteniendo acceso directo a Moodle; no retirar matrículas, notas o emisiones y no restaurar toda la base.

No se ha confirmado todavía que movidasst.org tenga instalado/expuesto mod_customcert_list_issues. El adaptador comunica ese caso de forma explícita en vez de declarar la funcionalidad completa sin evidencia.
