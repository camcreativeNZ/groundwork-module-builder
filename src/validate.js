'use strict';
// Checks a module file before anything is built, and explains each problem in plain English
// with the line to fix.
const path = require('path');
const { loadYaml } = require('./load');
const { check, list, custom } = require('./schema');
const templates = require('./templates');

function partsMap(parts) {
  const map = {};
  (Array.isArray(parts) ? parts : []).forEach(function (p, i) {
    if (p && typeof p.id === 'string') map[p.id] = { n: i + 1, label: p.label || p.id };
  });
  return map;
}

function validateModule(file) {
  const y = loadYaml(file);
  if (!y.data) return { file, problems: y.problems, ok: false };
  const m = y.data;
  const ctx = { error: y.error, warn: y.warn, parts: partsMap(m.parts), moduleDir: path.dirname(file), label: 'module' };

  const screen = custom(function (s, p, c) {
    if (!s || typeof s !== 'object') { c.error(p, 'each screen should be a group of fields starting with "template:".'); return; }
    const t = templates.byName[s.template];
    if (!t) {
      c.error(s.template ? p.concat('template') : p, (s.template ? 'the template "' + s.template + '" doesn\'t exist.' : 'the "template:" line is missing.') +
        ' Templates you can use: ' + templates.list.map(function (x) { return x.name; }).join(', ') + '.');
      return;
    }
    const schema = Object.assign({ template: 'text' }, t.schema);
    const prev = c.label; c.label = t.name + ' screen';
    check(schema, s, p, c);
    if (t.check) t.check(s, p, c);
    c.label = prev;
  });

  check({
    id: custom(function (v, p, c) { if (typeof v !== 'string' || !/^[A-Za-z0-9-]+$/.test(v)) c.error(p, 'the module id should be short letters and numbers, like F3.'); }),
    title: 'text', level: 'text', 'version?': 'int', 'minutes?': 'int', 'language?': 'text', 'pass_mark?': 'int',
    'parts?': list({ id: 'text', label: 'text' }, { min: 1, max: 4 }),
    screens: list(screen, { min: 1 })
  }, m, [], ctx);

  // Rules that look across the whole module.
  if (Array.isArray(m.parts)) {
    const seen = {};
    m.parts.forEach(function (p, i) { if (p && seen[p.id]) y.error(['parts', i, 'id'], 'the part id "' + p.id + '" is used twice.'); if (p) seen[p.id] = true; });
  }
  const screens = Array.isArray(m.screens) ? m.screens : [];
  const checks = [];
  screens.forEach(function (s, i) { if (s && s.template === 'knowledge-check') checks.push(i); });
  if (checks.length > 1) y.error(['screens', checks[1]], 'a module can have only one knowledge-check screen, because the LMS records one score.');
  if (checks.length) {
    const qs = screens[checks[0]].questions;
    const total = Array.isArray(qs) ? qs.length : 0;
    if (m.pass_mark == null) y.error([], 'this module has a knowledge check, so it needs "pass_mark:" (how many questions the learner must get right).');
    else if (total && (m.pass_mark < 1 || m.pass_mark > total)) y.error(['pass_mark'], 'the pass mark is ' + m.pass_mark + ' but there are ' + total + ' questions.');
    else if (total && m.pass_mark / total < 0.8) y.warn(['pass_mark'], m.pass_mark + ' out of ' + total + ' is below the house standard of 80%.');
  } else if (m.pass_mark != null) {
    y.warn(['pass_mark'], 'there\'s a pass mark but no knowledge-check screen, so it won\'t be used.');
  }
  const last = screens[screens.length - 1];
  if (last && last.template && last.template !== 'take-away') y.warn(['screens', screens.length - 1], 'modules usually end with a take-away screen, which shows the completion message.');

  // Name screens the way the learner sees them (a step-builder makes several screens).
  let shown = 1;
  const names = screens.map(function (s) {
    const count = s && s.template === 'step-builder' && Array.isArray(s.steps) ? s.steps.length : 1;
    const name = (count > 1 ? 'screens ' + shown + '–' + (shown + count - 1) : 'screen ' + shown) + (s && s.template ? ', ' + s.template : '');
    shown += count;
    return name;
  });
  y.problems.forEach(function (p) {
    if (p.path && p.path[0] === 'screens' && typeof p.path[1] === 'number' && names[p.path[1]]) {
      p.where = p.where.replace(/^screen \d+/, names[p.path[1]]);
    }
  });

  const errors = y.problems.filter(function (p) { return p.level === 'error'; });
  return { file, module: m, parts: ctx.parts, problems: y.problems, ok: errors.length === 0 };
}

module.exports = { validateModule, partsMap };
