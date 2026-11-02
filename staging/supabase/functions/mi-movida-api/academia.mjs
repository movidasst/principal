/**
 * Private, read-only Moodle student integration.
 * The caller MUST derive moodleUserId from the authenticated integrante link.
 * Never expose this factory or its service token to the browser.
 */
export class AcademiaError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.name = 'AcademiaError';
    this.code = code;
    this.status = status;
  }
}

const FN = Object.freeze({
  info: 'core_webservice_get_site_info',
  courses: 'core_enrol_get_users_courses',
  completion: 'core_completion_get_course_completion_status',
  activities: 'core_completion_get_activities_completion_status',
  grades: 'gradereport_user_get_grade_items',
  certificates: 'mod_customcert_list_issues',
});

function positiveId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new AcademiaError('invalid_moodle_identity', 422);
  return id;
}
function bounded(value, fallback, min, max) {
  const n = value == null ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new AcademiaError('invalid_pagination', 422);
  return n;
}
function isoTimestamp(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}
function optionalNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function plainText(value, max = 300) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
}
function trueValue(value) { return value === true || value === 1 || value === '1'; }
function upstreamError(value) {
  return value && !Array.isArray(value) && typeof value === 'object' &&
    (typeof value.exception === 'string' || typeof value.errorcode === 'string');
}
function ensureRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AcademiaError('invalid_moodle_response');
  return value;
}
function gradeSummary(data, userId) {
  const records = ensureRecord(data).usergrades;
  if (!Array.isArray(records)) throw new AcademiaError('invalid_moodle_response');
  // A privileged read token may see other students. A response must explicitly name its owner.
  const own = records.find(row => Number(row.userid) === userId);
  if (!own) {
    if (records.length) throw new AcademiaError('moodle_owner_mismatch');
    return { raw: null, minimum: null, maximum: null, percentage: null, status: 'ungraded' };
  }
  if (!Array.isArray(own.gradeitems)) throw new AcademiaError('invalid_moodle_response');
  const courseGrade = own.gradeitems.find(item => item.itemtype === 'course');
  if (!courseGrade || trueValue(courseGrade.gradeishidden) || trueValue(courseGrade.gradehiddenbydate)) {
    return { raw: null, minimum: null, maximum: null, percentage: null, status: courseGrade ? 'hidden' : 'ungraded' };
  }
  const raw = optionalNumber(courseGrade.graderaw);
  const min = optionalNumber(courseGrade.grademin);
  const max = optionalNumber(courseGrade.grademax);
  // Scale grades must not be invented as a percentage.
  const percentage = raw !== null && max !== null && min !== null && max > min
    ? Math.round((raw - min) * 10000 / (max - min)) / 100 : null;
  return { raw, minimum: min, maximum: max, percentage, status: raw === null ? 'ungraded' : 'graded' };
}
async function mapLimited(items, limit, map) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await map(items[index]);
    }
  }));
  return results;
}

export function createAcademia({
  baseUrl,
  token,
  fetchImpl = globalThis.fetch,
  timeoutMs = 12_000,
  now = () => new Date(),
  certificateProvider = 'customcert',
} = {}) {
  let base;
  try { base = new URL(baseUrl); } catch { throw new AcademiaError('moodle_not_configured'); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(loopback && base.protocol === 'http:')) ||
      base.username || base.password || base.search || base.hash) throw new AcademiaError('invalid_moodle_configuration');
  if (!token || typeof token !== 'string' || token.length < 8 || /[\r\n]/.test(token)) throw new AcademiaError('moodle_not_configured');
  base.pathname = base.pathname.replace(/\/+$/, '') + '/';
  const endpoint = new URL('webservice/rest/server.php', base).href;
  const asOf = () => new Date(now()).toISOString();
  let functionCache = null;
  let functionCacheExpires = 0;
  let discovery = null;
  async function call(functionName, parameters = {}) {
    const body = new URLSearchParams({
      wstoken: token,
      wsfunction: functionName,
      moodlewsrestformat: 'json',
      moodlewssettingfilter: 'false',
    });
    for (const [key, value] of Object.entries(parameters)) body.set(key, String(value));
    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
        signal: AbortSignal.timeout(timeoutMs),
        redirect: 'error',
        cache: 'no-store',
      });
      if (!response.ok) throw new AcademiaError('moodle_unavailable');
      const data = await response.json();
      if (upstreamError(data)) {
        const unavailable = ['accessexception', 'webservice_access_exception', 'invalidtoken', 'required_capability_exception'].includes(data.errorcode);
        throw new AcademiaError(unavailable ? 'moodle_service_not_authorized' : 'moodle_source_error');
      }
      return data;
    } catch (error) {
      if (error instanceof AcademiaError) throw error;
      // Do not surface transport/upstream strings: they may include token, URL or private data.
      throw new AcademiaError('moodle_unavailable');
    }
  }
  async function functions() {
    const stamp = new Date(now()).getTime();
    if (functionCache && stamp < functionCacheExpires) return functionCache;
    if (!discovery) discovery = (async () => {
      const data = ensureRecord(await call(FN.info));
      if (!Array.isArray(data.functions)) throw new AcademiaError('invalid_moodle_response');
      const available = new Set(data.functions.map(row => row.name).filter(name => typeof name === 'string'));
      functionCache = available;
      functionCacheExpires = stamp + 60_000;
      return available;
    })().finally(() => { discovery = null; });
    return discovery;
  }
  async function learningCourse(course, userId, available) {
    const id = positiveId(course.id);
    const payload = {
      id: String(id),
      title: plainText(course.fullname || course.displayname || course.shortname || 'Curso'),
      source: 'moodle',
      url: new URL('course/view.php?id=' + id, base).href,
      starts_at: isoTimestamp(course.startdate),
      ends_at: isoTimestamp(course.enddate),
      enrollment_status: 'enrolled',
      completion_status: 'unknown',
      completed_at: null,
      progress: null,
      grade: { raw: null, minimum: null, maximum: null, percentage: null, status: 'unavailable' },
      certificate_status: 'not_checked',
      errors: [],
    };
    const jobs = [
      [FN.completion, { courseid: id, userid: userId }],
      [FN.activities, { courseid: id, userid: userId }],
      [FN.grades, { courseid: id, userid: userId }],
    ];
    const settled = await Promise.allSettled(jobs.map(async ([name, args]) => {
      if (!available.has(name)) throw new AcademiaError('moodle_function_not_enabled');
      return call(name, args);
    }));
    const read = (i, apply) => {
      if (settled[i].status === 'rejected') {
        payload.errors.push({ field: ['completion', 'progress', 'grade'][i], code: settled[i].reason.code || 'moodle_unavailable' });
        return;
      }
      try { apply(settled[i].value); } catch (error) {
        payload.errors.push({ field: ['completion', 'progress', 'grade'][i], code: error.code || 'invalid_moodle_response' });
      }
    };
    read(0, data => {
      const status = ensureRecord(ensureRecord(data).completionstatus);
      if (typeof status.completed !== 'boolean' && ![0, 1, '0', '1'].includes(status.completed)) throw new AcademiaError('invalid_moodle_response');
      payload.completion_status = trueValue(status.completed) ? 'completed' : 'in_progress';
      const times = Array.isArray(status.completions)
        ? status.completions.filter(row => row.complete === true || row.complete === 1).map(row => Number(row.timecompleted)).filter(Number.isFinite)
        : [];
      // Completion criteria timestamps are shown only when course completion is explicit.
      payload.completed_at = payload.completion_status === 'completed' && times.length ? isoTimestamp(Math.max(...times)) : null;
    });
    read(1, data => {
      const statuses = ensureRecord(data).statuses;
      if (!Array.isArray(statuses)) throw new AcademiaError('invalid_moodle_response');
      // Activities marked complete-pass or complete-fail both count as completed activities,
      // never as course approval or certificate issuance.
      payload.progress = statuses.length
        ? Math.round(statuses.filter(row => [1, 2, 3].includes(Number(row.state))).length * 1000 / statuses.length) / 10
        : payload.completion_status === 'completed' ? 100 : null;
    });
    read(2, data => { payload.grade = gradeSummary(data, userId); });
    if (payload.completion_status === 'completed') payload.certificate_status = 'completion_only';
    return payload;
  }
  async function getLearning(moodleUserId) {
    const userId = positiveId(moodleUserId);
    const available = await functions();
    if (!available.has(FN.courses)) throw new AcademiaError('moodle_function_not_enabled');
    const rows = await call(FN.courses, { userid: userId, returnusercount: 0 });
    if (!Array.isArray(rows)) throw new AcademiaError('invalid_moodle_response');
    const distinct = new Map();
    for (const row of rows) {
      if (Number.isSafeInteger(Number(row.id)) && Number(row.id) > 1) distinct.set(Number(row.id), row);
    }
    const selected = [...distinct.values()].slice(0, 100);
    const courses = await mapLimited(selected, 4, course => learningCourse(course, userId, available));
    return {
      source: 'moodle',
      status: courses.some(row => row.errors.length) ? 'partial' : 'available',
      as_of: asOf(),
      total: distinct.size,
      truncated: distinct.size > courses.length,
      courses,
    };
  }

  function normalizeCertificate(record, userId) {
    const data = ensureRecord(record);
    if (Number(data.user?.id) !== userId) throw new AcademiaError('moodle_owner_mismatch');
    const issue = ensureRecord(data.issue);
    const id = positiveId(issue.id);
    const customcertId = positiveId(issue.customcertid);
    const issuedAt = isoTimestamp(issue.timecreated);
    const code = String(issue.code || '');
    if (!issuedAt || !/^[A-Za-z0-9_-]{1,128}$/.test(code)) throw new AcademiaError('invalid_moodle_response');
    const verification = new URL('mod/customcert/verify_certificate.php', base);
    verification.searchParams.set('code', code);
    return {
      id: String(id),
      issuer: 'moodle',
      provider: 'customcert',
      title: plainText(data.template?.name || 'Certificado emitido'),
      customcert_id: String(customcertId),
      issued_at: issuedAt,
      status: 'issued',
      code,
      verification_url: verification.href,
      verification_requires_moodle_permission: true,
      download_available: true,
      // Presence in the authoritative issue list confirms issue existence, not a public
      // verification policy or revocation support absent from this API.
      validity: 'source_record_exists',
    };
  }
  async function getCertificates(moodleUserId, { offset = 0, limit = 50 } = {}) {
    const userId = positiveId(moodleUserId);
    offset = bounded(offset, 0, 0, 100_000);
    limit = bounded(limit, 50, 1, 100);
    const available = await functions();
    if (certificateProvider !== 'customcert' || !available.has(FN.certificates)) {
      return { source: 'moodle', status: 'unsupported', reason: 'certificate_provider_not_enabled', as_of: asOf(), certificates: [], next_offset: null };
    }
    // Fetch one extra entry to distinguish a full final page from a real next page.
    const rows = await call(FN.certificates, { userid: userId, includepdf: 0, limit: limit + 1, offset });
    if (!Array.isArray(rows)) throw new AcademiaError('invalid_moodle_response');
    const mapped = rows.map(row => normalizeCertificate(row, userId));
    return {
      source: 'moodle',
      status: 'available',
      as_of: asOf(),
      certificates: mapped.slice(0, limit),
      next_offset: mapped.length > limit ? offset + limit : null,
    };
  }
  async function downloadCertificate(moodleUserId, issueId) {
    const userId = positiveId(moodleUserId);
    const requestedId = positiveId(issueId);
    const available = await functions();
    if (certificateProvider !== 'customcert' || !available.has(FN.certificates)) throw new AcademiaError('certificate_provider_not_enabled', 503);
    // Look up only this authenticated student's issued records. Do not accept a customcert
    // ID or a download URL from the browser, and never expose the Moodle token in a URL.
    let match = null;
    for (let offset = 0; offset < 10_000; offset += 100) {
      const rows = await call(FN.certificates, { userid: userId, includepdf: 0, limit: 100, offset });
      if (!Array.isArray(rows)) throw new AcademiaError('invalid_moodle_response');
      const metadata = rows.map(row => normalizeCertificate(row, userId));
      match = metadata.find(row => Number(row.id) === requestedId);
      if (match || rows.length < 100) break;
    }
    if (!match) throw new AcademiaError('certificate_not_found', 404);
    const pdfRows = await call(FN.certificates, { userid: userId, customcertid: Number(match.customcert_id), includepdf: 1, limit: 20, offset: 0 });
    if (!Array.isArray(pdfRows)) throw new AcademiaError('invalid_moodle_response');
    for (const row of pdfRows) normalizeCertificate(row, userId);
    const issue = pdfRows.find(row => Number(row.issue?.id) === requestedId && row.issue?.code === match.code);
    if (!issue) throw new AcademiaError('certificate_not_found', 404);
    const encoded = issue.pdf?.content;
    if (issue.pdf?.haspdf !== true || typeof encoded !== 'string' || encoded.length > 14_000_000 ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new AcademiaError('certificate_pdf_unavailable');
    const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    if (bytes.length > 10_000_000 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new AcademiaError('certificate_pdf_unavailable');
    return {
      content: bytes,
      content_type: 'application/pdf',
      filename: 'certificado-moodle-' + requestedId + '.pdf',
      metadata: match,
    };
  }
  return Object.freeze({ getLearning, getCertificates, downloadCertificate });
}
