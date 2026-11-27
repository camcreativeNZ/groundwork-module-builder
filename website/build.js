#!/usr/bin/env node
'use strict';
// Builds the Groundwork website into build/website/.
//   node website/build.js            the whole public site
//   node website/build.js --preview  also preview-home.html, the homepage without its document skeleton,
//                                    for publishing the site as a private preview page
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { loadTheme, themeCss } = require('../src/theme');
const api = require('../src');
const { page } = require('./src/layout');
const { home, pathwayStats } = require('./src/home');
const P = require('./src/pages');

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

function write(rel, html) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

async function build(preview) {
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
  top('pricing.html', 'Pricing · Groundwork AI Training', P.pricing(modules), 'pricing.html');
  top('how-it-works.html', 'How it works · Groundwork AI Training', P.howItWorks(), 'how-it-works.html');
  top('about.html', 'About · Groundwork AI Training', P.about(), 'about.html');
  top('contact.html', 'Contact · Groundwork AI Training', P.contact(), 'contact.html');
  top('login.html', 'Log in · Groundwork AI Training', P.login(), 'login.html');
  top('privacy.html', 'Privacy · Groundwork AI Training', P.legal('Privacy policy'));
  top('terms.html', 'Terms · Groundwork AI Training', P.legal('Terms of use'));

  pathwayStats(modules).forEach(function (p) {
    write('pathways/' + p.slug + '.html', page({ pre: '../', title: p.level + ' pathway · Groundwork AI Training', description: D, body: P.pathway(p, modules) }));
  });
  modules.forEach(function (m, i) {
    const next = modules[i + 1] && modules[i + 1].level === m.level ? modules[i + 1] : null;
    write('modules/' + m.id.toLowerCase() + '.html', page({ pre: '../', title: m.id + ' ' + m.title + ' · Groundwork AI Training', description: listings[m.id].summary, body: P.modulePage(m, listings[m.id], next) }));
  });

  // The free F3 demo: the real web module, built by the module builder
  const tmp = path.join(ROOT, 'build', '.website-f3');
  const report = await api.build({ module: path.join(ROOT, 'modules', 'F3', 'module.yaml'), out: tmp });
  if (!report.ok) { console.error('F3 did not build', report.problems); process.exit(1); }
  fs.cpSync(path.join(tmp, 'web'), path.join(OUT, 'try', 'f3'), { recursive: true });
  fs.rmSync(path.join(OUT, 'try', 'f3', 'imsmanifest.xml'), { force: true });
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('Built ' + path.relative(ROOT, OUT) + ': ' + modules.length + ' module pages, 5 pathway pages, 9 other pages, F3 demo.');
}

build(process.argv.includes('--preview'));
