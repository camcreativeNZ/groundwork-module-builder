'use strict';
// Account pages: log in, create an account, reset a password, My learning and the module player.
// The pages are static. account.js (in the browser) talks to the login service and fills them in.
const { esc } = require('./layout');
const { pageHead } = require('./pages');
const { PATHWAYS } = require('./home');

// The parts every account form shares: a message area for errors and a status area for good news.
function messages(prefix) {
  return `<p class="form-error" id="${prefix}-error" role="alert" hidden></p>
    <p class="form-ok" id="${prefix}-ok" role="status" hidden></p>`;
}

function login() {
  return pageHead('', 'Log in to Groundwork', '') + `
<section class="band" style="padding-top:1rem"><div class="wrap narrow">
  <form class="form" id="login-form" novalidate>
    <label for="l-email">Email<input id="l-email" name="email" type="email" autocomplete="email" required></label>
    <label for="l-pass">Password<input id="l-pass" name="password" type="password" autocomplete="current-password" required></label>
    ${messages('l')}
    <button class="btn btn-primary" type="submit">Log in</button>
    <p class="small-note"><a href="reset.html">Forgot your password?</a></p>
    <p class="small-note">New to Groundwork? <a href="signup.html" data-keep-next>Create an account</a></p>
  </form>
</div></section>`;
}

function signup() {
  return pageHead('', 'Create your account', 'Use the email address you want your certificates and receipts sent to.') + `
<section class="band" style="padding-top:1rem"><div class="wrap narrow">
  <form class="form" id="signup-form" novalidate>
    <label for="s-email">Email<input id="s-email" name="email" type="email" autocomplete="email" required></label>
    <label for="s-pass">Password <span class="opt">(at least 8 characters)</span><input id="s-pass" name="password" type="password" autocomplete="new-password" minlength="8" required></label>
    ${messages('s')}
    <button class="btn btn-primary" type="submit">Create account</button>
    <p class="small-note">Already have an account? <a href="login.html" data-keep-next>Log in</a></p>
    <p class="small-note">By creating an account you agree to our <a href="terms.html">terms</a> and <a href="privacy.html">privacy policy</a>.</p>
  </form>
</div></section>`;
}

function reset() {
  return pageHead('', 'Reset your password', '') + `
<section class="band" style="padding-top:1rem"><div class="wrap narrow">
  <form class="form" id="reset-form" novalidate>
    <p>Enter your email address and we'll send you a link to choose a new password.</p>
    <label for="r-email">Email<input id="r-email" name="email" type="email" autocomplete="email" required></label>
    ${messages('r')}
    <button class="btn btn-primary" type="submit">Send reset link</button>
  </form>
  <form class="form" id="newpass-form" novalidate hidden>
    <p>Choose a new password for your account.</p>
    <label for="n-pass">New password <span class="opt">(at least 8 characters)</span><input id="n-pass" name="password" type="password" autocomplete="new-password" minlength="8" required></label>
    ${messages('n')}
    <button class="btn btn-primary" type="submit">Save new password</button>
  </form>
</div></section>`;
}

// My learning: every module, grouped by pathway. account.js marks what is open, started and finished.
function myLearning(modules) {
  const groups = PATHWAYS.map(function (p) {
    const list = modules.filter(function (m) { return m.level === p.level; });
    const items = list.map(function (m) {
      const aid = m.jobAid ? `<a class="ml-aid" href="learn/${m.id}/assets/${esc(m.jobAid)}" hidden>Job aid<span class="visually-hidden"> for ${m.id} (PDF)</span></a>` : '';
      return `<li class="ml-item" data-id="${m.id}">
        <span class="mid">${m.id}</span>
        <span class="ml-title">${esc(m.title)}<small>${m.minutes} min</small></span>
        <span class="ml-status" data-status>Not started</span>
        <span class="ml-actions"><a class="btn btn-secondary btn-sm" href="play.html?m=${m.id}" data-open hidden>Start<span class="visually-hidden"> ${m.id}</span></a>${aid}<span class="ml-locked" data-locked hidden>Full suite</span></span>
      </li>`;
    }).join('');
    return `<section class="ml-group" aria-labelledby="ml-${p.slug}">
    <div class="ml-group-head"><h2 class="h3" id="ml-${p.slug}">${esc(p.level)}</h2><p class="ml-count" data-count="${esc(p.level)}"></p></div>
    <ol class="ml-list">${items}</ol>
  </section>`;
  }).join('');
  return `<section class="page-head"><div class="wrap">
  <p class="eyebrow" id="ml-who">My learning</p>
  <h1>My learning</h1>
  <p class="lede" id="ml-plan">Loading your modules…</p>
</div></section>
<section class="band" style="padding-top:1rem"><div class="wrap">
  <div class="notice" id="ml-notice" role="status" hidden></div>
  <div class="ml" id="ml" aria-busy="true">${groups}</div>
  <p class="small-note"><button class="link-btn" type="button" id="sign-out">Log out</button></p>
</div></section>`;
}

// The player page. account.js connects the module's progress saving to your account, then loads it.
function play() {
  return `<section class="page-head tight"><div class="wrap">
  <p class="eyebrow"><a href="my-learning.html">My learning</a></p>
  <h1 id="play-title">Loading module…</h1>
</div></section>
<section class="band" style="padding-top:0"><div class="wrap">
  <div class="notice" id="play-notice" role="status" hidden></div>
  <div class="player-frame" id="play-frame" hidden>
    <iframe id="play-iframe" title="Module (interactive)"></iframe>
  </div>
  <div class="player-bar">
    <p class="small-note" id="play-saved" aria-live="polite">Your progress is saved as you go.</p>
    <a class="btn btn-secondary" href="my-learning.html">Back to My learning</a>
  </div>
</div></section>`;
}

module.exports = { login, signup, reset, myLearning, play };
