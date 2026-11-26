'use strict';
// Reads a module (or theme) YAML file and keeps track of line numbers,
// so every problem can be reported as "line 34: ...".
const fs = require('fs');
const YAML = require('yaml');

const SINGULAR = { screens: 'screen', questions: 'question', cards: 'card', steps: 'step', fields: 'field',
  lines: 'line', rows: 'row', items: 'item', downloads: 'download', parts: 'part', content: 'content block',
  choices: 'choice', columns: 'column', cells: 'cell', ticks: 'tick' };

function humanPath(path) {
  const out = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (typeof p === 'number') {
      const prev = out.pop();
      const name = SINGULAR[path[i - 1]] || prev;
      out.push(name + ' ' + (p + 1));
    } else out.push(p);
  }
  return out.join(' › ');
}

function loadYaml(file) {
  const src = fs.readFileSync(file, 'utf8');
  const lineCounter = new YAML.LineCounter();
  const doc = YAML.parseDocument(src, { lineCounter, prettyErrors: true, uniqueKeys: true });
  const problems = [];
  doc.errors.forEach(function (e) {
    const pos = e.linePos && e.linePos[0];
    problems.push({ level: 'error', file, line: pos ? pos.line : null, where: '', message: 'The file isn\'t valid YAML here: ' + e.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '') + '. Check the indenting and any colons or quote marks on this line.' });
  });
  const data = problems.length ? null : doc.toJS();

  function lineOf(path) {
    for (let n = path.length; n >= 0; n--) {
      const node = n === 0 ? doc.contents : doc.getIn(path.slice(0, n), true);
      if (node && node.range) return lineCounter.linePos(node.range[0]).line;
    }
    return null;
  }

  function report(level) {
    return function (path, message) {
      problems.push({ level, file, line: lineOf(path), path: path.slice(), where: humanPath(path), message });
    };
  }

  return { file, data, problems, error: report('error'), warn: report('warning'), lineOf };
}

function formatProblem(p, baseDir) {
  const rel = baseDir ? require('path').relative(baseDir, p.file) : p.file;
  return (p.level === 'error' ? '✗ ' : '! ') + rel + (p.line ? ', line ' + p.line : '') +
    (p.where ? ' (' + p.where + ')' : '') + ': ' + p.message;
}

module.exports = { loadYaml, humanPath, formatProblem };
