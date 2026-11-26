/* Minimal SCORM 2004 wrapper. Works without an LMS: every call quietly does nothing. */
(function () {
  var api = null;
  var started = false;
  var finished = false;

  function findAPI(win) {
    var tries = 0;
    while (win && tries < 500) {
      if (win.API_1484_11) return win.API_1484_11;
      if (win.parent && win.parent !== win) { win = win.parent; } else { break; }
      tries++;
    }
    return null;
  }

  function locate() {
    try { api = findAPI(window); } catch (e) { api = null; }
    if (!api) {
      try { if (window.opener) api = findAPI(window.opener); } catch (e) { api = null; }
    }
    return api;
  }

  var SCORM = {
    get connected() { return !!api && started; },
    init: function () {
      if (!locate()) return false;
      var result = api.Initialize('');
      started = result === 'true' || result === true;
      return started;
    },
    get: function (key) {
      if (!SCORM.connected) return '';
      return api.GetValue(key);
    },
    set: function (key, value) {
      if (!SCORM.connected) return false;
      return api.SetValue(key, String(value)) === 'true';
    },
    commit: function () {
      if (!SCORM.connected) return false;
      return api.Commit('') === 'true';
    },
    finish: function () {
      if (!SCORM.connected || finished) return;
      finished = true;
      api.Commit('');
      api.Terminate('');
    }
  };

  window.SCORM = SCORM;
})();
