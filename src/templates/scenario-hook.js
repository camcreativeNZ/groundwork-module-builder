'use strict';
const S = require('./shared');
const { esc, inline, blocks } = S;

module.exports = {
  name: 'scenario-hook',
  summary: 'Opens the module with a character, their situation, an example of what went wrong, and a reflection with a reveal.',
  screens: 1,
  schema: {
    title: 'text', 'menu_title?': 'text',
    story: 'md',
    'prompt?': { 'label?': 'text', text: 'md' },
    'image?': S.imageSchema,
    'reply?': { 'label?': 'text', text: 'md', 'note?': 'md' },
    reflection: { question: 'text', 'hint?': 'text', answer: 'md' }
  },
  render: function (s, ctx) {
    const n = ctx.screenNo;
    let left = blocks(s.story);
    if (s.prompt) left += '\n      <div class="prompt-bubble"><span class="label">' + esc(s.prompt.label || 'The prompt') + '</span>' + inline(s.prompt.text) + '</div>';
    let top;
    if (s.image) {
      top = '<div class="split">\n    <div>\n      ' + left.replace(/\n/g, '\n      ') + '\n    </div>\n    <figure class="illustration">\n      ' +
        S.renderImage(s.image, 'illo' + n, ctx) + '\n    </figure>\n  </div>';
    } else top = left;
    let html = '<h2 id="s' + n + 'h">' + esc(s.title) + '</h2>\n  ' + top + '\n';
    if (s.reply) {
      html += '\n  <div class="claude-reply">\n    <span class="label">' + esc(s.reply.label || 'Claude\'s reply') + '</span>\n    ' +
        blocks(s.reply.text).replace(/\n/g, '\n    ') + (s.reply.note ? '\n    <p class="muted">' + inline(s.reply.note) + '</p>' : '') + '\n  </div>\n';
    }
    const r = s.reflection;
    html += '\n  <div class="reflect">\n    <label for="reflect' + n + '"><strong>' + esc(r.question) + '</strong>' + (r.hint ? ' ' + esc(r.hint) : '') + '</label>\n' +
      '    <textarea id="reflect' + n + '" rows="3"></textarea>\n' +
      '    <button type="button" class="btn secondary" data-reveal="reveal' + n + '" aria-expanded="false" aria-controls="reveal' + n + '">Show the answer</button>\n' +
      '    <div id="reveal' + n + '" class="reveal" hidden>\n      ' + blocks(r.answer).replace(/\n/g, '\n      ') + '\n    </div>\n  </div>';
    return [{ title: s.menu_title || s.title, html }];
  }
};
