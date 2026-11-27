#!/usr/bin/env node
'use strict';
// Builds the Groundwork website into build/website/.
//   node website/build.js            the whole public site
//   node website/build.js --preview  also preview-home.html, the homepage without its document skeleton,
//                                    for publishing the site as a private preview page
//   node website/build.js --quick    builds only F3 of the modules (faster, for checking pages)
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { loadTheme, themeCss } = require('../src/theme');
const api = require('../src');
const { page } = require('./src/layout');
const { home, pathwayStats } = require('./src/home');
const P = require('./src/pages');
const A = require('./src/account-pages');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'website');
const THEME_DIR = path.join(ROOT, 'themes', 'groundwork');
const LEVELS = ['Foundations', 'Practitioner', 'Advanced', 'Manager', 'Leader'];

function loadModules() {
  const dir = path.join(ROOT, 'modules');
  return fs.readdirSync(dir).filter(function (d) {
    return fs.existsSync(path.join(dir, d, 'module.yaml'));
  }).map(function (d) {
    const y = YAML.parse(fs.readFileSync(path.join(dir, d, 'module.yaml'), 'utf8'));
    return { id: y.id, title: y.title, level: y.level, minutes: y.minutes };
  }).sort(function (a, b) {
    return LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10);
  });
}

// The public settings in wrangler.jsonc (the same ones the server uses). Comment lines start with //.
function siteSettings() {
  const text = fs.readFileSync(path.join(__dirname, 'wrangler.jsonc'), 'utf8').split('\n').filter(function (l) { return !/^\s*\/\//.test(l); }).join('\n');
  return JSON.parse(text).vars;
}

// The job aid PDF (A4) inside a built module, if it has one.
function jobAidFile(dir) {
  const a = path.join(dir, 'assets');
  if (!fs.existsSync(a)) return null;
  return fs.readdirSync(a).find(function (f) { return /-A4\.pdf$/.test(f); }) || null;
}

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

async function build(preview, skipModules) {
  const theme = loadTheme(THEME_DIR);
  const errors = (theme.problems || []).filter(function (p) { return p.level === 'error'; });
  if (errors.length) { console.error(errors); process.exit(1); }
  const modules = loadModules();
  const listings = YAML.parse(fs.readFileSync(path.join(__dirname, 'content', 'module-listings.yaml'), 'utf8'));
  const missing = modules.filter(function (m) { return !listings[m.id]; }).map(function (m) { return m.id; });
  if (missing.length) { console.error('No website summary for: ' + missing.join(', ')); process.exit(1); }

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });

  // Styles, script and fonts
  theme.files.filter(function (f) { return /\.(woff2|txt)$/.test(f); }).forEach(function (f) {
    fs.copyFileSync(path.join(THEME_DIR, f), path.join(OUT, 'fonts', path.basename(f)));
  });
  write('site.css', themeCss(theme) + fs.readFileSync(path.join(__dirname, 'src', 'site.css'), 'utf8'));
  write('site.js', fs.readFileSync(path.join(__dirname, 'src', 'site.js'), 'utf8'));

  // Pages
  const D = 'Short, scenario-based modules that teach everyone at work to use Claude well.';
  const top = function (file, title, body, current, extra) {
    write(file, page(Object.assign({ pre: '', title: title, description: D, body: body, current: current }, extra)));
  };
  top('index.html', 'Groundwork AI Training', home(modules));
  if (preview) write('preview-home.html', page({ pre: '', title: 'Groundwork AI Training', description: D, body: home(modules), fragment: true }));
  top('courses.html', 'Courses · Groundwork AI Training', P.courses(modules), 'courses.html');
  top('try-f3.html', 'Try a module free · Groundwork AI Training', P.tryF3(), 'try-f3.html');
  top('pricing.html', 'Pricing · Groundwork AI Training', P.pricing(modules), 'pricing.html', { account: true });
  top('how-it-works.html', 'How it works · Groundwork AI Training', P.howItWorks(), 'how-it-works.html');
  top('about.html', 'About · Groundwork AI Training', P.about(), 'about.html');
  top('contact.html', 'Contact · Groundwork AI Training', P.contact(), 'contact.html');
  // Account pages, and the browser settings they use
  const vars = siteSettings();
  write('config.js', '// Public settings for the login service (safe to show).\nwindow.GW_CONFIG = ' + JSON.stringify({
    siteUrl: vars.SITE_URL, supabaseUrl: vars.SUPABASE_URL, supabaseKey: vars.SUPABASE_PUBLISHABLE_KEY
  }) + ';\n');
  fs.mkdirSync(path.join(OUT, 'vendor'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js'), path.join(OUT, 'vendor', 'supabase.js'));
  write('account.js', fs.readFileSync(path.join(__dirname, 'src', 'account.js'), 'utf8'));
  const acct = { account: true };
  // Until the site is on its real domain, ask search engines not to list the test address.
  if (!/groundworkaitraining\.com/.test(vars.SITE_URL)) write('_headers', '/*\n  X-Robots-Tag: noindex\n');
  top('login.html', 'Log in · Groundwork AI Training', A.login(), 'login.html', acct);
  top('signup.html', 'Create your account · Groundwork AI Training', A.signup(), 'login.html', acct);
  top('reset.html', 'Reset your password · Groundwork AI Training', A.reset(), 'login.html', acct);
  top('404.html', 'Page not found · Groundwork AI Training', P.notFound(), undefined, { pre: '/' });
  top('privacy.html', 'Privacy · Groundwork AI Training', P.legal('Privacy policy'));
  top('terms.html', 'Terms · Groundwork AI Training', P.legal('Terms of use'));

  pathwayStats(modules).forEach(function (p) {
    write('pathways/' + p.slug + '.html', page({ pre: '../', title: p.level + ' pathway · Groundwork AI Training', description: D, body: P.pathway(p, modules) }));
  });
  modules.forEach(function (m, i) {
    const next = modules[i + 1] && modules[i + 1].level === m.level ? modules[i + 1] : null;
    write('modules/' + m.id.toLowerCase() + '.html', page({ pre: '../', title: m.id + ' ' + m.title + ' · Groundwork AI Training', description: listings[m.id].summary, body: P.modulePage(m, listings[m.id], next) }));
  });

  // Every module's web version, kept behind the login at /learn/<ID>/. F3 is also the free demo at /try/f3/.
  const tmp = path.join(ROOT, 'build', '.website-modules');
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const m of modules) {
    if (skipModules && m.id !== 'F3') continue;
    const report = await api.build({ module: path.join(ROOT, 'modules', m.id, 'module.yaml'), out: path.join(tmp, m.id) });
    if (!report.ok) { console.error(m.id + ' did not build', report.problems); process.exit(1); }
    const web = path.join(tmp, m.id, 'web');
    fs.rmSync(path.join(web, 'imsmanifest.xml'), { force: true });
    m.jobAid = jobAidFile(web);
    fs.cpSync(web, path.join(OUT, 'learn', m.id), { recursive: true });
    if (m.id === 'F3') fs.cpSync(web, path.join(OUT, 'try', 'f3'), { recursive: true });
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  top('my-learning.html', 'My learning · Groundwork AI Training', A.myLearning(modules), 'my-learning.html', acct);
  const catalogue = {};
  modules.forEach(function (m) { catalogue[m.id] = { title: m.title, level: m.level }; });
  top('play.html', 'Module · Groundwork AI Training', A.play() + '\n<script type="application/json" id="catalogue">' + JSON.stringify(catalogue).replace(/</g, '\\u003c') + '</script>', 'my-learning.html', acct);

  console.log('Built ' + path.relative(ROOT, OUT) + ': ' + modules.length + ' module pages, 5 pathway pages, account pages, ' + (skipModules ? 'F3 only' : modules.length + ' modules') + ' behind the login, F3 demo.');
}

build(process.argv.includes('--preview'), process.argv.includes('--quick'));
