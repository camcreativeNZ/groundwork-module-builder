#!/usr/bin/env node
'use strict';
// Command line for the Groundwork module builder.
//   groundwork build modules/F3/module.yaml            build web + SCORM zip
//   groundwork check modules/F3/module.yaml            check only, build nothing
//   groundwork templates                               list screen templates
// Add --json to get a machine-readable report (used by the Mac app).
// Add --theme themes/acme to build with a customer's theme, --out <folder> to choose where files go.
const path = require('path');
const api = require('../src');

const args = process.argv.slice(2);
const json = args.indexOf('--json') !== -1;
function opt(name) { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : undefined; }
const positional = args.filter(function (a, i) { return !a.startsWith('--') && !(i > 0 && /^--(theme|out)$/.test(args[i - 1])); });
const cmd = positional[0];
const file = positional[1];
const cwd = process.cwd();

function printProblems(problems) {
  problems.forEach(function (p) { console.log('  ' + api.formatProblem(p, cwd)); });
}

function usage() {
  console.log('Groundwork module builder\n\n' +
    '  groundwork build <module.yaml> [--theme <folder>] [--out <folder>] [--json]\n' +
    '  groundwork check <module.yaml> [--theme <folder>] [--json]\n' +
    '  groundwork templates [--json]\n');
}

if (cmd === 'templates') {
  const list = api.templates.map(function (t) { return { name: t.name, summary: t.summary, fields: Object.keys(t.schema) }; });
  if (json) console.log(JSON.stringify(list, null, 2));
  else list.forEach(function (t) { console.log(t.name.padEnd(17) + t.summary); });
  process.exit(0);
}

if ((cmd !== 'build' && cmd !== 'check') || !file) { usage(); process.exit(cmd ? 2 : 0); }

if (cmd === 'check') {
  const v = api.validateModule(path.resolve(file));
  const theme = api.loadTheme(path.resolve(opt('--theme') || require('../src/build').DEFAULT_THEME));
  const problems = v.problems.concat(theme.problems || []);
  const ok = !problems.some(function (p) { return p.level === 'error'; });
  if (json) { console.log(JSON.stringify({ ok, problems, contrast: theme.contrast }, null, 2)); process.exit(ok ? 0 : 1); }
  if (ok) console.log('✓ ' + path.relative(cwd, file) + ' looks good.');
  else console.log('This module needs a few fixes before it can be built:');
  printProblems(problems);
  process.exit(ok ? 0 : 1);
}

let report;
try {
  report = api.build({ module: file, theme: opt('--theme'), out: opt('--out') });
} catch (e) {
  report = { ok: false, problems: [{ level: 'error', file, line: null, where: '', message: e.message }] };
}
if (json) { console.log(JSON.stringify(report, null, 2)); process.exit(report.ok ? 0 : 1); }
if (!report.ok) {
  console.log('This module needs a few fixes before it can be built:');
  printProblems(report.problems);
  process.exit(1);
}
console.log('✓ Built ' + path.relative(cwd, file) + ' (' + report.screens.length + ' screens' + (report.passMark ? ', pass mark ' + report.passMark : '') + ')');
printProblems(report.problems);
console.log('  Web version:  ' + path.relative(cwd, report.webDir) + '/index.html');
console.log('  SCORM 2004:   ' + path.relative(cwd, report.zipPath));
console.log('  Contrast:     ' + report.contrast.filter(function (c) { return c.ok; }).length + ' of ' + report.contrast.length + ' colour checks pass (light and dark)');
