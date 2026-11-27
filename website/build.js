#!/usr/bin/env node
'use strict';
// Builds the Groundwork website into build/website/.
//   node website/build.js            the site (fonts as separate files)
//   node website/build.js --preview  also a single self-contained preview.html (fonts inlined)
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { loadTheme, themeCss } = require('../src/theme');
const { home } = require('./src/home');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'build', 'website');
const THEME_DIR = path.join(ROOT, 'themes', 'groundwork');

function loadModules() {
  const dir = path.join(ROOT, 'modules');
  return fs.readdirSync(dir).filter(function (d) {
    return fs.existsSync(path.join(dir, d, 'module.yaml'));
  }).map(function (d) {
    const y = YAML.parse(fs.readFileSync(path.join(dir, d, 'module.yaml'), 'utf8'));
    return { id: y.id, title: y.title, level: y.level, minutes: y.minutes };
  });
}

function build(preview) {
  const theme = loadTheme(THEME_DIR);
  const errors = (theme.problems || []).filter(function (p) { return p.level === 'error'; });
  if (errors.length) { console.error(errors); process.exit(1); }
  const modules = loadModules();
  let tcss = themeCss(theme);
  const siteCss = fs.readFileSync(path.join(__dirname, 'src', 'site.css'), 'utf8');
  fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
  theme.files.filter(function (f) { return f.endsWith('.woff2') || f.endsWith('.txt'); }).forEach(function (f) {
    fs.copyFileSync(path.join(THEME_DIR, f), path.join(OUT, 'fonts', path.basename(f)));
  });
  const page = home(modules, { css: tcss + siteCss });
  fs.writeFileSync(path.join(OUT, 'index.html'), '<!doctype html>\n<html lang="en-NZ">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n' + page + '</body>\n</html>\n');
  if (preview) {
    tcss = tcss.replace(/url\("fonts\/([^"]+)"\)/g, function (_, f) {
      return 'url("data:font/woff2;base64,' + fs.readFileSync(path.join(OUT, 'fonts', f)).toString('base64') + '")';
    });
    // In the preview, links to pages that don't exist yet show a note instead of opening a blank page.
    const note = '<p id="preview-note" role="status" hidden style="position:fixed;left:50%;bottom:calc(1.5rem + env(safe-area-inset-bottom, 0px));transform:translateX(-50%);z-index:30;max-width:calc(100% - 32px);background:var(--ink);color:var(--bg);padding:.75rem 1.1rem;border-radius:10px;box-shadow:var(--card-shadow)">Preview only: this page comes in the next step.</p>' +
      '<script>(function(){var n=document.getElementById("preview-note"),t;document.addEventListener("click",function(e){var a=e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href");if(h.charAt(0)==="#")return;e.preventDefault();n.hidden=false;clearTimeout(t);t=setTimeout(function(){n.hidden=true;},2500);});})();</script>';
    fs.writeFileSync(path.join(OUT, 'preview.html'), home(modules, { css: tcss + siteCss }) + note);
  }
  console.log('Built ' + OUT + ' (' + modules.length + ' modules)');
}

build(process.argv.includes('--preview'));
