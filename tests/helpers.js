'use strict';
// A pretend LMS for tests: records every SCORM call so we can check what the module sends.
function mockLms(initial) {
  return function (state) {
    const data = Object.assign({ 'cmi.completion_status': 'not attempted', 'cmi.success_status': 'unknown', 'cmi.location': '' }, state);
    window.__lms = { data, calls: [] };
    window.API_1484_11 = {
      Initialize: function () { window.__lms.calls.push('Initialize'); return 'true'; },
      Terminate: function () { window.__lms.calls.push('Terminate'); return 'true'; },
      Commit: function () { window.__lms.calls.push('Commit'); return 'true'; },
      GetValue: function (k) { return k in data ? String(data[k]) : ''; },
      SetValue: function (k, v) { data[k] = v; window.__lms.calls.push('Set ' + k + '=' + v); return 'true'; },
      GetLastError: function () { return '0'; }, GetErrorString: function () { return ''; }, GetDiagnostic: function () { return ''; }
    };
  };
}
module.exports = { mockLms };
