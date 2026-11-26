'use strict';
// A pretend LMS, injected into the page for tests and QA runs. It records every SCORM call.
function mockLms(state) {
  const data = Object.assign({ 'cmi.completion_status': 'not attempted', 'cmi.success_status': 'unknown', 'cmi.location': '' }, state);
  window.__lms = { data: data, calls: [] };
  window.API_1484_11 = {
    Initialize: function () { window.__lms.calls.push('Initialize'); return 'true'; },
    Terminate: function () { window.__lms.calls.push('Terminate'); return 'true'; },
    Commit: function () { window.__lms.calls.push('Commit'); return 'true'; },
    GetValue: function (k) { return k in data ? String(data[k]) : ''; },
    SetValue: function (k, v) { data[k] = v; window.__lms.calls.push('Set ' + k + '=' + v); return 'true'; },
    GetLastError: function () { return '0'; }, GetErrorString: function () { return ''; }, GetDiagnostic: function () { return ''; }
  };
}
module.exports = { mockLms };
