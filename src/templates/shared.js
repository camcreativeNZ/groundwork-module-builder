'use strict';
const fs = require('fs');
const path = require('path');
const { esc, inline, blocks } = require('../text');
const { custom, check } = require('../schema');

function partTag(id, ctx) {
  const p = ctx.parts[id];
  return p ? '<span class="part-tag p' + p.n + '">' + p.n + '</span>' : '';
}
function partClass(id, ctx) { const p = ctx.parts[id]; return p ? 'p' + p.n : ''; }
function partLabel(id, ctx) { const p = ctx.parts[id]; return p ? p.label : ''; }

// Content blocks: a list where each item is a paragraph of text, or one of
//   - tip: ...           - ticks: [...]           - compare: { weak, better }
const BLOCK_SCHEMAS = {
  tip: 'md',
  ticks: { $list: 'md', min: 1 },
  compare: { weak: 'md', better: 'md', 'weak_label?': 'text', 'better_label?': 'text' }
};
const contentBlocks = custom(function (value, p, ctx) {
  if (!Array.isArray(value)) { ctx.error(p, 'should be a list of content blocks.'); return; }
  value.forEach(function (b, i) {
    const bp = p.concat(i);
    if (typeof b === 'string') { if (!b.trim()) ctx.error(bp, 'this paragraph is empty.'); return; }
    const keys = b && typeof b === 'object' ? Object.keys(b) : [];
    if (keys.length !== 1 || !BLOCK_SCHEMAS[keys[0]]) {
      ctx.error(bp, 'a content block is either a paragraph of text, or one of: ' + Object.keys(BLOCK_SCHEMAS).join(', ') + '.');
      return;
    }
    check(BLOCK_SCHEMAS[keys[0]], b[keys[0]], bp.concat(keys[0]), ctx);
  });
});

function renderBlocks(list) {
  return (list || []).map(function (b) {
    if (typeof b === 'string') return '<p>' + inline(b) + '</p>';
    if (b.tip) return '<p class="tip">' + inline(b.tip) + '</p>';
    if (b.ticks) return '<ul class="ticks">\n' + b.ticks.map(function (t) { return '    <li>' + inline(t) + '</li>'; }).join('\n') + '\n  </ul>';
    if (b.compare) {
      const c = b.compare;
      return '<div class="compare">\n    <p class="weak"><span class="label">' + esc(c.weak_label || 'Weak') + '</span>' + inline(c.weak) + '</p>\n' +
        '    <p class="strong"><span class="label">' + esc(c.better_label || 'Better') + '</span>' + inline(c.better) + '</p>\n  </div>';
    }
    return '';
  }).join('\n  ');
}

// Images: alt text is required. SVGs are placed inline so they follow light and dark mode.
const imageSchema = custom(function (img, p, ctx) {
  check({ file: 'file', 'alt?': 'text', 'decorative?': 'bool' }, img, p, ctx);
  if (!img || typeof img !== 'object') return;
  if (!img.decorative && isBlank(img.alt)) ctx.error(p, 'alt text is missing. Add "alt:" describing the image for screen reader users, or "decorative: true" if it\'s purely decoration.');
  if (typeof img.file === 'string') {
    const full = path.resolve(ctx.moduleDir, img.file);
    if (!fs.existsSync(full)) ctx.error(p.concat('file'), 'can\'t find the image "' + img.file + '" (looked in ' + full + ').');
    else if (!/\.(svg|png|jpe?g|webp|gif)$/i.test(img.file)) ctx.error(p.concat('file'), 'images must be SVG, PNG, JPG, WebP or GIF.');
    else if (/\.svg$/i.test(img.file)) {
      const svg = fs.readFileSync(full, 'utf8');
      if (/<script|\son\w+\s*=|<foreignObject|href\s*=\s*["']https?:/i.test(svg)) ctx.error(p.concat('file'), 'this SVG contains scripts or links to outside websites, which aren\'t allowed in a module.');
    }
  }
});
function isBlank(v) { return v == null || String(v).trim() === ''; }

function renderImage(img, id, ctx) {
  const full = path.resolve(ctx.moduleDir, img.file);
  if (/\.svg$/i.test(img.file)) {
    let svg = fs.readFileSync(full, 'utf8').replace(/<\?xml[^>]*>\s*/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<title[\s\S]*?<\/title>\s*/g, '').trim();
    const a11y = img.decorative ? ' aria-hidden="true" focusable="false"' : ' role="img" aria-labelledby="' + id + '"';
    svg = svg.replace(/<svg\b([^>]*)>/, function (m, attrs) {
      attrs = attrs.replace(/\s(role|aria-[a-z]+)="[^"]*"/g, '');
      return '<svg' + attrs + a11y + '>' + (img.decorative ? '' : '\n  <title id="' + id + '">' + esc(img.alt) + '</title>');
    });
    return svg;
  }
  ctx.addAsset(img.file);
  return '<img src="' + esc(img.file) + '" alt="' + (img.decorative ? '' : esc(img.alt)) + '">';
}

module.exports = { partTag, partClass, partLabel, contentBlocks, renderBlocks, imageSchema, renderImage, esc, inline, blocks };
