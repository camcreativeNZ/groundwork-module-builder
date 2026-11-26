'use strict';
// Makes the one-page job aid PDFs (A4 and US Letter) from a take-away screen's table,
// in the house style, so nobody has to design them by hand.
const fs = require('fs');
const path = require('path');
const { esc, inline } = require('./text');
const { launch } = require('./browser');

function cardHtml(m, s, theme, parts) {
  const t = theme.data;
  const L = t.light;
  // Fonts are embedded as data so the PDF renderer can always reach them.
  const fontUrl = function (f) { return 'data:font/woff2;base64,' + fs.readFileSync(path.join(theme.dir, f)).toString('base64'); };
  const ja = s.job_aid;
  const cols = s.table.columns;
  const cards = s.table.rows.map(function (r, i) {
    const p = r.part ? parts[r.part] : null;
    const n = p ? p.n : null;
    const colour = n ? 'var(--part-' + n + ')' : 'var(--accent)';
    const soft = n ? 'var(--part-' + n + '-soft)' : 'var(--accent-soft)';
    const label = r.label || (p && p.label);
    const rest = r.cells.slice(1).map(function (c, k) {
      return '<p class="lab">' + esc(cols[k + 2]) + '</p><p>' + inline(c) + '</p>';
    }).join('');
    return '<section class="card" style="background:' + soft + '"><div class="num" style="color:' + colour + '">' + (n || i + 1) + '</div>' +
      '<div><h2 style="color:' + colour + '">' + esc(label) + '</h2><p class="q">' + inline(r.cells[0]) + '</p>' + rest + '</div></section>';
  }).join('\n');
  const vars = Object.keys(L).map(function (k) { return '--' + k + ':' + L[k] + ';'; }).join('');
  return '<!doctype html><html lang="' + esc(m.language || 'en') + '"><head><meta charset="utf-8"><style>' +
    '@font-face{font-family:H;src:url("' + fontUrl(t.fonts.heading.file) + '");font-weight:200 800}' +
    '@font-face{font-family:B;src:url("' + fontUrl(t.fonts.body.file) + '");font-weight:200 900}' +
    ':root{' + vars + '}' +
    '@page{margin:16mm 15mm}*{box-sizing:border-box}body{margin:0;font-family:B,Arial,sans-serif;color:var(--ink);font-size:10.5pt;line-height:1.45}' +
    '.kicker{font-family:H;font-size:8.5pt;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin:0 0 2mm}' +
    'h1{font-family:H;font-size:24pt;margin:0 0 2mm;letter-spacing:-.02em}.intro{margin:0 0 7mm;color:var(--ink-soft)}' +
    '.card{display:grid;grid-template-columns:22mm 1fr;border-radius:10px;padding:6mm 6mm 5mm;margin-bottom:4.5mm;break-inside:avoid;box-shadow:0 1px 2px rgba(22,35,58,.06),0 6px 16px rgba(22,35,58,.06)}' +
    '.num{font-family:H;font-weight:800;font-size:22pt;line-height:1}h2{font-family:H;font-size:15pt;margin:0 0 1.5mm}' +
    '.q{font-weight:700;margin:0 0 3mm}.lab{font-family:H;font-size:7pt;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);margin:0}.lab+p{margin:0 0 2mm}' +
    '.together{border:1px solid var(--line);border-radius:10px;padding:5mm 6mm;margin:2mm 0 5mm;break-inside:avoid}.together p{margin:0}.together .t{font-weight:700;margin-bottom:2mm}' +
    '.foot{margin:0 0 4mm}.compact .card{padding:4.5mm 6mm 3.5mm;margin-bottom:3.5mm}.compact .intro{margin-bottom:5mm}.compact .q{margin-bottom:2mm}.ver{position:fixed;bottom:0;font-size:7.5pt;color:var(--ink-soft)}' +
    '</style></head><body' + (s.table.rows.length >= 4 ? ' class="compact"' : '') + '>' +
    '<p class="kicker">' + esc(m.level) + ' · ' + esc(m.id) + ' ' + esc(m.title) + '</p>' +
    '<h1>' + esc(ja.title) + '</h1>' + (ja.intro ? '<p class="intro">' + inline(ja.intro) + '</p>' : '') + cards +
    (ja.all_together ? '<div class="together"><p class="t">All together:</p><p>' + inline(ja.all_together) + '</p></div>' : '') +
    (ja.footer ? '<p class="foot">' + inline(ja.footer) + '</p>' : '') +
    '<p class="ver">Version ' + esc(m.version || 1) + '.0 · Groundwork AI Training</p></body></html>';
}

function fileNames(m, s) {
  const base = 'assets/' + m.id.toLowerCase() + '-' + String(s.job_aid.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { a4: base + '-A4.pdf', letter: base + '-Letter.pdf' };
}

async function makeJobAid(m, s, theme, parts) {
  const html = cardHtml(m, s, theme, parts);
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(function () { return document.fonts.ready; });
    const a4 = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' } });
    const letter = await page.pdf({ format: 'Letter', printBackground: true, margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' } });
    const count = function (buf) { return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length; };
    return { a4, letter, html, pages: Math.max(count(a4), count(letter)) };
  } finally { await browser.close(); }
}

module.exports = { makeJobAid, fileNames, cardHtml };
