'use strict';
const S = require('./shared');
const { esc, inline } = S;
const { check, custom, list } = require('../schema');

const card = custom(function (c, p, ctx) {
  check({ 'part?': 'part', 'front?': 'text', back: 'md' }, c, p, ctx);
  if (c && !c.part && !c.front) ctx.error(p, 'each card needs either "part:" (one of the module\'s parts) or "front:" text.');
});

module.exports = {
  name: 'flip-cards',
  summary: 'Two to four key ideas on cards the learner selects to turn over.',
  screens: 1,
  schema: { title: 'text', 'menu_title?': 'text', 'intro?': 'md', cards: list(card, { min: 2, max: 4 }), 'tip?': 'md' },
  render: function (s, ctx) {
    const n = ctx.screenNo;
    const cols = s.cards.length === 4 ? 2 : s.cards.length;
    let html = '<h2 id="s' + n + 'h">' + esc(s.title) + '</h2>\n';
    if (s.intro) html += '  <p>' + inline(s.intro) + '</p>\n';
    html += '  <div class="cards"' + (cols !== 3 ? ' style="--cols: ' + cols + '"' : '') + '>\n';
    s.cards.forEach(function (c) {
      const front = c.front || S.partLabel(c.part, ctx);
      html += '    <button type="button" class="flip ' + S.partClass(c.part, ctx) + '" aria-pressed="false">\n' +
        '      <span class="flip-front">' + S.partTag(c.part, ctx) + esc(front) + '</span>\n' +
        '      <span class="flip-back"><strong>' + esc(front) + ':</strong> ' + inline(c.back) + '</span>\n    </button>\n';
    });
    html += '  </div>';
    if (s.tip) html += '\n  <p class="tip">' + inline(s.tip) + '</p>';
    return [{ title: s.menu_title || s.title, html }];
  }
};
