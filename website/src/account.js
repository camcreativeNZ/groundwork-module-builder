// Groundwork website: accounts, My learning, the module player and checkout.
// Talks only to our login service (Supabase, set in config.js) and to our own server (/api/...).
(function () {
  'use strict';
  var cfg = window.GW_CONFIG || {};
  if (!window.supabase || !cfg.supabaseUrl) return;
  var sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
  var $ = function (id) { return document.getElementById(id); };

  // ---------- The login cookie ----------
  // The module files under /learn/ are checked by our server, which reads this cookie.
  function setCookie(session) {
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    if (session && session.access_token) {
      var age = Math.max(60, (session.expires_at || 0) - Math.floor(Date.now() / 1000));
      document.cookie = 'gw_session=' + encodeURIComponent(session.access_token) + '; Path=/learn; Max-Age=' + age + '; SameSite=Lax' + secure;
    } else {
      document.cookie = 'gw_session=; Path=/learn; Max-Age=0; SameSite=Lax' + secure;
    }
  }
  sb.auth.onAuthStateChange(function (event, session) {
    setCookie(session);
    if (event === 'PASSWORD_RECOVERY') showNewPassword();
  });

  // Where to go after logging in. Only our own pages, never another website.
  function nextPage() {
    var n = new URLSearchParams(location.search).get('next') || '';
    return /^\/?[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(n) ? n.replace(/^\//, '') : 'my-learning.html';
  }
  document.querySelectorAll('[data-keep-next]').forEach(function (a) {
    var n = new URLSearchParams(location.search).get('next');
    if (n) a.href += '?next=' + encodeURIComponent(n);
  });

  function show(prefix, kind, msg) {
    var err = $(prefix + '-error');
    var ok = $(prefix + '-ok');
    if (err) err.hidden = kind !== 'error';
    if (ok) ok.hidden = kind !== 'ok';
    var el = kind === 'error' ? err : ok;
    if (el) el.textContent = msg;
  }
  function busy(form, on) {
    var b = form.querySelector('button[type=submit]');
    if (b) { b.disabled = on; b.setAttribute('aria-busy', on ? 'true' : 'false'); }
  }
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function whenSignedIn(fn, back) {
    return sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { location.replace('login.html?next=' + encodeURIComponent(back)); return; }
      setCookie(s);
      return fn(s);
    });
  }

  // ---------- Log in ----------
  var loginForm = $('login-form');
  if (loginForm) {
    if (new URLSearchParams(location.search).get('confirmed')) show('l', 'ok', 'Your email address is confirmed. Please log in.');
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = loginForm.elements.email.value.trim();
      var password = loginForm.elements.password.value;
      if (!EMAIL.test(email) || !password) return show('l', 'error', 'Please add your email address and password.');
      busy(loginForm, true);
      sb.auth.signInWithPassword({ email: email, password: password }).then(function (r) {
        busy(loginForm, false);
        if (r.error) {
          var m = /confirm/i.test(r.error.message) ? 'Please confirm your email address first. Check your inbox for our email.'
            : /invalid/i.test(r.error.message) ? 'That email and password don\'t match an account. Check them and try again.'
            : 'We couldn\'t log you in. Please try again.';
          return show('l', 'error', m);
        }
        location.href = nextPage();
      });
    });
  }

  // ---------- Create an account ----------
  var signupForm = $('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = signupForm.elements.email.value.trim();
      var password = signupForm.elements.password.value;
      if (!EMAIL.test(email)) return show('s', 'error', 'Please add a valid email address.');
      if (password.length < 8) return show('s', 'error', 'Please choose a password with at least 8 characters.');
      busy(signupForm, true);
      var after = cfg.siteUrl ? cfg.siteUrl + '/login.html?confirmed=1&next=' + encodeURIComponent(nextPage()) : undefined;
      sb.auth.signUp({ email: email, password: password, options: { emailRedirectTo: after } }).then(function (r) {
        busy(signupForm, false);
        if (r.error) {
          var m = /already|registered/i.test(r.error.message) ? 'There\'s already an account with that email. Try logging in instead.'
            : /password/i.test(r.error.message) ? 'Please choose a stronger password.'
            : 'We couldn\'t create your account. Please try again.';
          return show('s', 'error', m);
        }
        if (r.data && r.data.session) { location.href = nextPage(); return; }
        signupForm.querySelectorAll('label, button').forEach(function (el) { el.hidden = true; });
        show('s', 'ok', 'Nearly done. We\'ve sent an email to ' + email + '. Select the link in it to confirm your address, then log in.');
      });
    });
  }

  // ---------- Reset a password ----------
  var resetForm = $('reset-form');
  var newForm = $('newpass-form');
  function showNewPassword() {
    if (!resetForm || !newForm) return;
    resetForm.hidden = true;
    newForm.hidden = false;
    newForm.elements.password.focus();
  }
  if (resetForm) {
    if (/type=recovery/.test(location.hash) || new URLSearchParams(location.search).get('set')) {
      sb.auth.getSession().then(function (r) { if (r.data && r.data.session) showNewPassword(); });
    }
    resetForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = resetForm.elements.email.value.trim();
      if (!EMAIL.test(email)) return show('r', 'error', 'Please add a valid email address.');
      busy(resetForm, true);
      var to = (cfg.siteUrl || location.origin) + '/reset.html?set=1';
      sb.auth.resetPasswordForEmail(email, { redirectTo: to }).then(function () {
        busy(resetForm, false);
        // Say the same thing whether or not the account exists, so the page can't be used to test addresses.
        show('r', 'ok', 'If there\'s an account for ' + email + ', we\'ve emailed it a reset link. It may take a few minutes to arrive.');
      });
    });
    newForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var password = newForm.elements.password.value;
      if (password.length < 8) return show('n', 'error', 'Please choose a password with at least 8 characters.');
      busy(newForm, true);
      sb.auth.updateUser({ password: password }).then(function (r) {
        busy(newForm, false);
        if (r.error) return show('n', 'error', 'We couldn\'t save your new password. The link may have expired, so please ask for a new one.');
        show('n', 'ok', 'Your new password is saved. Taking you to My learning…');
        setTimeout(function () { location.href = 'my-learning.html'; }, 1500);
      });
    });
  }

  // ---------- Which modules a plan opens (the server checks this too) ----------
  function allows(plan, id) {
    if (plan === 'full') return true;
    if (plan === 'foundations') return id.charAt(0) === 'F';
    return false;
  }
  var PLAN_NAMES = { full: 'Full suite', foundations: 'Foundations' };

  // ---------- My learning ----------
  var ml = $('ml');
  if (ml) {
    whenSignedIn(function (session) {
      $('ml-who').textContent = session.user.email;
      var q = new URLSearchParams(location.search);
      var notice = $('ml-notice');
      function note(html, warn) { notice.innerHTML = html; notice.className = 'notice' + (warn ? ' warn' : ''); notice.hidden = false; }
      var locked = q.get('locked');
      if (locked && /^[FPAML]\d{1,2}$/.test(locked)) note(locked + ' isn\'t in your plan. <a href="pricing.html#full-suite">See the full suite</a> to open every module.', true);

      function load(tries) {
        return Promise.all([sb.rpc('my_plan'), sb.from('progress').select('module_id,status,passed')]).then(function (r) {
          var plan = r[0].data || null;
          if (!plan && q.get('paid') && tries < 10) {
            note('Thanks for your payment. We\'re setting up your access now. This usually takes a few seconds.');
            return new Promise(function (res) { setTimeout(res, 3000); }).then(function () { return load(tries + 1); });
          }
          if (plan && q.get('paid')) note('Thanks for your payment. Your modules are ready. We\'ve emailed you a receipt.');
          render(plan, r[1].data || []);
        });
      }
      return load(0);
    }, 'my-learning.html');
  }

  function render(plan, rows) {
    var done = {};
    rows.forEach(function (p) { done[p.module_id] = p; });
    $('ml-plan').innerHTML = plan
      ? 'Your plan: <strong>' + PLAN_NAMES[plan] + '</strong>. Pick up where you left off, or start a new module.'
      : 'You don\'t have a plan yet. <a href="pricing.html">Choose a plan</a> to open the modules, or <a href="try-f3.html">try F3 free</a>.';
    var counts = {};
    ml.querySelectorAll('.ml-item').forEach(function (li) {
      var id = li.getAttribute('data-id');
      var open = allows(plan, id);
      var p = done[id];
      var status = li.querySelector('[data-status]');
      var btn = li.querySelector('[data-open]');
      var aid = li.querySelector('.ml-aid');
      var level = li.closest('.ml-group').querySelector('[data-count]').getAttribute('data-count');
      counts[level] = counts[level] || { done: 0, all: 0 };
      counts[level].all++;
      li.querySelector('[data-locked]').hidden = open || !plan;
      btn.hidden = !open;
      if (aid) aid.hidden = !open;
      if (p && p.status === 'completed') {
        counts[level].done++;
        status.textContent = p.passed === false ? 'Finished, quiz not passed' : 'Completed';
        status.className = 'ml-status done';
        btn.firstChild.textContent = 'Review';
      } else if (p) {
        status.textContent = 'In progress';
        status.className = 'ml-status started';
        btn.firstChild.textContent = 'Continue';
      } else {
        status.textContent = open ? 'Not started' : '';
      }
    });
    ml.querySelectorAll('[data-count]').forEach(function (el) {
      var c = counts[el.getAttribute('data-count')];
      el.textContent = c ? c.done + ' of ' + c.all + ' completed' : '';
    });
    ml.setAttribute('aria-busy', 'false');
  }

  var signOut = $('sign-out');
  if (signOut) signOut.addEventListener('click', function () {
    sb.auth.signOut().then(function () { setCookie(null); location.href = './'; });
  });

  // ---------- The module player ----------
  var frame = $('play-iframe');
  if (frame) {
    var id = (new URLSearchParams(location.search).get('m') || '').toUpperCase();
    var catalogue = JSON.parse($('catalogue').textContent);
    var mod = catalogue[id];
    whenSignedIn(function (session) {
      var notice = $('play-notice');
      if (!mod) { $('play-title').textContent = 'Module not found'; notice.innerHTML = 'We couldn\'t find that module. <a href="my-learning.html">Go to My learning</a>.'; notice.hidden = false; return; }
      $('play-title').textContent = id + ' ' + mod.title;
      document.title = id + ' ' + mod.title + ' · Groundwork AI Training';
      return Promise.all([
        sb.rpc('my_plan'),
        sb.from('progress').select('*').eq('user_id', session.user.id).eq('module_id', id).maybeSingle()
      ]).then(function (r) {
        if (!allows(r[0].data, id)) {
          notice.innerHTML = r[0].data ? id + ' isn\'t in your plan. <a href="pricing.html#full-suite">See the full suite</a> to open every module.'
            : 'You need a plan to open this module. <a href="pricing.html">Choose a plan</a>, or <a href="try-f3.html">try F3 free</a>.';
          notice.className = 'notice warn';
          notice.hidden = false;
          return;
        }
        window.API_1484_11 = makeApi(session.user.id, id, r[1].data);
        frame.title = id + ', ' + mod.title + ' (interactive module)';
        $('play-frame').hidden = false;
        frame.src = 'learn/' + id + '/index.html';
      });
    }, 'play.html?m=' + id);
  }

  // A small SCORM 2004 connection, so the module saves progress to your account the same way it would in an LMS.
  function makeApi(userId, moduleId, row) {
    var saved = $('play-saved');
    var data = {
      'cmi.entry': row ? 'resume' : 'ab-initio',
      'cmi.location': (row && row.location) || '',
      'cmi.suspend_data': (row && row.suspend_data) || '',
      'cmi.completion_status': row ? row.status : 'not attempted',
      'cmi.success_status': !row || row.passed === null ? 'unknown' : row.passed ? 'passed' : 'failed',
      'cmi.score.raw': row && row.score_raw !== null ? String(row.score_raw) : '',
      'cmi.score.max': row && row.score_max !== null ? String(row.score_max) : '',
      'cmi.score.min': '0',
      'cmi.score.scaled': row && row.score !== null ? String(row.score) : '',
      'cmi.exit': ''
    };
    var completedAt = row ? row.completed_at : null;
    var queue = Promise.resolve();
    var dirty = false;
    var lastError = '0';

    function num(k) { var v = parseFloat(data[k]); return isNaN(v) ? null : v; }
    function save() {
      if (!dirty) return queue;
      dirty = false;
      var completed = data['cmi.completion_status'] === 'completed';
      if (completed && !completedAt) completedAt = new Date().toISOString();
      var record = {
        user_id: userId,
        module_id: moduleId,
        status: completed ? 'completed' : 'incomplete',
        passed: data['cmi.success_status'] === 'passed' ? true : data['cmi.success_status'] === 'failed' ? false : null,
        score: num('cmi.score.scaled'),
        score_raw: num('cmi.score.raw'),
        score_max: num('cmi.score.max'),
        location: data['cmi.location'] || null,
        suspend_data: data['cmi.suspend_data'] || null,
        completed_at: completedAt,
        updated_at: new Date().toISOString()
      };
      queue = queue.then(function () {
        return sb.from('progress').upsert(record, { onConflict: 'user_id,module_id' }).then(function (r) {
          if (saved) saved.textContent = r.error ? 'We couldn\'t save your progress just now. Keep going and we\'ll try again.' : 'Progress saved.';
          if (r.error) dirty = true;
        });
      });
      return queue;
    }
    return {
      Initialize: function () { lastError = '0'; return 'true'; },
      Terminate: function () { save(); return 'true'; },
      Commit: function () { save(); return 'true'; },
      GetValue: function (k) {
        if (k in data) { lastError = '0'; return data[k]; }
        lastError = '401';
        return '';
      },
      SetValue: function (k, v) {
        if (!(k in data) || k === 'cmi.entry') { lastError = '401'; return 'false'; }
        v = String(v);
        // Once a module is completed or passed, it stays that way when the learner reviews it.
        if (k === 'cmi.completion_status' && data[k] === 'completed') return 'true';
        if (k === 'cmi.success_status' && data[k] === 'passed') return 'true';
        if (k === 'cmi.suspend_data') v = v.slice(0, 64000);
        if (data[k] !== v) { data[k] = v; dirty = true; }
        lastError = '0';
        return 'true';
      },
      GetLastError: function () { return lastError; },
      GetErrorString: function (c) { return c === '401' ? 'Not implemented' : ''; },
      GetDiagnostic: function () { return ''; }
    };
  }

  // ---------- Checkout ----------
  var checkout = $('checkout');
  if (checkout) {
    var saved = null;
    try { saved = JSON.parse(sessionStorage.getItem('gw_checkout') || 'null'); } catch (e) { saved = null; }
    if (saved && new URLSearchParams(location.search).get('buy')) {
      checkout.elements.plan.value = saved.plan;
      checkout.elements.seats.value = saved.seats;
      checkout.elements.seats.dispatchEvent(new Event('input'));
      $('checkout-note').textContent = 'You\'re logged in. Check your plan and number of learners, then continue to payment.';
      checkout.scrollIntoView();
      checkout.querySelector('button[type=submit]').focus();
    }
    checkout.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('checkout-error');
      var plan = checkout.elements.plan.value;
      var seats = Math.floor(Number(checkout.elements.seats.value));
      err.hidden = true;
      if (!(seats >= 1 && seats <= 499)) {
        err.textContent = 'Choose between 1 and 499 learners. For 500 or more, please ask us for a quote.';
        err.hidden = false;
        return;
      }
      sb.auth.getSession().then(function (r) {
        var s = r.data && r.data.session;
        if (!s) {
          try { sessionStorage.setItem('gw_checkout', JSON.stringify({ plan: plan, seats: seats })); } catch (x) { /* fine */ }
          location.href = 'signup.html?next=' + encodeURIComponent('pricing.html?buy=1');
          return;
        }
        busy(checkout, true);
        return fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.access_token },
          body: JSON.stringify({ plan: plan, seats: seats })
        }).then(function (res) { return res.json(); }).then(function (out) {
          if (out.url) { location.href = out.url; return; }
          throw new Error(out.error || 'no url');
        }).catch(function (x) {
          busy(checkout, false);
          err.textContent = x && x.message && x.message !== 'no url' && !/fetch|JSON/i.test(x.message) ? x.message : 'We couldn\'t start the payment. Please try again in a minute.';
          err.hidden = false;
        });
      });
    });
  }
})();
