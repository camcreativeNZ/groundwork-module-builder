'use strict';
// Checks that broken module files are refused, with the line to fix.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateModule } = require('../src');

const F3 = fs.readFileSync(path.resolve(__dirname, '../modules/F3/module.yaml'), 'utf8');
const assetsDir = path.resolve(__dirname, '../modules/F3/assets');

function tryModule(edit) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-'));
  fs.symlinkSync(assetsDir, path.join(dir, 'assets'));
  const file = path.join(dir, 'module.yaml');
  fs.writeFileSync(file, edit(F3));
  return validateModule(file);
}
function errors(v) { return v.problems.filter(function (p) { return p.level === 'error'; }); }

test('F3 itself is valid', function () {
  const v = tryModule(function (s) { return s; });
  assert.deepStrictEqual(errors(v), []);
});

test('missing alt text is refused, with its line', function () {
  const v = tryModule(function (s) { return s.replace('      alt: A person at a desk reading a long email on screen, looking unsure\n', ''); });
  const e = errors(v);
  assert.strictEqual(e.length, 1);
  assert.match(e[0].message, /alt text is missing/);
  assert.strictEqual(e[0].where, 'screen 1, scenario-hook › image');
  assert.strictEqual(e[0].line, 32);
});

test('a wrong answer letter is refused', function () {
  const v = tryModule(function (s) { return s.replace('        answer: c\n', '        answer: d\n'); });
  assert.match(errors(v)[0].message, /the answer "d" isn't one of the options \(a, b, c\)/);
  assert.strictEqual(errors(v)[0].where, 'screen 7, knowledge-check › question 2 › answer');
});

test('a question without feedback is refused', function () {
  const v = tryModule(function (s) { return s.replace('        feedback: When Claude has gaps to fill, it guesses. Give it the facts.\n', ''); });
  assert.match(errors(v)[0].message, /"feedback" is missing/);
});

test('an unknown template is refused and the known ones are listed', function () {
  const v = tryModule(function (s) { return s.replace('template: flip-cards', 'template: flipcards'); });
  assert.match(errors(v)[0].message, /"flipcards" doesn't exist.*flip-cards/);
});

test('a typo in a field name is caught', function () {
  const v = tryModule(function (s) { return s.replace('    intro: Pick a real task', '    intor: Pick a real task'); });
  assert.ok(errors(v).some(function (e) { return /"intor" isn't a field/.test(e.message); }));
});

test('a part that does not exist is caught', function () {
  const v = tryModule(function (s) { return s.replace('      - { part: context, back:', '      - { part: contxt, back:'); });
  assert.match(errors(v)[0].message, /"contxt" isn't one of this module's parts/);
});

test('broken YAML is reported with its line', function () {
  const v = tryModule(function (s) { return s.replace('title: Your first prompts', 'title: "Your first prompts'); });
  assert.ok(errors(v).length >= 1);
  assert.ok(errors(v)[0].line);
});
