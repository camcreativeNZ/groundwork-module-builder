'use strict';
const S = require('./shared');
const { esc, inline } = S;
const { list } = require('../schema');

module.exports = {
  name: 'try-it',
  summary: 'Guided practice: the learner writes a prompt in parts, sees it joined up, copies it and opens Claude.',
  screens: 1,
  schema: {
    title: 'text', 'menu_title?': 'text', 'intro?': 'md', 'task?': 'md',
    fields: list({ 'part?': 'part', label: 'text', 'placeholder?': 'text', 'rows?': 'int' }, { min: 1, max: 6 }),
    'result_label?': 'text', 'empty_text?': 'text', 'copy_label?': 'text',
    'open_link?': { 'label?': 'text', 'url?': 'url' },
    'checklist?': { title: 'text', items: list('md', { min: 1 }) },
    'privacy?': 'md'
  },
  render: function (s, ctx) {
    const n = ctx.screenNo;
    const link = s.open_link || {};
    let html = '<h2 id="s' + n + 'h">' + esc(s.title) + '</h2>\n';
    if (s.intro) html += '  <p>' + inline(s.intro) + '</p>\n';
    if (s.task) html += '  <p class="task">' + inline(s.task) + '</p>\n';
    html += '  <div class="try-grid">\n';
    s.fields.forEach(function (f, i) {
      const id = 'try' + n + '_' + (i + 1);
      html += '    <div class="field">\n      <label for="' + id + '">' + S.partTag(f.part, ctx) + esc(f.label) + '</label>\n' +
        '      <textarea id="' + id + '" data-try rows="' + (f.rows || 2) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '></textarea>\n    </div>\n';
    });
    html += '  </div>\n  <div class="joined">\n    <span class="label" id="joinedLabel' + n + '">' + esc(s.result_label || 'Your prompt') + '</span>\n' +
      '    <pre class="joined-prompt" aria-labelledby="joinedLabel' + n + '" aria-live="polite" data-empty="' + esc(s.empty_text || 'Start typing above and your prompt will appear here.') + '"></pre>\n' +
      '    <div class="row">\n      <button type="button" class="btn copy-btn">' + esc(s.copy_label || 'Copy prompt') + '</button>\n' +
      '      <a class="btn secondary" href="' + esc(link.url || 'https://claude.ai/new') + '" target="_blank" rel="noopener">' + esc(link.label || 'Open Claude in a new tab') + '<span class="sr-only"> (opens in a new tab)</span></a>\n' +
      '      <span class="status copy-status" role="status"></span>\n    </div>\n  </div>';
    if (s.checklist) {
      html += '\n  <fieldset class="selfcheck">\n    <legend>' + esc(s.checklist.title) + '</legend>\n' +
        s.checklist.items.map(function (it) { return '    <label><input type="checkbox"> ' + inline(it) + '</label>'; }).join('\n') + '\n  </fieldset>';
    }
    html += '\n  <p class="privacy">' + inline(s.privacy || 'Nothing you type on this screen is saved or sent anywhere.') + '</p>';
    return [{ title: s.menu_title || s.title, html }];
  }
};
