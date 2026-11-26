'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./shared');
const { esc, inline } = S;
const { check, custom, list } = require('../schema');

const row = custom(function (r, p, ctx) {
  check({ 'part?': 'part', 'label?': 'text', cells: list('md', { min: 1 }) }, r, p, ctx);
  if (r && !r.part && !r.label) ctx.error(p, 'each row needs "part:" or "label:" for its first column.');
});
const download = custom(function (d, p, ctx) {
  check({ file: 'file', label: 'text' }, d, p, ctx);
  if (d && typeof d.file === 'string' && !fs.existsSync(path.resolve(ctx.moduleDir, d.file))) {
    ctx.error(p.concat('file'), 'can\'t find "' + d.file + '". Put the file in the module\'s assets folder.');
  }
});

module.exports = {
  name: 'take-away',
  summary: 'A job aid table, downloads (such as PDF cards), the completion message and what to do next.',
  screens: 1,
  schema: {
    title: 'text', 'menu_title?': 'text', 'intro?': 'md',
    'table?': { 'caption?': 'text', columns: list('text', { min: 2, max: 5 }), rows: list(row, { min: 1 }) },
    'downloads?': list(download, { max: 4 }),
    'next?': 'md'
  },
  check: function (s, p, ctx) {
    if (s.table && Array.isArray(s.table.columns) && Array.isArray(s.table.rows)) {
      s.table.rows.forEach(function (r, i) {
        if (r && Array.isArray(r.cells) && r.cells.length !== s.table.columns.length - 1) {
          ctx.error(p.concat('table', 'rows', i, 'cells'), 'has ' + r.cells.length + ' cells but the table has ' + s.table.columns.length + ' columns, so each row needs ' + (s.table.columns.length - 1) + ' cells after the first column.');
        }
      });
    }
  },
  render: function (s, ctx) {
    const n = ctx.screenNo;
    let html = '<h2 id="s' + n + 'h">' + esc(s.title) + '</h2>\n';
    if (s.intro) html += '  <p>' + inline(s.intro) + '</p>\n';
    if (s.table) {
      const t = s.table;
      html += '  <div class="table-wrap">\n    <table class="card-table">\n' +
        '      <caption class="sr-only">' + esc(t.caption || s.title) + '</caption>\n' +
        '      <thead><tr>' + t.columns.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead>\n      <tbody>\n' +
        t.rows.map(function (r) {
          return '        <tr><th scope="row">' + S.partTag(r.part, ctx) + esc(r.label || S.partLabel(r.part, ctx)) + '</th>' +
            r.cells.map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
        }).join('\n') + '\n      </tbody>\n    </table>\n  </div>\n';
    }
    if (s.downloads && s.downloads.length) {
      html += '  <div class="row">\n' + s.downloads.map(function (d, i) {
        ctx.addAsset(d.file);
        return '    <a class="btn' + (i ? ' secondary' : '') + '" href="' + esc(d.file) + '" download>' + esc(d.label) + '</a>';
      }).join('\n') + '\n  </div>\n';
    }
    const todo = ctx.quizScreen ? 'To complete this module, go back and pass the questions on screen ' + ctx.quizScreen + '.' : '';
    html += '  <div class="finish" data-done="You\'ve completed this module." data-todo="' + esc(todo) + '"></div>';
    if (s.next) html += '\n  <p class="next">' + inline(s.next) + '</p>';
    return [{ title: s.menu_title || s.title, html }];
  }
};
