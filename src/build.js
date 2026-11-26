'use strict';
// The generator: module.yaml in, web module folder and SCORM 2004 zip out.
const fs = require('fs');
const path = require('path');
const { validateModule } = require('./validate');
const { loadTheme, themeCss } = require('./theme');
const templates = require('./templates');
const { manifest } = require('./manifest');
const { makeZip } = require('./zip');
const { esc } = require('./text');
const { makeJobAid } = require('./jobaid');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_THEME = path.join(ROOT, 'themes', 'groundwork');
const RUNTIME = path.join(ROOT, 'runtime');

function renderPage(m, screens, theme, ctx) {
  const total = screens.length;
  const moduleName = m.id + ' ' + m.title;
  const logo = theme.data.logo ? '\n    <img class="brand" src="assets/theme/' + esc(path.basename(theme.data.logo.file)) + '" alt="' + esc(theme.data.logo.alt) + '">' : '';
  const sections = screens.map(function (s, i) {
    const n = i + 1;
    let attrs = ' data-title="' + esc(s.title) + '"';
    Object.keys(s.attrs || {}).forEach(function (k) { attrs += ' ' + k + '="' + esc(s.attrs[k]) + '"'; });
    return '<!-- Screen ' + n + ': ' + esc(s.template) + ' -->\n<section class="screen' + (s.cls ? ' ' + s.cls : '') + '"' + attrs + ' aria-labelledby="s' + n + 'h"' + (i ? ' hidden' : '') + '>\n  ' + s.html + '\n</section>';
  }).join('\n\n');
  return '<!doctype html>\n<html lang="' + esc(m.language || 'en') + '">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="generator" content="Groundwork module builder">\n<title>' + esc(moduleName) + '</title>\n' +
    '<link rel="stylesheet" href="assets/theme.css">\n<link rel="stylesheet" href="assets/styles.css">\n</head>\n' +
    '<body data-module="' + esc(moduleName) + '">\n<a class="skip" href="#main">Skip to content</a>\n\n' +
    '<header class="topbar">\n  <div class="wrap">' + logo + '\n    <p class="course">' + esc(m.level) + ' · ' + esc(m.id) + '</p>\n    <h1 class="title">' + esc(m.title) + '</h1>\n' +
    '    <div class="progress" role="progressbar" aria-label="Module progress" aria-valuemin="1" aria-valuemax="' + total + '" aria-valuenow="1" id="progress">\n' +
    '      <div class="progress-fill" id="progressFill"></div>\n    </div>\n    <p class="counter" id="counter" aria-live="polite">Screen 1 of ' + total + '</p>\n  </div>\n</header>\n\n' +
    '<main id="main" tabindex="-1"><div class="wrap">\n\n' + sections + '\n\n</div></main>\n\n' +
    '<nav class="navbar" aria-label="Module navigation">\n  <div class="wrap">\n    <button type="button" class="btn secondary" id="prevBtn">Back</button>\n    <button type="button" class="btn" id="nextBtn">Next</button>\n  </div>\n</nav>\n\n' +
    '<script src="assets/scorm.js"></script>\n<script src="assets/player.js"></script>\n</body>\n</html>\n';
}

// options: { module: path to module.yaml, out: output folder, theme: theme folder }
// Returns a report: { ok, problems, outDir, webDir, zipPath, files, screens, contrast }
async function build(options) {
  const moduleFile = path.resolve(options.module);
  const themeDir = path.resolve(options.theme || DEFAULT_THEME);
  const v = validateModule(moduleFile);
  const theme = loadTheme(themeDir);
  const problems = v.problems.concat(theme.problems || []);
  const report = { ok: false, module: moduleFile, theme: themeDir, problems, contrast: theme.contrast || [] };
  if (!v.ok || problems.some(function (p) { return p.level === 'error'; })) return report;

  const m = v.module;
  const moduleDir = path.dirname(moduleFile);
  const assets = new Set();
  const ctx = { parts: v.parts, module: m, moduleDir, addAsset: function (f) { assets.add(path.posix.normalize(f)); }, jobAids: [] };

  // First pass: work out screen numbers (some templates make several screens).
  let count = 0, quizScreen = null;
  m.screens.forEach(function (s) {
    const n = s.template === 'step-builder' ? s.steps.length : 1;
    if (s.template === 'knowledge-check') quizScreen = count + 1;
    count += n;
  });
  ctx.quizScreen = quizScreen;

  const screens = [];
  let quizTotal = 0;
  m.screens.forEach(function (s) {
    ctx.screenNo = screens.length + 1;
    templates.byName[s.template].render(s, ctx).forEach(function (r) {
      r.template = s.template;
      if (r.quiz) quizTotal = r.quiz.total;
      screens.push(r);
    });
  });

  const outDir = path.resolve(options.out || path.join(moduleDir, 'build'));
  const slug = m.id + '-' + String(m.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const webDir = path.join(outDir, 'web');
  fs.rmSync(webDir, { recursive: true, force: true });

  const files = {}; // published path -> Buffer or string
  files['index.html'] = renderPage(m, screens, theme, ctx);
  files['assets/theme.css'] = themeCss(theme);
  files['assets/styles.css'] = fs.readFileSync(path.join(RUNTIME, 'base.css'));
  files['assets/scorm.js'] = fs.readFileSync(path.join(RUNTIME, 'scorm.js'));
  files['assets/player.js'] = fs.readFileSync(path.join(RUNTIME, 'player.js'));
  theme.files.forEach(function (f) {
    const dest = theme.data.logo && f === theme.data.logo.file ? 'assets/theme/' + path.basename(f) : 'assets/fonts/' + path.basename(f);
    files[dest] = fs.readFileSync(path.join(themeDir, f));
  });
  Array.from(assets).sort().forEach(function (f) {
    if (f.startsWith('..') || path.isAbsolute(f)) throw new Error('Asset paths must stay inside the module folder: ' + f);
    files[f] = fs.readFileSync(path.join(moduleDir, f));
  });

  for (const ja of ctx.jobAids) {
    const pdf = await makeJobAid(m, ja.screen, theme, v.parts);
    files[ja.names.a4] = pdf.a4;
    files[ja.names.letter] = pdf.letter;
    if (pdf.pages > 1) problems.push({ level: 'warning', file: moduleFile, line: null, where: 'job aid', message: 'the job aid runs to ' + pdf.pages + ' pages. Shorten the table text to fit one page.' });
  }

  const scaled = quizTotal ? Math.round(m.pass_mark / quizTotal * 100) / 100 : null;
  const order = ['index.html', 'assets/styles.css', 'assets/theme.css', 'assets/scorm.js', 'assets/player.js'];
  const listed = order.concat(Object.keys(files).filter(function (f) { return order.indexOf(f) === -1; }));
  files['imsmanifest.xml'] = manifest(m, listed, scaled);

  Object.keys(files).forEach(function (f) {
    const dest = path.join(webDir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, files[f]);
  });
  const zipPath = path.join(outDir, slug + '-SCORM2004.zip');
  const zipOrder = ['imsmanifest.xml'].concat(listed);
  fs.writeFileSync(zipPath, makeZip(zipOrder.map(function (f) { return { name: f, data: files[f] }; })));

  return Object.assign(report, {
    ok: true, outDir, webDir, zipPath, files: zipOrder,
    screens: screens.map(function (s, i) { return { n: i + 1, title: s.title, template: s.template }; }),
    passMark: quizTotal ? m.pass_mark + ' of ' + quizTotal : null
  });
}

module.exports = { build, DEFAULT_THEME };
