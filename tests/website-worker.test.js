'use strict';
// Checks for the website server's small helpers: which plan opens which module, cookies and Stripe signatures.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const lib = () => import(pathToFileURL(path.join(__dirname, '..', 'website', 'worker', 'lib.js')).href);

test('Foundations opens only F modules; the full suite opens all; no plan opens nothing', async () => {
  const { planAllows } = await lib();
  assert.equal(planAllows('foundations', 'F1'), true);
  assert.equal(planAllows('foundations', 'F8'), true);
  assert.equal(planAllows('foundations', 'P1'), false);
  assert.equal(planAllows('full', 'L4'), true);
  assert.equal(planAllows('full', 'P10'), true);
  assert.equal(planAllows(null, 'F1'), false);
  assert.equal(planAllows('full', '../etc'), false);
  assert.equal(planAllows('full', ''), false);
});

test('readCookie finds the login cookie among others', async () => {
  const { readCookie } = await lib();
  assert.equal(readCookie('a=1; gw_session=abc%20def; b=2', 'gw_session'), 'abc def');
  assert.equal(readCookie('x_gw_session=nope', 'gw_session'), null);
  assert.equal(readCookie(null, 'gw_session'), null);
});

function sign(payload, secret, t) {
  const v1 = crypto.createHmac('sha256', secret).update(t + '.' + payload).digest('hex');
  return 't=' + t + ',v1=' + v1;
}

test('Stripe signatures: good ones pass, wrong, old or missing ones fail', async () => {
  const { verifyStripeSignature } = await lib();
  const now = Date.now();
  const t = Math.floor(now / 1000);
  const body = '{"type":"checkout.session.completed"}';
  assert.equal(await verifyStripeSignature(body, sign(body, 'whsec_test', t), 'whsec_test', now), true);
  assert.equal(await verifyStripeSignature(body + ' ', sign(body, 'whsec_test', t), 'whsec_test', now), false);
  assert.equal(await verifyStripeSignature(body, sign(body, 'whsec_other', t), 'whsec_test', now), false);
  assert.equal(await verifyStripeSignature(body, sign(body, 'whsec_test', t - 600), 'whsec_test', now), false);
  assert.equal(await verifyStripeSignature(body, null, 'whsec_test', now), false);
  assert.equal(await verifyStripeSignature(body, sign(body, 'whsec_test', t), '', now), false);
  // Stripe may send two v1 signatures while a secret is being changed; either may match.
  const two = sign(body, 'whsec_test', t) + ',v1=' + '0'.repeat(64);
  assert.equal(await verifyStripeSignature(body, two, 'whsec_test', now), true);
});
