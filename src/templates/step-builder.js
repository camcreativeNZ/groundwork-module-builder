'use strict';
const S = require('./shared');
const { esc, inline, blocks } = S;
const { check, custom, list } = require('../schema');

const step = custom(function (st, p, ctx) {
  check({ 'part?': 'part', 'label?': 'text', title: 'text', 'menu_title?': 'text', 'content?': S.contentBlocks,
    adds: 'md', reply: 'md', 'image?': S.imageSchema, 'note?': 'md', 'success?': 'md' }, st, p, ctx);
  if (st && !st.part && !st.label) ctx.error(p, 'each step needs either "part:" or "label:" to name what it adds.');
});

module.exports = {
  name: 'step-builder',
  summary: 'Builds something up one step per screen, with the prompt so far and Claude\'s reply beside it.',
  screens: 'one per step',
  schema: { 'prompt_label?': 'text', 'reply_label?': 'text', 'added_badge?': 'text', steps: list(step, { min: 2, max: 6 }) },
  render: function (s, ctx) {
    const promptLabel = s.prompt_label || 'The prompt so far';
    const replyLabel = s.reply_label || 'Claude\'s reply';
    const badge = s.added_badge || 'added';
    return s.steps.map(function (st, i) {
      const n = ctx.screenNo + i;
      let html = '<h2 id="s' + n + 'h">' + S.partTag(st.part, ctx) + esc(st.title) + '</h2>\n';
      if (st.content) html += '  ' + S.renderBlocks(st.content) + '\n';
      let lines = '';
      for (let k = 0; k <= i; k++) {
        const l = s.steps[k];
        const isNew = k === i;
        lines += '<li class="pl ' + S.partClass(l.part, ctx) + (isNew ? ' new' : '') + '"><span class="pl-tag">' + esc(l.label || S.partLabel(l.part, ctx)) +
          (isNew ? ' <span class="new-badge">' + esc(badge) + '</span>' : '') + '</span>' + inline(l.adds) + '</li>';
      }
      html += '  <div class="builder-panels"><div class="panel prompt-panel"><span class="label">' + esc(promptLabel) + '</span><ol class="prompt-lines">' + lines + '</ol></div>' +
        '<div class="panel claude-reply"><span class="label">' + esc(replyLabel) + '</span>' + blocks(st.reply).replace(/\n/g, '') +
        (st.image ? '<figure class="reply-figure">' + S.renderImage(st.image, 'rimg' + n, ctx) + '</figure>' : '') +
        (st.note ? '<p class="muted">' + inline(st.note) + '</p>' : '') + '</div></div>';
      if (st.success) html += '\n  <p class="success-note">' + inline(st.success) + '</p>';
      return { title: st.menu_title || st.title, html, cls: 'builder', attrs: { 'data-step': i + 1 } };
    });
  }
};
