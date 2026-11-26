'use strict';
// A small checker for module files. Each template describes its fields like this:
//   title: 'text'          required text
//   'intro?': 'md'         optional text with formatting
//   cards: list(card, {min: 2, max: 4})
// Unknown fields are reported too, because they're usually typos.

function list(of, opts) { return Object.assign({ $list: of }, opts || {}); }
function map(of, opts) { return Object.assign({ $map: of }, opts || {}); }
function custom(fn) { return { $custom: fn }; }

const SCALARS = {
  text: function (v) { return typeof v === 'string' || typeof v === 'number' ? null : 'should be text'; },
  md: function (v) { return typeof v === 'string' || typeof v === 'number' ? null : 'should be text'; },
  int: function (v) { return Number.isInteger(v) ? null : 'should be a whole number'; },
  bool: function (v) { return typeof v === 'boolean' ? null : 'should be true or false'; },
  file: function (v) { return typeof v === 'string' ? null : 'should be a file path, like assets/picture.svg'; },
  url: function (v) { return typeof v === 'string' && /^https:\/\//.test(v) ? null : 'should be a web address starting https://'; },
  part: function (v, ctx) {
    if (typeof v !== 'string') return 'should be a part id';
    if (!ctx.parts[v]) return '"' + v + '" isn\'t one of this module\'s parts (' + Object.keys(ctx.parts).join(', ') + '). Add it under parts: at the top, or fix the spelling.';
    return null;
  }
};

function isEmpty(v) { return v == null || (typeof v === 'string' && v.trim() === ''); }

function check(spec, value, path, ctx) {
  if (typeof spec === 'string') {
    if (isEmpty(value)) { ctx.error(path, 'this is empty. Add some text.'); return; }
    const msg = SCALARS[spec](value, ctx);
    if (msg) ctx.error(path, msg + '.');
    return;
  }
  if (spec.$custom) { spec.$custom(value, path, ctx); return; }
  if (spec.$list) {
    if (!Array.isArray(value)) { ctx.error(path, 'should be a list (each item on its own line starting with "- ").'); return; }
    if (spec.min != null && value.length < spec.min) ctx.error(path, 'needs at least ' + spec.min + ' item' + (spec.min === 1 ? '' : 's') + ' (has ' + value.length + ').');
    if (spec.max != null && value.length > spec.max) ctx.error(path, 'can have at most ' + spec.max + ' items (has ' + value.length + ').');
    value.forEach(function (v, i) { check(spec.$list, v, path.concat(i), ctx); });
    return;
  }
  if (spec.$map) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { ctx.error(path, 'should be a set of "key: value" lines.'); return; }
    Object.keys(value).forEach(function (k) {
      if (spec.keys && !spec.keys.test(k)) ctx.error(path.concat(k), '"' + k + '" isn\'t allowed here. ' + (spec.keysHint || ''));
      check(spec.$map, value[k], path.concat(k), ctx);
    });
    if (spec.min != null && Object.keys(value).length < spec.min) ctx.error(path, 'needs at least ' + spec.min + ' items.');
    return;
  }
  // An object with named fields.
  if (!value || typeof value !== 'object' || Array.isArray(value)) { ctx.error(path, 'should be a group of fields, indented underneath.'); return; }
  const known = {};
  Object.keys(spec).forEach(function (rawKey) {
    const optional = rawKey.endsWith('?');
    const key = optional ? rawKey.slice(0, -1) : rawKey;
    known[key] = true;
    if (value[key] === undefined || value[key] === null) {
      if (!optional) ctx.error(path, 'the field "' + key + '" is missing.');
      return;
    }
    check(spec[rawKey], value[key], path.concat(key), ctx);
  });
  Object.keys(value).forEach(function (k) {
    if (!known[k]) ctx.error(path.concat(k), '"' + k + '" isn\'t a field this ' + (ctx.label || 'item') + ' understands. Fields allowed here: ' + Object.keys(known).join(', ') + '.');
  });
}

module.exports = { check, list, map, custom };
