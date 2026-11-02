import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcademia, AcademiaError } from '../server/academia.mjs';

const functions = [
 'core_enrol_get_users_courses', 'core_completion_get_course_completion_status',
 'core_completion_get_activities_completion_status', 'gradereport_user_get_grade_items',
 'mod_customcert_list_issues',
];
const clock = () => new Date('2026-11-01T23:00:00Z');
const ownIssue = (id = 81, userId = 42) => ({
 issue: { id, customcertid: 9, code: 'CERT-code_42', timecreated: 1790000000 },
 user: { id: userId, email: 'private@example.invalid', fullname: 'Private name', username: 'private' },
 template: { id: 12, name: 'Prevención <b>emitida</b>' },
 pdf: { haspdf: false, name: null, content: null },
});
function fixture(overrides = {}) {
 const requests = [];
 const handlers = {
  core_webservice_get_site_info: () => ({ functions: functions.map(name => ({ name })) }),
  core_enrol_get_users_courses: () => [{ id: 7, fullname: '<b>Prevención</b>', startdate: 1780000000 }],
  core_completion_get_course_completion_status: () => ({ completionstatus: { completed: false, completions: [] } }),
  core_completion_get_activities_completion_status: () => ({ statuses: [{ state: 2 }, { state: 0 }] }),
  gradereport_user_get_grade_items: () => ({ usergrades: [{
   userid: 42,
   gradeitems: [{ itemtype: 'course', graderaw: 75, grademin: 0, grademax: 100, gradeishidden: false }],
  }] }),
  mod_customcert_list_issues: () => [ownIssue()],
  ...overrides,
 };
 const fetchImpl = async (url, options) => {
  const body = new URLSearchParams(options.body);
  requests.push({ url, options, body });
  const fn = handlers[body.get('wsfunction')];
  if (!fn) throw Error('Unexpected function');
  const result = await fn(body);
  return { ok: true, json: async () => result };
 };
 const api = createAcademia({ baseUrl: 'https://academia.example.invalid/moodle', token: 'server-token-123', fetchImpl, now: clock });
 return { api, requests };
}

test('reads enrollments, course completion and own grade; transport never puts token in URL', async () => {
 const { api, requests } = fixture();
 const data = await api.getLearning('42');
 assert.equal(data.status, 'available');
 assert.equal(data.courses[0].title, 'Prevención');
 assert.equal(data.courses[0].progress, 50);
 assert.equal(data.courses[0].grade.raw, 75);
 assert.equal(data.courses[0].grade.percentage, 75);
 assert.equal(data.courses[0].completion_status, 'in_progress');
 assert.equal(data.courses[0].certificate_status, 'not_checked');
 assert.equal(data.courses[0].url, 'https://academia.example.invalid/moodle/course/view.php?id=7');
 for (const request of requests) {
  assert.equal(request.url, 'https://academia.example.invalid/moodle/webservice/rest/server.php');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.redirect, 'error');
  assert.equal(request.body.get('wstoken'), 'server-token-123');
 }
 assert.ok(requests.filter(r => r.body.has('userid')).every(r => r.body.get('userid') === '42'));
 assert.ok(!JSON.stringify(data).includes('server-token'));
});

test('course completion does not fabricate certificate issuance', async () => {
 const { api } = fixture({ core_completion_get_course_completion_status: () => ({ completionstatus: { completed: true, completions: [{ complete: true, timecompleted: 1790000000 }] } }) });
 const result = await api.getLearning(42);
 assert.equal(result.courses[0].completion_status, 'completed');
 assert.equal(result.courses[0].certificate_status, 'completion_only');
 assert.equal(result.courses[0].completed_at, new Date(1790000000000).toISOString());
 assert.ok(!('certificate_url' in result.courses[0]));
});

test('upstream outage is unavailable, not an empty enrollment history', async () => {
 const { api } = fixture({ core_enrol_get_users_courses: () => { throw Error('URL?token=do-not-leak'); } });
 await assert.rejects(api.getLearning(42), error => error instanceof AcademiaError && error.code === 'moodle_unavailable' && !error.message.includes('do-not-leak'));
});

test('partial field failure does not claim zero progress or failed course', async () => {
 const { api } = fixture({ core_completion_get_activities_completion_status: () => ({ exception: 'moodle_exception', errorcode: 'unsupported', message: 'internal-secret' }) });
 const result = await api.getLearning(42);
 assert.equal(result.status, 'partial');
 assert.equal(result.courses[0].progress, null);
 assert.equal(result.courses[0].grade.raw, 75);
 assert.equal(result.courses[0].errors[0].code, 'moodle_source_error');
 assert.ok(!JSON.stringify(result).includes('internal-secret'));
});

test('hidden grade stays hidden even when read token can see its raw grade', async () => {
 const { api } = fixture({ gradereport_user_get_grade_items: () => ({ usergrades: [{ userid: 42, gradeitems: [{ itemtype: 'course', graderaw: 92, grademin: 0, grademax: 100, gradeishidden: true }] }] }) });
 const result = await api.getLearning(42);
 assert.equal(result.courses[0].grade.raw, null);
 assert.equal(result.courses[0].grade.status, 'hidden');
});

test('grade for another student is not returned', async () => {
 const { api } = fixture({ gradereport_user_get_grade_items: () => ({ usergrades: [{ userid: 999, gradeitems: [{ itemtype: 'course', graderaw: 99 }] }] }) });
 const result = await api.getLearning(42);
 assert.equal(result.courses[0].grade.raw, null);
 assert.deepEqual(result.courses[0].errors, [{ field: 'grade', code: 'moodle_owner_mismatch' }]);
});

test('activity failure does not count as approval, and no grade item fallback fabricates course grade', async () => {
 const { api } = fixture({
  core_completion_get_activities_completion_status: () => ({ statuses: [{ state: 3 }] }),
  gradereport_user_get_grade_items: () => ({ usergrades: [{ userid: 42, gradeitems: [{ itemtype: 'mod', graderaw: 100 }] }] }),
 });
 const result = await api.getLearning(42);
 assert.equal(result.courses[0].progress, 100);
 assert.equal(result.courses[0].completion_status, 'in_progress');
 assert.equal(result.courses[0].grade.raw, null);
});

test('missing certificate service is explicit unsupported and no guessed function is called', async () => {
 const { api, requests } = fixture({ core_webservice_get_site_info: () => ({ functions: functions.filter(name => !name.includes('customcert')).map(name => ({ name })) }) });
 const result = await api.getCertificates(42);
 assert.equal(result.status, 'unsupported');
 assert.equal(result.reason, 'certificate_provider_not_enabled');
 assert.deepEqual(result.certificates, []);
 assert.equal(requests.length, 1);
});

test('certificate listing is owner filtered, strips PII, and contains actual issue metadata', async () => {
 const { api, requests } = fixture();
 const result = await api.getCertificates(42);
 assert.equal(result.status, 'available');
 assert.equal(result.certificates[0].status, 'issued');
 assert.equal(result.certificates[0].title, 'Prevención emitida');
 assert.equal(result.certificates[0].validity, 'source_record_exists');
 assert.match(result.certificates[0].verification_url, /mod\/customcert\/verify_certificate.php\?code=CERT-code_42$/);
 assert.ok(!JSON.stringify(result).includes('private@example'));
 assert.ok(!JSON.stringify(result).includes('Private name'));
 const request = requests.find(r => r.body.get('wsfunction') === 'mod_customcert_list_issues');
 assert.equal(request.body.get('userid'), '42');
 assert.equal(request.body.get('includepdf'), '0');
});

test('unexpected certificate owner fails closed without returning mixed students', async () => {
 const { api } = fixture({ mod_customcert_list_issues: () => [ownIssue(), ownIssue(82, 999)] });
 await assert.rejects(api.getCertificates(42), { code: 'moodle_owner_mismatch' });
});

test('metadata pagination is bounded and exposes next offset only with an extra record', async () => {
 const { api, requests } = fixture({ mod_customcert_list_issues: () => [ownIssue(81), ownIssue(82), ownIssue(83)] });
 const result = await api.getCertificates(42, { limit: 2, offset: 4 });
 assert.equal(result.certificates.length, 2);
 assert.equal(result.next_offset, 6);
 assert.equal(requests.at(-1).body.get('limit'), '3');
 await assert.rejects(api.getCertificates(42, { limit: 501 }), { code: 'invalid_pagination' });
});

test('PDF download rechecks issue ownership, uses server metadata and validates PDF', async () => {
 const { api, requests } = fixture({
  mod_customcert_list_issues: body => {
   const row = ownIssue();
   if (body.get('includepdf') === '1') row.pdf = { haspdf: true, content: Buffer.from('%PDF-1.7\nsample\n%%EOF').toString('base64'), name: '../../unsafe.html' };
   return [row];
  },
 });
 const result = await api.downloadCertificate(42, 81);
 assert.equal(result.filename, 'certificado-moodle-81.pdf');
 assert.equal(result.content_type, 'application/pdf');
 assert.ok(result.content.toString().startsWith('%PDF-'));
 const pdfRequest = requests.at(-1).body;
 assert.equal(pdfRequest.get('userid'), '42');
 assert.equal(pdfRequest.get('customcertid'), '9');
 assert.equal(pdfRequest.get('includepdf'), '1');
});

test('removed/unissued certificate is not downloadable and no PDF generation is requested', async () => {
 const { api, requests } = fixture({ mod_customcert_list_issues: () => [] });
 await assert.rejects(api.downloadCertificate(42, 81), { code: 'certificate_not_found', status: 404 });
 assert.ok(!requests.some(r => r.body.get('includepdf') === '1'));
});

test('another student response on PDF pass is rejected', async () => {
 const { api } = fixture({ mod_customcert_list_issues: body => [ownIssue(81, body.get('includepdf') === '1' ? 999 : 42)] });
 await assert.rejects(api.downloadCertificate(42, 81), { code: 'moodle_owner_mismatch' });
});

test('malformed PDF is rejected instead of returning HTML or active content', async () => {
 const { api } = fixture({ mod_customcert_list_issues: () => [{ ...ownIssue(), pdf: { haspdf: true, content: Buffer.from('<html>not a pdf</html>').toString('base64') } }] });
 await assert.rejects(api.downloadCertificate(42, 81), { code: 'certificate_pdf_unavailable' });
});

test('identity and configuration validation happens before a network call', async () => {
 const { api, requests } = fixture();
 await assert.rejects(api.getLearning(null), { code: 'invalid_moodle_identity' });
 await assert.rejects(api.getLearning('9007199254740992'), { code: 'invalid_moodle_identity' });
 assert.equal(requests.length, 0);
 for (const baseUrl of ['http://production.invalid', 'https://token@host.invalid', 'https://host.invalid?token=foo']) {
  assert.throws(() => createAcademia({ baseUrl, token: 'server-secret' }), { code: 'invalid_moodle_configuration' });
 }
});
