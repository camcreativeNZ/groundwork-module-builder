'use strict';
// Builds every module in modules/ and runs the full automatic QA on each.
// A module only passes if every QA check passes (tracking, interactions, accessibility, phone layout).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { build } = require('../src');
const { runQa } = require('../src/qa');

const ROOT = path.resolve(__dirname, '..');
const modules = fs.readdirSync(path.join(ROOT, 'modules')).filter(function (d) { return fs.existsSync(path.join(ROOT, 'modules', d, 'module.yaml')); });

for (const id of modules) {
  test(id + ' builds and passes QA', async function () {
    const report = await build({ module: path.join(ROOT, 'modules', id, 'module.yaml'), out: path.join(ROOT, 'tests', 'output', id) });
    assert.ok(report.ok, JSON.stringify(report.problems, null, 2));
    assert.deepStrictEqual(report.problems.filter(function (p) { return p.level === 'warning'; }), []);
    const qa = await runQa(report);
    assert.deepStrictEqual(qa.checks.filter(function (c) { return !c.ok; }), []);
    fs.readdirSync(path.join(report.webDir, 'assets')).filter(function (f) { return /\.pdf$/.test(f); }).forEach(function (f) {
      const pdf = fs.readFileSync(path.join(report.webDir, 'assets', f)).toString('latin1');
      assert.strictEqual((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length, 1, f + ' should be one page');
    });
  });
}
