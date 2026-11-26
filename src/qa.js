'use strict';
// Automatic QA run for a built module. It clicks through every screen with a pretend LMS,
// answers the questions wrongly then correctly, checks tracking, accessibility (axe-core,
// WCAG 2.2 AA) and phone layout, takes screenshots, and writes a report for the QA reviewer.
const fs = require('fs');
const path = require('path');
const { launch } = require('./browser');
const { mockLms } = require('./mocklms');
const { esc } = require('./text');

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function runQa(buildReport) {
  const webDir = buildReport.webDir;
  const qaDir = path.join(buildReport.outDir, 'qa');
  fs.rmSync(qaDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(qaDir, 'screens'), { recursive: true });
  // Serve the module over a local web server, the way an LMS or website would.
  const server = await serve(webDir);
  const origin = 'http://127.0.0.1:' + server.address().port;
  const url = origin + '/index.html';
  const axePath = require.resolve('axe-core');
  const checks = [];
  const screens = buildReport.screens.map(function (s) { return Object.assign({ shots: {}, axe: { light: [], dark: [] }, phoneOk: true }, s); });
  const total = screens.length;
  function check(name, ok, detail) { checks.push({ name, ok: !!ok, detail: detail || '' }); }
  const pad = function (n) { return String(n).padStart(2, '0'); };

  const browser = await launch();
  try {
    // ---------- Pass 1: full click-through with the pretend LMS (desktop, light) ----------
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
    const outside = [], errors = [];
    page.on('request', function (r) { if (!/^(data|blob):/.test(r.url()) && r.url().indexOf(origin) !== 0) outside.push(r.url()); });
    page.on('pageerror', function (e) { errors.push(e.message); });
    page.on('console', function (m) { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(mockLms, {});
    await page.goto(url);
    await page.addScriptTag({ path: axePath });
    const lms = function () { return page.evaluate(function () { return window.__lms.data; }); };

    let d = await lms();
    check('Connects to the LMS and marks the module as started', d['cmi.completion_status'] === 'incomplete', 'completion_status = ' + d['cmi.completion_status']);

    let sawQuiz = false;
    for (let i = 0; i < total; i++) {
      const sc = screens[i];
      const counter = await page.textContent('#counter');
      check('Screen ' + (i + 1) + ' shows the right counter', counter === 'Screen ' + (i + 1) + ' of ' + total + ': ' + sc.title, counter);
      if (i > 0) {
        const focused = await page.evaluate(function () { return document.activeElement && document.activeElement.id; });
        check('Screen ' + (i + 1) + ': focus moves to the heading', focused === 's' + (i + 1) + 'h', 'focus on #' + focused);
      }
      d = await lms();
      check('Screen ' + (i + 1) + ': bookmark saved', d['cmi.location'] === String(i), 'cmi.location = ' + d['cmi.location']);

      const shot = 'screens/' + pad(i + 1) + '-desktop.png';
      await page.screenshot({ path: path.join(qaDir, shot), fullPage: true });
      sc.shots.desktop = shot;

      // Try every interaction on the screen.
      const scr = page.locator('.screen').nth(i);
      const reveals = scr.locator('[data-reveal]');
      for (let k = 0; k < await reveals.count(); k++) {
        await reveals.nth(k).click();
        const open = await reveals.nth(k).getAttribute('aria-expanded');
        check('Screen ' + (i + 1) + ': reveal button ' + (k + 1) + ' opens', open === 'true');
      }
      const flips = scr.locator('.flip');
      for (let k = 0; k < await flips.count(); k++) {
        await flips.nth(k).focus(); await page.keyboard.press('Enter');
        check('Screen ' + (i + 1) + ': card ' + (k + 1) + ' turns over by keyboard', (await flips.nth(k).getAttribute('aria-pressed')) === 'true');
      }
      const tries = scr.locator('textarea[data-try]');
      if (await tries.count()) {
        for (let k = 0; k < await tries.count(); k++) await tries.nth(k).fill('Sample answer ' + (k + 1));
        const joined = await scr.locator('.joined-prompt').textContent();
        const want = [];
        for (let k = 0; k < await tries.count(); k++) want.push('Sample answer ' + (k + 1));
        check('Screen ' + (i + 1) + ': the parts join into one prompt', joined === want.join('\n\n'), JSON.stringify(joined));
        await scr.locator('.copy-btn').click();
        await page.waitForTimeout(150);
        check('Screen ' + (i + 1) + ': Copy button responds', ((await scr.locator('.copy-status').textContent()) || '').length > 0, await scr.locator('.copy-status').textContent());
      }
      if (await scr.locator('#quiz').count()) {
        sawQuiz = true;
        const n = await page.locator('#quiz .q').count();
        const pass = parseInt(await page.getAttribute('#quiz', 'data-pass'), 10);
        await page.click('#submitQuiz');
        check('Quiz: asks the learner to answer everything first', /Please answer all/.test(await page.textContent('#result')));
        await answerAll(page, false);
        await page.click('#submitQuiz');
        let res = await page.textContent('#result');
        d = await lms();
        check('Quiz: all wrong answers give a fail', /You scored 0 out of/.test(res) && d['cmi.success_status'] === 'failed', res + ' / success_status = ' + d['cmi.success_status']);
        await page.screenshot({ path: path.join(qaDir, 'screens/' + pad(i + 1) + '-quiz-fail.png'), fullPage: true });
        sc.shots.fail = 'screens/' + pad(i + 1) + '-quiz-fail.png';
        await page.click('#retryQuiz');
        check('Quiz: Try again clears the answers', (await page.locator('#quiz input:checked').count()) === 0);
        await answerAll(page, true);
        await page.click('#submitQuiz');
        res = await page.textContent('#result');
        d = await lms();
        check('Quiz: all right answers give a pass', new RegExp('You scored ' + n + ' out of ' + n).test(res) && d['cmi.success_status'] === 'passed', res + ' / success_status = ' + d['cmi.success_status']);
        check('Quiz: score sent to the LMS', d['cmi.score.raw'] === String(n) && d['cmi.score.max'] === String(n) && d['cmi.score.scaled'] === '1.00',
          'raw ' + d['cmi.score.raw'] + ', max ' + d['cmi.score.max'] + ', scaled ' + d['cmi.score.scaled']);
        check('Quiz: pass mark is at least 80%', pass / n >= 0.8, pass + ' of ' + n);
        await page.screenshot({ path: path.join(qaDir, 'screens/' + pad(i + 1) + '-quiz-pass.png'), fullPage: true });
        sc.shots.pass = 'screens/' + pad(i + 1) + '-quiz-pass.png';
      }

      sc.axe.light = await axe(page);
      if (i < total - 1) await page.click('#nextBtn');
    }
    d = await lms();
    check('Module is marked complete', d['cmi.completion_status'] === 'completed', 'completion_status = ' + d['cmi.completion_status']);
    if (await page.locator('.finish').count()) {
      check('Completion message shows on the last screen', /completed this module/.test(await page.textContent('.finish')), await page.textContent('.finish'));
    }
    await page.evaluate(function () { window.dispatchEvent(new Event('pagehide')); });
    d = await lms();
    const calls = await page.evaluate(function () { return window.__lms.calls; });
    check('Closes the LMS session properly', d['cmi.exit'] === 'normal' && calls.indexOf('Terminate') !== -1, 'exit = ' + d['cmi.exit']);
    check('No calls to outside websites', outside.length === 0, outside.join(', '));
    check('No script errors', errors.length === 0, errors.join(' | '));
    if (!sawQuiz) check('No knowledge check: completion is recorded on the last screen', d['cmi.completion_status'] === 'completed');
    await page.close();

    // ---------- Pass 2: resume ----------
    const resume = await browser.newPage();
    await resume.addInitScript(mockLms, { 'cmi.location': String(total - 1), 'cmi.completion_status': 'completed', 'cmi.success_status': 'passed', 'cmi.score.raw': '5' });
    await resume.goto(url);
    check('Resumes on the screen the learner left', (await resume.textContent('#counter')).indexOf('Screen ' + total + ' of') === 0);
    await resume.close();

    // ---------- Pass 3: no LMS (web version) ----------
    const plain = await browser.newPage();
    const plainErrors = [];
    plain.on('pageerror', function (e) { plainErrors.push(e.message); });
    await plain.goto(url);
    for (let i = 0; i < total - 1; i++) await plain.click('#nextBtn');
    check('Works without an LMS (web version)', plainErrors.length === 0, plainErrors.join(' | '));
    await plain.close();

    // ---------- Pass 4: dark mode screenshots and accessibility ----------
    const dark = await browser.newPage({ viewport: { width: 1200, height: 900 }, colorScheme: 'dark' });
    await dark.goto(url);
    await dark.addScriptTag({ path: axePath });
    for (let i = 0; i < total; i++) {
      const shot = 'screens/' + pad(i + 1) + '-dark.png';
      await dark.screenshot({ path: path.join(qaDir, shot), fullPage: true });
      screens[i].shots.dark = shot;
      screens[i].axe.dark = await axe(dark);
      if (i < total - 1) await dark.click('#nextBtn');
    }
    await dark.close();

    // ---------- Pass 5: phone ----------
    const phone = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
    await phone.goto(url);
    for (let i = 0; i < total; i++) {
      const shot = 'screens/' + pad(i + 1) + '-phone.png';
      await phone.screenshot({ path: path.join(qaDir, shot), fullPage: true });
      screens[i].shots.phone = shot;
      screens[i].phoneOk = await phone.evaluate(function () { return document.documentElement.scrollWidth <= window.innerWidth; });
      if (i < total - 1) await phone.click('#nextBtn');
    }
    await phone.close();
  } finally {
    await browser.close();
    server.close();
  }

  screens.forEach(function (s) {
    const issues = s.axe.light.concat(s.axe.dark);
    check('Screen ' + s.n + ': no accessibility problems (light and dark)', issues.length === 0, issues.map(function (v) { return v.id + ': ' + v.help; }).join(' | '));
    check('Screen ' + s.n + ': fits a phone with no sideways scrolling', s.phoneOk);
  });

  const result = {
    module: buildReport.module, when: new Date().toISOString(), ok: checks.every(function (c) { return c.ok; }),
    passed: checks.filter(function (c) { return c.ok; }).length, total: checks.length, checks, screens,
    problems: buildReport.problems, contrast: buildReport.contrast, zip: buildReport.zipPath
  };
  fs.writeFileSync(path.join(qaDir, 'report.json'), JSON.stringify(result, null, 2));
  fs.writeFileSync(path.join(qaDir, 'report.html'), reportHtml(result, buildReport));
  result.reportPath = path.join(qaDir, 'report.html');
  return result;
}

function serve(dir) {
  const http = require('http');
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.xml': 'application/xml', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.txt': 'text/plain' };
  const root = path.resolve(dir);
  const server = http.createServer(function (req, res) {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, rel);
    if (file.indexOf(root) !== 0 || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(function (resolve) { server.listen(0, '127.0.0.1', function () { resolve(server); }); });
}

async function axe(page) {
  const r = await page.evaluate(function (tags) {
    document.querySelectorAll('.screen:not([hidden]) [data-reveal][aria-expanded="false"]').forEach(function (b) { b.click(); });
    return window.axe.run(document, { runOnly: tags });
  }, AXE_TAGS);
  return r.violations.map(function (v) { return { id: v.id, help: v.help, nodes: v.nodes.map(function (n) { return n.target.join(' '); }) }; });
}

async function answerAll(page, right) {
  const qs = page.locator('#quiz .q');
  for (let i = 0; i < await qs.count(); i++) {
    const q = qs.nth(i);
    if (await q.evaluate(function (el) { return el.classList.contains('match'); })) {
      const slots = q.locator('.slot');
      const correct = [];
      for (let k = 0; k < await slots.count(); k++) correct.push(await slots.nth(k).getAttribute('data-correct'));
      for (let k = 0; k < correct.length; k++) {
        const part = right ? correct[k] : correct[(k + 1) % correct.length];
        await q.locator('.chip[data-part="' + part + '"]').click();
        await slots.nth(k).click();
      }
    } else {
      const answer = await q.getAttribute('data-answer');
      const options = q.locator('input[type=radio]');
      for (let k = 0; k < await options.count(); k++) {
        const v = await options.nth(k).getAttribute('value');
        if ((right && v === answer) || (!right && v !== answer)) { await options.nth(k).check(); break; }
      }
    }
  }
}

function reportHtml(r, b) {
  const fails = r.checks.filter(function (c) { return !c.ok; });
  const warn = (r.problems || []).filter(function (p) { return p.level === 'warning'; });
  const row = function (c) { return '<tr class="' + (c.ok ? 'ok' : 'bad') + '"><td>' + (c.ok ? '✓' : '✗') + '</td><td>' + esc(c.name) + '</td><td>' + esc(c.detail) + '</td></tr>'; };
  const img = function (src, alt) { return src ? '<a href="' + src + '"><img src="' + src + '" alt="' + esc(alt) + '" loading="lazy"></a>' : ''; };
  return '<!doctype html><html lang="en-NZ"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>QA report</title><style>' +
    ':root{--bg:#eef2f6;--card:#fff;--ink:#16233a;--soft:#55627a;--ok:#1d6b46;--bad:#a3261b;--line:#dbe2ea}' +
    '@media (prefers-color-scheme:dark){:root{--bg:#0e1420;--card:#18202e;--ink:#e8edf5;--soft:#a3aec2;--ok:#77d1a2;--bad:#ff9a8e;--line:#2b3547}}' +
    'body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,"Segoe UI",Arial,sans-serif}main{max-width:1100px;margin:0 auto;padding:24px 16px}' +
    'h1{margin:0 0 4px}.meta{color:var(--soft);margin:0 0 20px}.sum{background:var(--card);border-radius:14px;padding:16px 20px;margin-bottom:20px;border-left:8px solid ' + (r.ok ? 'var(--ok)' : 'var(--bad)') + '}' +
    'table{width:100%;border-collapse:collapse;background:var(--card);border-radius:14px;overflow:hidden;margin-bottom:24px}td,th{text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);vertical-align:top;font-size:14px}' +
    'tr.ok td:first-child{color:var(--ok);font-weight:700}tr.bad td{color:var(--bad);font-weight:600}details{margin-bottom:24px}summary{cursor:pointer;font-weight:600}' +
    '.screen{background:var(--card);border-radius:14px;padding:16px;margin-bottom:16px}.screen h3{margin:0 0 10px}.shots{display:grid;grid-template-columns:2fr 2fr 1fr;gap:12px;align-items:start}' +
    '.shots img{width:100%;border:1px solid var(--line);border-radius:8px;display:block}.shots p{margin:0 0 4px;font-size:13px;color:var(--soft)}@media(max-width:700px){.shots{grid-template-columns:1fr}}' +
    '</style></head><body><main><h1>QA report: ' + esc(path.basename(path.dirname(r.module))) + '</h1>' +
    '<p class="meta">' + esc(new Date(r.when).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' })) + ' · ' + r.screens.length + ' screens · ' + esc(path.basename(r.zip)) + '</p>' +
    '<div class="sum"><strong>' + (r.ok ? 'All ' + r.total + ' checks passed.' : fails.length + ' of ' + r.total + ' checks failed.') + '</strong> ' +
    'Colour contrast: ' + r.contrast.filter(function (c) { return c.ok; }).length + ' of ' + r.contrast.length + ' pass.' +
    (warn.length ? '<br>Warnings: ' + warn.map(function (w) { return esc(w.message); }).join('; ') : '') + '</div>' +
    (fails.length ? '<h2>Failed checks</h2><table>' + fails.map(row).join('') + '</table>' : '') +
    '<details><summary>All checks (' + r.total + ')</summary><table>' + r.checks.map(row).join('') + '</table></details>' +
    '<h2>Screens</h2><p class="meta">Select a screenshot to see it full size.</p>' +
    r.screens.map(function (s) {
      return '<section class="screen"><h3>' + s.n + '. ' + esc(s.title) + ' <small style="color:var(--soft);font-weight:400">' + esc(s.template) + '</small></h3><div class="shots">' +
        '<div><p>Desktop, light</p>' + img(s.shots.desktop, 'Screen ' + s.n + ' on desktop in light mode') + '</div>' +
        '<div><p>Desktop, dark</p>' + img(s.shots.dark, 'Screen ' + s.n + ' on desktop in dark mode') + '</div>' +
        '<div><p>Phone</p>' + img(s.shots.phone, 'Screen ' + s.n + ' on a phone') + '</div></div>' +
        (s.shots.fail ? '<div class="shots" style="margin-top:12px"><div><p>After a fail</p>' + img(s.shots.fail, 'Quiz after a fail') + '</div><div><p>After a pass</p>' + img(s.shots.pass, 'Quiz after a pass') + '</div></div>' : '') +
        '</section>';
    }).join('') + '</main></body></html>';
}

module.exports = { runQa };
