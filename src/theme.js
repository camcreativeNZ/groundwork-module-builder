'use strict';
// Loads a theme folder (theme.yaml + fonts + optional logo), checks its colour contrast,
// and turns it into the CSS settings every module uses.
const fs = require('fs');
const path = require('path');
const { loadYaml } = require('./load');
const { check, list } = require('./schema');

const COLOUR_KEYS = ['bg', 'surface', 'surface-2', 'ink', 'ink-soft', 'line', 'accent', 'accent-ink', 'accent-soft', 'mark',
  'head-bg', 'head-ink', 'bar-bg', 'bar', 'focus', 'part-1', 'part-1-soft', 'part-2', 'part-2-soft', 'part-3', 'part-3-soft',
  'part-4', 'part-4-soft', 'right', 'right-soft', 'wrong', 'wrong-soft', 'warn', 'warn-soft', 'card-shadow'];

const font = { family: 'text', file: 'file', 'italic_file?': 'file', 'weights?': 'text', 'fallback?': 'text' };
const palette = {};
COLOUR_KEYS.forEach(function (k) { palette[k] = 'text'; });
const SCHEMA = {
  name: 'text',
  fonts: { heading: font, body: font, 'licences?': list('file') },
  'logo?': { file: 'file', alt: 'text' },
  'shape?': { 'radius?': 'text', 'button_radius?': 'text', 'heading_weight?': 'int', 'heading_size?': 'text', 'heading_tracking?': 'text', 'card_border?': 'text' },
  light: palette,
  dark: palette
};

// WCAG contrast pairs: [text or foreground, background, minimum ratio, what it's used for]
const PAIRS = [
  ['ink', 'bg', 4.5, 'body text on the page'], ['ink', 'surface', 4.5, 'body text on cards'], ['ink', 'surface-2', 4.5, 'text in text boxes'],
  ['ink', 'accent-soft', 4.5, 'text in tips'], ['ink', 'mark', 4.5, 'highlighted text'],
  ['ink-soft', 'bg', 4.5, 'secondary text on the page'], ['ink-soft', 'surface', 4.5, 'labels and notes on cards'], ['ink-soft', 'surface-2', 4.5, 'placeholder and slot text'],
  ['head-ink', 'head-bg', 4.5, 'the header'], ['accent', 'surface', 4.5, 'secondary buttons and question numbers'],
  ['accent-ink', 'accent', 4.5, 'main buttons'], ['right', 'bg', 4.5, 'success notes'],
  ['ink', 'right-soft', 4.5, 'correct feedback'], ['ink', 'wrong-soft', 4.5, 'incorrect feedback'], ['ink', 'warn-soft', 4.5, 'warnings'],
  ['part-1', 'part-1-soft', 4.5, 'part 1 tags'], ['part-2', 'part-2-soft', 4.5, 'part 2 tags'], ['part-3', 'part-3-soft', 4.5, 'part 3 tags'], ['part-4', 'part-4-soft', 4.5, 'part 4 tags'],
  ['ink', 'part-1-soft', 4.5, 'part 1 prompt lines'], ['ink', 'part-2-soft', 4.5, 'part 2 prompt lines'], ['ink', 'part-3-soft', 4.5, 'part 3 prompt lines'], ['ink', 'part-4-soft', 4.5, 'part 4 prompt lines'],
  ['focus', 'bg', 3, 'the keyboard focus ring on the page'], ['focus', 'surface', 3, 'the keyboard focus ring on cards'],
  ['bar', 'bar-bg', 3, 'the progress bar'], ['ink-soft', 'surface-2', 3, 'text box borders']
];

function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = [0, 2, 4].map(function (i) {
    const c = parseInt(m[1].substr(i, 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function loadTheme(dir) {
  const file = path.join(dir, 'theme.yaml');
  if (!fs.existsSync(file)) {
    return { problems: [{ level: 'error', file, line: null, where: '', message: 'there\'s no theme.yaml in this theme folder.' }] };
  }
  const y = loadYaml(file);
  if (!y.data) return { problems: y.problems };
  const ctx = { error: y.error, warn: y.warn, parts: {}, label: 'theme' };
  check(SCHEMA, y.data, [], ctx);
  const t = y.data;
  const files = [];
  function needFile(rel, p) {
    if (typeof rel !== 'string') return;
    if (!fs.existsSync(path.join(dir, rel))) y.error(p, 'can\'t find "' + rel + '" in the theme folder.');
    else files.push(rel);
  }
  if (t.fonts) {
    ['heading', 'body'].forEach(function (k) {
      if (!t.fonts[k]) return;
      needFile(t.fonts[k].file, ['fonts', k, 'file']);
      if (t.fonts[k].italic_file) needFile(t.fonts[k].italic_file, ['fonts', k, 'italic_file']);
    });
    (t.fonts.licences || []).forEach(function (f, i) { needFile(f, ['fonts', 'licences', i]); });
  }
  if (t.logo) needFile(t.logo.file, ['logo', 'file']);

  const contrast = [];
  ['light', 'dark'].forEach(function (mode) {
    const pal = t[mode];
    if (!pal || typeof pal !== 'object') return;
    COLOUR_KEYS.forEach(function (k) {
      if (k !== 'card-shadow' && typeof pal[k] === 'string' && lum(pal[k]) == null) y.error([mode, k], '"' + pal[k] + '" should be a colour written as #rrggbb.');
    });
    PAIRS.forEach(function (pair) {
      const r = pal[pair[0]] && pal[pair[1]] ? ratio(pal[pair[0]], pal[pair[1]]) : null;
      if (r == null) return;
      const ok = r >= pair[2];
      contrast.push({ mode, fg: pair[0], bg: pair[1], ratio: Math.round(r * 100) / 100, min: pair[2], use: pair[3], ok });
      if (!ok) y.error([mode, pair[0]], 'contrast for ' + pair[3] + ' is ' + r.toFixed(2) + ':1 (' + pair[0] + ' on ' + pair[1] + '). It needs at least ' + pair[2] + ':1 for WCAG AA. Darken or lighten one of these colours.');
    });
  });

  return { dir, data: t, files, problems: y.problems, contrast };
}

function vars(pal) {
  return COLOUR_KEYS.map(function (k) { return '--' + k + ': ' + pal[k] + ';'; }).join(' ');
}

function themeCss(theme) {
  const t = theme.data;
  const f = t.fonts;
  const s = t.shape || {};
  const ff = function (family, file, weights, style) {
    return '@font-face { font-family: "' + family + '"; font-style: ' + style + '; font-weight: ' + (weights || '400 700') + '; font-display: swap; src: url("fonts/' + path.basename(file) + '") format("woff2"); }';
  };
  const lines = ['/* Theme: ' + t.name + '. Generated from theme.yaml; edit that file, not this one. */',
    ff(f.heading.family, f.heading.file, f.heading.weights, 'normal'),
    ff(f.body.family, f.body.file, f.body.weights, 'normal')];
  if (f.body.italic_file) lines.push(ff(f.body.family, f.body.italic_file, f.body.weights, 'italic'));
  lines.push(':root { ' + vars(t.light) +
    ' --font-head: "' + f.heading.family + '", ' + (f.heading.fallback || 'sans-serif') + '; --font-body: "' + f.body.family + '", ' + (f.body.fallback || 'sans-serif') + ';' +
    ' --h-weight: ' + (s.heading_weight || 700) + '; --h-size: ' + (s.heading_size || '2rem') + '; --h-track: ' + (s.heading_tracking || '0') + ';' +
    ' --radius: ' + (s.radius || '12px') + '; --btn-radius: ' + (s.button_radius || '8px') + '; --card-border: ' + (s.card_border || '1px solid transparent') + '; --btn-shadow: none; }');
  lines.push('@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ' + vars(t.dark) + ' color-scheme: dark; } }');
  lines.push(':root[data-theme="dark"] { ' + vars(t.dark) + ' color-scheme: dark; }');
  return lines.join('\n') + '\n';
}

module.exports = { loadTheme, themeCss, ratio };
