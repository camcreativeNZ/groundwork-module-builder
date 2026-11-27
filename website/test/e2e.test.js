'use strict';
// Whole-website test: runs the real server (wrangler dev) against stand-ins for the login service,
// Stripe and Resend, then buys seats, logs in, opens modules and saves progress in a real browser.
// Run with: npm run website:test   (builds the site first)
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { launch } = require('../../src/browser');
const { standIns } = require('./stand-ins');

const ROOT = path.join(__dirname, '..', '..');
const SITE = 'http://127.0.0.1:8787';
const FAKE = 'http://127.0.0.1:54321';
const WHSEC = 'whsec_stand_in';
const AXE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

let S, wrangler, browser;

async function waitFor(url) {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(url); if (r.status) return; } catch (e) { /* not ready */ }
    await new Promise(function (r) { setTimeout(r, 500); });
  }
  throw new Error('Server did not start: ' + url);
}

test.before(async function () {
  S = standIns();
  await new Promise(function (r) { S.server.listen(54321, '127.0.0.1', r); });
  const vars = {
    SITE_URL: SITE, SUPABASE_URL: FAKE, SUPABASE_SECRET_KEY: S.SECRET, STRIPE_SECRET_KEY: 'sk_test_stand_in',
    STRIPE_WEBHOOK_SECRET: WHSEC, RESEND_API_KEY: 're_stand_in', STRIPE_API: FAKE + '/stripe/', RESEND_API: FAKE + '/resend/',
    STRIPE_PRICE_FULL: 'price_full_test', STRIPE_PRICE_FOUNDATIONS: 'price_foundations_test'
  };
  const args = ['wrangler', 'dev', '-c', 'website/wrangler.jsonc', '--port', '8787', '--ip', '127.0.0.1'];
  Object.keys(vars).forEach(function (k) { args.push('--var', k + ':' + vars[k]); });
  wrangler = spawn('npx', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  let log = '';
  wrangler.stdout.on('data', function (d) { log += d; });
  wrangler.stderr.on('data', function (d) { log += d; });
  wrangler.on('exit', function (c) { if (c) console.error(log); });
  await waitFor(SITE + '/');
  browser = await launch();
});

test.after(async function () {
  if (browser) await browser.close();
  if (wrangler) try { process.kill(-wrangler.pid); } catch (e) { /* gone */ }
  S.server.close();
});

// A browser with the site's login settings pointed at the stand-in.
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.route('**/config.js', function (route) {
    route.fulfill({ contentType: 'text/javascript', body: 'window.GW_CONFIG = ' + JSON.stringify({ siteUrl: SITE, supabaseUrl: FAKE, supabaseKey: 'sb_publishable_stand_in' }) + ';' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', function (e) { throw e; });
  return page;
}

async function axe(page, label) {
  await page.addScriptTag({ path: require.resolve('axe-core') });
  const r = await page.evaluate(function (tags) { return window.axe.run(document, { runOnly: tags }); }, AXE);
  assert.deepEqual(r.violations.map(function (v) { return label + ': ' + v.id + ' ' + v.nodes.map(function (n) { return n.target; }).join(' '); }), []);
}

function signed(event) {
  const raw = JSON.stringify(event);
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac('sha256', WHSEC).update(t + '.' + raw).digest('hex');
  return fetch(SITE + '/api/stripe-webhook', { method: 'POST', headers: { 'Stripe-Signature': 't=' + t + ',v1=' + v1 }, body: raw });
}

async function signUp(page, email) {
  await page.fill('#s-email', email);
  await page.fill('#s-pass', 'a good password');
  await page.click('#signup-form button[type=submit]');
}

test('modules are locked until you log in', async function () {
  const r = await fetch(SITE + '/learn/F1/index.html', { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /\/login\.html\?next=play\.html%3Fm%3DF1$/);
  const r2 = await fetch(SITE + '/learn/F1/index.html', { redirect: 'manual', headers: { Cookie: 'gw_session=made-up' } });
  assert.equal(r2.status, 302);
});

test('buy the full suite, then learn and save progress', async function () {
  const page = await newPage();
  await page.goto(SITE + '/pricing.html');
  await page.selectOption('#plan', 'full');
  await page.fill('#seats', '3');
  await page.click('#checkout button[type=submit]');
  await page.waitForURL(/signup(\.html)?\?/);
  await axe(page, 'signup');
  await signUp(page, 'buyer@example.com');
  await page.waitForURL(/pricing(\.html)?\?buy=1/);
  assert.equal(await page.inputValue('#seats'), '3');
  assert.equal(await page.inputValue('#plan'), 'full');
  await page.click('#checkout button[type=submit]');
  await page.waitForURL(FAKE + '/stripe/pay');
  const c = S.state.checkouts[0].form;
  assert.equal(c['line_items[0][price]'], 'price_full_test');
  assert.equal(c['line_items[0][quantity]'], '3');
  assert.equal(c.customer_email, 'buyer@example.com');

  // Stripe tells our server the payment went through.
  const buyer = S.state.users.find(function (u) { return u.email === 'buyer@example.com'; });
  const event = { type: 'checkout.session.completed', data: { object: {
    mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: buyer.id,
    customer_email: 'buyer@example.com', metadata: { plan: 'full', seats: '3' }
  } } };
  assert.equal((await signed(event)).status, 200);
  assert.equal((await signed(event)).status, 200);                    // sent twice: still one licence
  assert.equal(S.state.licences.length, 1);
  assert.equal(S.state.licences[0].seats, 3);
  assert.equal(S.state.members[0].role, 'admin');
  assert.equal(S.planOf(buyer.id), 'full');

  await page.goto(SITE + '/my-learning.html?paid=1');
  await page.waitForSelector('#ml[aria-busy=false]');
  assert.match(await page.textContent('#ml-plan'), /Full suite/);
  assert.match(await page.textContent('#ml-notice'), /Your modules are ready/);
  assert.equal(await page.isVisible('.ml-item[data-id=P1] [data-open]'), true);
  assert.equal(await page.isVisible('.ml-item[data-id=F1] .ml-aid'), true);
  assert.equal(await page.textContent('#nav-account'), 'My learning');
  await axe(page, 'my-learning');

  // Open F1 and move on two screens: progress is saved to the account.
  await page.click('.ml-item[data-id=F1] [data-open]');
  await page.waitForURL(/play(\.html)?\?m=F1/);
  const frame = page.frameLocator('#play-iframe');
  await frame.locator('#nextBtn').waitFor();
  await frame.locator('#nextBtn').click();
  await frame.locator('#nextBtn').click();
  await page.waitForFunction(function () { return /saved/.test(document.getElementById('play-saved').textContent); });
  const row = S.state.progress.find(function (p) { return p.user_id === buyer.id && p.module_id === 'F1'; });
  assert.ok(row, 'progress row saved');
  assert.equal(row.location, '2');
  assert.equal(row.status, 'incomplete');
  await axe(page, 'play');

  // Come back later: the module opens where the learner left off, and My learning says so.
  await page.goto(SITE + '/play.html?m=F1');
  await page.frameLocator('#play-iframe').locator('.screen:not([hidden]) h2').first().waitFor();
  const shown = await page.frameLocator('#play-iframe').locator('#counter').textContent();
  assert.match(shown, /3/);
  await page.goto(SITE + '/my-learning.html');
  await page.waitForSelector('#ml[aria-busy=false]');
  assert.equal(await page.textContent('.ml-item[data-id=F1] [data-status]'), 'In progress');

  // Log out: the modules lock again.
  await page.click('#sign-out');
  await page.waitForURL(SITE + '/');
  const r = await page.request.get(SITE + '/learn/F1/index.html', { maxRedirects: 0 });
  assert.equal(r.status(), 302);
});

test('Foundations opens only the Foundations modules', async function () {
  const u = { id: 'user-found', email: 'found@example.com', password: 'a good password' };
  S.state.users.push(u);
  S.state.teams.push({ id: 'team-found' });
  S.state.licences.push({ id: 'lic-found', team_id: 'team-found', plan: 'foundations', seats: 1, status: 'active', renews_at: new Date(Date.now() + 86400000).toISOString() });
  S.state.members.push({ team_id: 'team-found', email: u.email, user_id: u.id, role: 'admin', learner: true });

  const page = await newPage();
  await page.goto(SITE + '/login.html?next=my-learning.html');
  await axe(page, 'login');
  await page.fill('#l-email', u.email);
  await page.fill('#l-pass', 'wrong password');
  await page.click('#login-form button[type=submit]');
  await page.waitForSelector('#l-error:not([hidden])');
  assert.match(await page.textContent('#l-error'), /don't match/);
  await page.fill('#l-pass', u.password);
  await page.click('#login-form button[type=submit]');
  await page.waitForURL(/my-learning(\.html)?/);
  await page.waitForSelector('#ml[aria-busy=false]');
  assert.match(await page.textContent('#ml-plan'), /Foundations/);
  assert.equal(await page.isVisible('.ml-item[data-id=F2] [data-open]'), true);
  assert.equal(await page.isVisible('.ml-item[data-id=P1] [data-open]'), false);
  assert.equal(await page.isVisible('.ml-item[data-id=P1] [data-locked]'), true);

  // Typing the address of a locked module goes back to My learning with a note.
  await page.goto(SITE + '/learn/P1/index.html');
  await page.waitForURL(/my-learning(\.html)?\?locked=P1/);
  await page.waitForSelector('#ml-notice:not([hidden])');
  assert.match(await page.textContent('#ml-notice'), /P1 isn't in your plan/);
  await page.goto(SITE + '/play.html?m=P1');
  await page.waitForSelector('#play-notice:not([hidden])');
  assert.equal(await page.isVisible('#play-frame'), false);
});

test('a cancelled subscription closes the modules', async function () {
  const event = { type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled', items: { data: [{ quantity: 3, current_period_end: Math.floor(Date.now() / 1000) + 1000 }] } } } };
  assert.equal((await signed(event)).status, 200);
  assert.equal(S.state.licences[0].status, 'cancelled');
  const buyer = S.state.users.find(function (u) { return u.email === 'buyer@example.com'; });
  assert.equal(S.planOf(buyer.id), null);
});

test('payment messages without a good signature are refused', async function () {
  const r = await fetch(SITE + '/api/stripe-webhook', { method: 'POST', headers: { 'Stripe-Signature': 't=1,v1=00' }, body: '{}' });
  assert.equal(r.status, 400);
});

test('reset password and contact pages work', async function () {
  const page = await newPage();
  await page.goto(SITE + '/reset.html');
  await axe(page, 'reset');
  await page.fill('#r-email', 'someone@example.com');
  await page.click('#reset-form button[type=submit]');
  await page.waitForSelector('#r-ok:not([hidden])');

  await page.goto(SITE + '/contact.html');
  await page.fill('#c-name', 'Aroha Smith');
  await page.fill('#c-email', 'aroha@example.com');
  await page.fill('#c-msg', 'Do you have a plan for 600 staff?');
  await page.click('#contact-form button[type=submit]');
  await page.waitForSelector('#c-sent:not([hidden])');
  assert.equal(S.state.emails.length, 2);
  assert.equal(S.state.emails[0].to, 'camcreative@icloud.com');
  assert.equal(S.state.emails[0].reply_to, 'aroha@example.com');
  assert.equal(S.state.emails[1].to, 'aroha@example.com');
  await axe(page, 'contact sent');
});
