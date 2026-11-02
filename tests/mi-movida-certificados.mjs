import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../mi-movida/app.js', import.meta.url),'utf8');
assert.ok(app.includes('https://movidasst.org/admin/tool/certificate/my.php'),'La lista oficial de certificados Moodle debe ser accesible');
assert.ok(app.includes("d.moodle_status==='unsupported'"),'La consulta Moodle no autorizada debe mostrarse como no disponible');
assert.ok(app.includes('Certificados de la Academia Moodle')&&app.includes('Certificados de la ruta Desarrolla'),'No mezclar emisores de certificados');
assert.ok(!app.includes('tool_certificate/issue_certificate'),'Mi Movida no debe emitir certificados');
console.log('Certificados: enlace oficial conservado, emisión sin duplicar.');
