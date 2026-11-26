'use strict';
// End-to-end test: builds F3 from its module file, then clicks through it in a real browser
// with a pretend LMS, and checks tracking, accessibility and phone layout.
// Run with: npm test   (needs Playwright's Chromium: npx playwright install chromium)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { build } = require('../src');
const { mockLms } = require('./helpers');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'output', 'F3');
let report, browser, url;

test.before(async function () {
  report = build({ module: path.join(ROOT, 'modules/F3/module.yaml'), out: OUT });
  assert.ok(report.ok, JSON.stringify(report.problems, null, 2));
  url = 'file://' + path.join(report.webDir, 'index.html');
  browser = await chromium.launch();
});
test.after(async function () { if (browser) await browser.close(); });

async function open(state, opts) {
  const page = await browser.newPage(opts || {});
  await page.addInitScript(mockLms(), state || {});
  await page.goto(url);
  return page;
}
const lms = function (page) { return page.evaluate(function () { return window.__lms.data; }); };
async function goTo(page, n) { for (let i = 1; i < n; i++) await page.click('#nextBtn'); }

async function answer(page, right) {
  const picks = right ? ['b', 'c', 'a', 'b'] : ['a', 'c', 'a', 'b'];
  await page.check('input[name=q1][value=' + picks[0] + ']');
  await page.check('input[name=q2][value=' + picks[1] + ']');
  await page.check('input[name=q3][value=' + picks[2] + ']');
  await page.check('input[name=q5][value=' + picks[3] + ']');
  for (const part of ['Goal', 'Context', 'Format']) {   // click alternative to drag and drop
    await page.click('.chip[data-part=' + part + ']');
    await page.click('.slot[data-correct=' + part + ']');
  }
}

test('builds 8 screens, a pass mark of 4 of 5, and a zip whose manifest lists every file', function () {
  assert.strictEqual(report.screens.length, 8);
  assert.strictEqual(report.passMark, '4 of 5');
  const manifest = fs.readFileSync(path.join(report.webDir, 'imsmanifest.xml'), 'utf8');
  assert.match(manifest, /<schemaversion>2004 4th Edition<\/schemaversion>/);
  assert.match(manifest, /<imsss:minNormalizedMeasure>0.8<\/imsss:minNormalizedMeasure>/);
  report.files.filter(function (f) { return f !== 'imsmanifest.xml'; }).forEach(function (f) {
    assert.ok(manifest.includes('href="' + f + '"'), f + ' missing from manifest');
    assert.ok(fs.existsSync(path.join(report.webDir, f)), f + ' missing from web folder');
  });
  assert.ok(fs.statSync(report.zipPath).size > 100000);
});

test('makes no calls to outside websites', async function () {
  const page = await browser.newPage();
  const outside = [];
  page.on('request', function (r) { if (!r.url().startsWith('file://')) outside.push(r.url()); });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  assert.deepStrictEqual(outside, []);
  const fontsOk = await page.evaluate(async function () { await document.fonts.ready; return document.fonts.check('700 16px "Plus Jakarta Sans"') && document.fonts.check('16px "Source Sans 3"'); });
  assert.ok(fontsOk, 'bundled fonts should load');
  await page.close();
});

test('tracks a fail, a retry and a pass, and finishes normally', async function () {
  const page = await open();
  let d = await lms(page);
  assert.strictEqual(d['cmi.completion_status'], 'incomplete');
  assert.strictEqual(d['cmi.score.max'], '5');
  await goTo(page, 7);
  assert.strictEqual((await lms(page))['cmi.location'], '6');
  assert.strictEqual(await page.textContent('#counter'), 'Screen 7 of 8: Check your learning');

  await page.click('#submitQuiz');
  assert.match(await page.textContent('#result'), /Please answer all five questions first/);

  await answer(page, false);
  await page.click('#submitQuiz');
  assert.match(await page.textContent('#result'), /You scored 4 out of 5/);
  // 4 of 5 passes, so check a real fail by retrying with two wrong
  d = await lms(page);
  assert.strictEqual(d['cmi.success_status'], 'passed');
  await page.close();

  const p2 = await open();
  await goTo(p2, 7);
  await p2.check('input[name=q1][value=a]'); await p2.check('input[name=q2][value=a]');
  await p2.check('input[name=q3][value=a]'); await p2.check('input[name=q5][value=b]');
  for (const part of ['Goal', 'Context', 'Format']) { await p2.click('.chip[data-part=' + part + ']'); await p2.click('.slot[data-correct=' + part + ']'); }
  await p2.click('#submitQuiz');
  assert.match(await p2.textContent('#result'), /You scored 3 out of 5.*You need 4 to pass/);
  d = await lms(p2);
  assert.strictEqual(d['cmi.success_status'], 'failed');
  assert.strictEqual(d['cmi.score.raw'], '3');
  await p2.click('#nextBtn');
  assert.match(await p2.textContent('.finish'), /go back and pass the questions on screen 7/);
  await p2.click('#prevBtn');
  await p2.click('#retryQuiz');
  await answer(p2, true);
  await p2.click('#submitQuiz');
  assert.match(await p2.textContent('#result'), /You scored 5 out of 5.*Well done/);
  d = await lms(p2);
  assert.strictEqual(d['cmi.success_status'], 'passed');
  assert.strictEqual(d['cmi.score.raw'], '5');
  assert.strictEqual(d['cmi.score.scaled'], '1.00');
  assert.strictEqual(d['cmi.completion_status'], 'completed');
  await p2.click('#nextBtn');
  assert.strictEqual(await p2.textContent('.finish'), 'You\'ve completed this module.');
  await p2.evaluate(function () { window.dispatchEvent(new Event('pagehide')); });
  d = await lms(p2);
  assert.strictEqual(d['cmi.exit'], 'normal');
  assert.ok((await p2.evaluate(function () { return window.__lms.calls; })).includes('Terminate'));
  await p2.close();
});

test('resumes where the learner left off and keeps their pass', async function () {
  const page = await open({ 'cmi.location': '4', 'cmi.completion_status': 'completed', 'cmi.success_status': 'passed', 'cmi.score.raw': '5' });
  assert.strictEqual(await page.textContent('#counter'), 'Screen 5 of 8: Format');
  await goTo(page, 4);
  assert.strictEqual(await page.textContent('.finish'), 'You\'ve completed this module.');
  assert.strictEqual((await lms(page))['cmi.completion_status'], 'completed');
  await page.close();
});

test('works with no LMS at all (web version)', async function () {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', function (e) { errors.push(e.message); });
  await page.goto(url);
  await goTo(page, 7);
  await answer(page, true);
  await page.click('#submitQuiz');
  assert.match(await page.textContent('#result'), /You scored 5 out of 5/);
  assert.deepStrictEqual(errors, []);
  await page.close();
});

test('moves focus to the new screen heading on Next and Back', async function () {
  const page = await browser.newPage();
  await page.goto(url);
  await page.click('#nextBtn');
  assert.strictEqual(await page.evaluate(function () { return document.activeElement.id; }), 's2h');
  await page.click('#prevBtn');
  assert.strictEqual(await page.evaluate(function () { return document.activeElement.id; }), 's1h');
  await page.close();
});

test('the interactions work by keyboard', async function () {
  const page = await browser.newPage();
  await page.goto(url);
  await page.focus('[data-reveal]'); await page.keyboard.press('Enter');
  assert.strictEqual(await page.isVisible('#reveal1'), true);
  await page.click('#nextBtn');
  await page.focus('.flip'); await page.keyboard.press('Space');
  assert.strictEqual(await page.getAttribute('.flip', 'aria-pressed'), 'true');
  for (let i = 0; i < 4; i++) await page.click('#nextBtn');   // on to screen 6
  await page.fill('#try6_1', 'Write an update');
  await page.fill('#try6_3', 'Five bullets');
  assert.strictEqual(await page.textContent('.joined-prompt'), 'Write an update\n\nFive bullets');
  await page.close();
});

for (const scheme of ['light', 'dark']) {
  test('passes automatic accessibility checks (WCAG 2.2 AA) on every screen in ' + scheme + ' mode', async function () {
    const page = await browser.newPage({ colorScheme: scheme });
    await page.goto(url);
    await page.addScriptTag({ path: require.resolve('axe-core') });
    const found = [];
    for (let i = 0; i < 8; i++) {
      await page.evaluate(function () {
        document.querySelectorAll('[data-reveal]').forEach(function (b) { if (b.getAttribute('aria-expanded') === 'false') b.click(); });
      });
      const r = await page.evaluate(function () {
        return window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] });
      });
      r.violations.forEach(function (v) { found.push('screen ' + (i + 1) + ': ' + v.id + ' ' + v.nodes.map(function (n) { return n.target.join(' '); }).join(', ')); });
      if (i < 7) await page.click('#nextBtn');
    }
    assert.deepStrictEqual(found, []);
    await page.close();
  });
}

test('fits a phone screen with no sideways scrolling', async function () {
  const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
  await page.goto(url);
  for (let i = 0; i < 8; i++) {
    const wide = await page.evaluate(function () { return document.documentElement.scrollWidth > window.innerWidth; });
    assert.strictEqual(wide, false, 'screen ' + (i + 1) + ' scrolls sideways');
    if (i < 7) await page.click('#nextBtn');
  }
  await page.close();
});
