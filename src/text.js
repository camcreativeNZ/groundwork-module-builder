'use strict';
// Turns the simple text formatting used in module files into HTML.
//   **bold**   *italic*   ==highlight==
// Blank lines start a new paragraph. Lines starting "1. " or "- " become lists.

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
}

function blocks(s, pClass) {
  if (s == null) return '';
  const chunks = String(s).trim().split(/\n\s*\n/);
  const pOpen = pClass ? '<p class="' + pClass + '">' : '<p>';
  return chunks.map(function (chunk) {
    const lines = chunk.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length && lines.every(function (l) { return /^\d+[.)]\s/.test(l); })) {
      return '<ol>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^\d+[.)]\s+/, '')) + '</li>'; }).join('') + '</ol>';
    }
    if (lines.length && lines.every(function (l) { return /^[-•]\s/.test(l); })) {
      return '<ul>' + lines.map(function (l) { return '<li>' + inline(l.replace(/^[-•]\s+/, '')) + '</li>'; }).join('') + '</ul>';
    }
    return pOpen + inline(lines.join(' ')) + '</p>';
  }).join('\n');
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
function words(n) { return NUMBER_WORDS[n] || String(n); }

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

module.exports = { esc, inline, blocks, words, slug };
