// Groundwork website: small page behaviours. No outside calls.
(function () {
  'use strict';

  // A short note for features that arrive in a later build step.
  var toast = document.createElement('p');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.hidden = true;
  document.body.appendChild(toast);
  var timer;
  function say(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(function () { toast.hidden = true; }, 3000);
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-soon]');
    if (!el) return;
    e.preventDefault();
    say(el.getAttribute('data-soon'));
  });

  // Pricing: live total.
  var plan = document.getElementById('plan');
  var seats = document.getElementById('seats');
  var total = document.getElementById('total');
  function update() {
    var n = Math.max(0, Math.floor(Number(seats.value) || 0));
    var price = Number(plan.options[plan.selectedIndex].getAttribute('data-price'));
    total.textContent = 'US$' + (n * price).toLocaleString('en-NZ');
  }
  if (plan && seats && total) {
    plan.addEventListener('change', update);
    seats.addEventListener('input', update);
    update();
    document.getElementById('checkout').addEventListener('submit', function (e) { e.preventDefault(); });
  }

  // Contact form: check the fields, then show the "sent" message.
  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = document.getElementById('c-error');
      var name = form.elements.name.value.trim();
      var email = form.elements.email.value.trim();
      var msg = form.elements.message.value.trim();
      var missing = [];
      if (!name) missing.push('your name');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push('a valid email address');
      if (!msg) missing.push('a message');
      if (missing.length) {
        err.textContent = 'Please add ' + missing.join(', ') + '.';
        err.hidden = false;
        return;
      }
      err.hidden = true;
      var button = form.querySelector('button[type=submit]');
      button.disabled = true;
      var body = {};
      ['name', 'email', 'organisation', 'topic', 'learners', 'message', 'website'].forEach(function (k) {
        if (form.elements[k]) body[k] = form.elements[k].value.trim();
      });
      // Our server emails Groundwork and sends the sender a copy.
      fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (out) { if (!r.ok) throw new Error(out.error || ''); }); })
        .then(function () {
          document.getElementById('c-sent-email').textContent = email;
          form.hidden = true;
          var sent = document.getElementById('c-sent');
          sent.hidden = false;
          sent.setAttribute('tabindex', '-1');
          sent.focus();
        })
        .catch(function (x) {
          button.disabled = false;
          err.textContent = x && x.message && !/fetch|JSON/i.test(x.message) ? x.message : 'We couldn\'t send your message just now. Please try again in a few minutes.';
          err.hidden = false;
        });
    });
  }

  // Header: show "My learning" instead of "Log in" when someone is logged in on this device.
  var acct = document.getElementById('nav-account');
  try {
    for (var i = 0; acct && i < localStorage.length; i++) {
      if (/^sb-.+-auth-token$/.test(localStorage.key(i))) {
        acct.textContent = 'My learning';
        acct.href = acct.getAttribute('href').replace('login.html', 'my-learning.html');
        break;
      }
    }
  } catch (e) { /* storage blocked: keep "Log in" */ }
})();
