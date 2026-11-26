'use strict';
// Every screen template the generator knows. Add a new template by adding a file and listing it here.
const list = [
  require('./scenario-hook'),
  require('./flip-cards'),
  require('./step-builder'),
  require('./before-and-after'),
  require('./try-it'),
  require('./knowledge-check'),
  require('./take-away')
];
const byName = {};
list.forEach(function (t) { byName[t.name] = t; });
module.exports = { list, byName };
