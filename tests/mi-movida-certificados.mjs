import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../mi-movida/app.js', import.meta.url),'utf8');
assert.ok(app.includes('https://movidasst.org/admin/tool/certificate/my_certificates.php'),'La lista oficial de certificados Moodle debe ser accesible');
assert.ok(app.includes("d.moodle_status==='unsupported'"),'No se debe mostrar un falso listado vacío cuando la API no admite el emisor');
assert.ok(!app.includes('tool_certificate/issue_certificate'),'Mi Movida no debe emitir certificados');
console.log('Certificados: enlace oficial conservado, emisión sin duplicar.');
