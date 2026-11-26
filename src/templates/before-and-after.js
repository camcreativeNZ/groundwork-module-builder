'use strict';
const S = require('./shared');
const { esc, inline, blocks } = S;
const { list } = require('../schema');

module.exports = {
  name: 'before-and-after',
  summary: 'Shows a weak and a strong result side by side, with an optional prompt and a "What changed" list the learner reveals.',
  screens: 1,
  schema: {
    title: 'text', 'menu_title?': 'text', 'intro?': 'md',
    'prompt?': { 'label?': 'text', text: 'md' },
    before: { 'label?': 'text', text: 'md' },
    after: { 'label?': 'text', text: 'md' },
    'changes?': { 'title?': 'text', items: list('md', { min: 1, max: 6 }) },
    'tip?': 'md'
  },
  render: function (s, ctx) {
    const n = ctx.screenNo;
    let html = '<h2 id="s' + n + 'h">' + esc(s.title) + '</h2>\n';
    if (s.intro) html += '  ' + blocks(s.intro).replace(/\n/g, '\n  ') + '\n';
    if (s.prompt) html += '  <div class="prompt-bubble"><span class="label">' + esc(s.prompt.label || 'The prompt') + '</span>' + inline(s.prompt.text) + '</div>\n';
    html += '  <div class="ba">\n' +
      '    <div class="ba-panel before"><span class="label">' + esc(s.before.label || 'Before') + '</span>' + blocks(s.before.text).replace(/\n/g, '') + '</div>\n' +
      '    <div class="ba-panel after"><span class="label">' + esc(s.after.label || 'After') + '</span>' + blocks(s.after.text).replace(/\n/g, '') + '</div>\n' +
      '  </div>';
    if (s.changes) {
      const title = s.changes.title || 'What changed';
      html += '\n  <div class="changes-wrap">\n    <button type="button" class="btn secondary" data-reveal="changes' + n + '" data-show-label="Show what changed" data-hide-label="Hide what changed" aria-expanded="false" aria-controls="changes' + n + '">Show what changed</button>\n' +
        '    <div id="changes' + n + '" class="reveal changes" hidden>\n      <h3>' + esc(title) + '</h3>\n      <ol>\n' +
        s.changes.items.map(function (it) { return '        <li>' + inline(it) + '</li>'; }).join('\n') + '\n      </ol>\n    </div>\n  </div>';
    }
    if (s.tip) html += '\n  <p class="tip">' + inline(s.tip) + '</p>';
    return [{ title: s.menu_title || s.title, html }];
  }
};
