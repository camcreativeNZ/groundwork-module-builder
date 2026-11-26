'use strict';
const S = require('./shared');
const { esc, inline, words } = Object.assign({}, S, require('../text'));
const { check, custom, list } = require('../schema');

const choiceQ = {
  'type?': 'text', question: 'md',
  options: { $map: 'md', keys: /^[a-h]$/, keysHint: 'Label options a, b, c and so on.', min: 2 },
  answer: 'text', feedback: 'md'
};
const matchQ = {
  type: 'text', question: 'md', 'choice_word?': 'text',
  choices: list('text', { min: 2, max: 6 }),
  lines: list({ text: 'md', answer: 'text' }, { min: 2, max: 6 }),
  feedback: 'md'
};

const question = custom(function (q, p, ctx) {
  if (!q || typeof q !== 'object') { ctx.error(p, 'each question should be a group of fields.'); return; }
  const type = q.type || 'choice';
  if (type === 'choice') {
    check(choiceQ, q, p, ctx);
    if (q.options && q.answer != null && !(String(q.answer) in q.options)) {
      ctx.error(p.concat('answer'), 'the answer "' + q.answer + '" isn\'t one of the options (' + Object.keys(q.options).join(', ') + ').');
    }
  } else if (type === 'match') {
    check(matchQ, q, p, ctx);
    if (Array.isArray(q.choices) && Array.isArray(q.lines)) {
      const seen = {};
      q.lines.forEach(function (l, i) {
        if (!l || l.answer == null) return;
        if (q.choices.indexOf(l.answer) === -1) ctx.error(p.concat('lines', i, 'answer'), 'the answer "' + l.answer + '" isn\'t one of the choices (' + q.choices.join(', ') + ').');
        if (seen[l.answer]) ctx.error(p.concat('lines', i, 'answer'), '"' + l.answer + '" is already the answer for another line. Each choice can be used once.');
        seen[l.answer] = true;
      });
    }
  } else {
    ctx.error(p.concat('type'), 'question type "' + type + '" isn\'t known. Use "choice" (the default) or "match".');
  }
});

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

module.exports = {
  name: 'knowledge-check',
  summary: 'Scored questions (multiple choice and matching) with feedback, a pass mark and retries. Sends the score to the LMS.',
  screens: 1,
  schema: {
    title: 'text', 'menu_title?': 'text', 'intro?': 'md',
    questions: list(question, { min: 1, max: 20 }),
    'pass_message?': 'md', 'fail_message?': 'md'
  },
  render: function (s, ctx) {
    const n = ctx.screenNo;
    const total = s.questions.length;
    const pass = ctx.module.pass_mark;
    const intro = s.intro || ('Answer ' + words(total) + ' question' + (total === 1 ? '' : 's') + '. You need ' + pass + ' out of ' + total + ' to pass, and you can try again.');
    let html = '<h2 id="s' + n + 'h">' + esc(s.title) + '</h2>\n  <p>' + inline(intro) + '</p>\n' +
      '  <form id="quiz" novalidate data-pass="' + pass + '" data-total-words="' + words(total) + '"' +
      ' data-pass-msg="' + esc(inline(s.pass_message || 'Well done, you\'ve passed. Select Next to finish.')) + '"' +
      ' data-fail-msg="' + esc(inline(s.fail_message || ('You need ' + pass + ' to pass. Read the feedback, then try again.'))) + '">\n';
    s.questions.forEach(function (q, i) {
      const qn = 'q' + (i + 1);
      const legendStart = '<legend><span class="qn">' + (i + 1) + '.</span> ' + inline(q.question);
      const fb = '      <p class="feedback" hidden data-fb="' + esc(inline(q.feedback)) + '"></p>\n';
      if ((q.type || 'choice') === 'match') {
        const word = q.choice_word || 'answer';
        html += '\n    <fieldset class="q match" data-q="' + qn + '">\n      ' + legendStart + ' Drag ' + (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + esc(word) + ' onto a line, or select ' + (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + esc(word) + ' and then select a line.</legend>\n' +
          '      <div class="chips" role="group" aria-label="' + esc(cap(word)) + 's to place">\n' +
          q.choices.map(function (c) { return '        <button type="button" class="chip" draggable="true" data-part="' + esc(c) + '" aria-pressed="false">' + esc(c) + '</button>'; }).join('\n') +
          '\n      </div>\n      <ol class="slots">\n' +
          q.lines.map(function (l) { return '        <li><button type="button" class="slot" data-correct="' + esc(l.answer) + '"><span class="slot-label">Choose ' + (/^[aeiou]/i.test(word) ? 'an ' : 'a ') + esc(word) + '</span></button> <span class="line">' + inline(l.text) + '</span></li>'; }).join('\n') +
          '\n      </ol>\n      <p class="sr-only match-status" role="status"></p>\n' + fb + '    </fieldset>\n';
      } else {
        html += '\n    <fieldset class="q" data-q="' + qn + '" data-answer="' + esc(q.answer) + '">\n      ' + legendStart + '</legend>\n' +
          Object.keys(q.options).map(function (k) { return '      <label><input type="radio" name="' + qn + '" value="' + esc(k) + '"> ' + inline(q.options[k]) + '</label>'; }).join('\n') + '\n' +
          fb + '    </fieldset>\n';
      }
    });
    html += '\n    <div class="row">\n      <button type="submit" class="btn" id="submitQuiz">Check my answers</button>\n' +
      '      <button type="button" class="btn secondary" id="retryQuiz" hidden>Try again</button>\n    </div>\n' +
      '    <div id="result" class="result" role="status" tabindex="-1"></div>\n  </form>';
    return [{ title: s.menu_title || s.title, html, quiz: { total } }];
  }
};
