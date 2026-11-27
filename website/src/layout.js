'use strict';
// Shared page frame for the Groundwork website: head, header, footer.
// `pre` is the relative path back to the site root ('' for top-level pages, '../' one folder down).

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Light markdown for copy: **bold** only.
function md(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function header(pre, current) {
  const link = function (href, label, cls) {
    const on = current === href ? ' aria-current="page"' : '';
    return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + pre + href + '"' + on + '>' + label + '</a>';
  };
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="${pre || './'}" aria-label="Groundwork AI Training, home">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="2" y="20" width="26" height="6" rx="2" fill="var(--accent)"/><rect x="6" y="12" width="18" height="6" rx="2" fill="var(--accent)" opacity=".7"/><rect x="10" y="4" width="10" height="6" rx="2" fill="var(--accent)" opacity=".45"/></svg>
      <span>Groundwork<small>AI Training</small></span>
    </a>
    <nav class="nav" aria-label="Main">
      ${link('courses.html', 'Courses', 'hide-sm')}
      ${link('pricing.html', 'Pricing', 'hide-sm')}
      ${link('how-it-works.html', 'How it works', 'hide-sm')}
      <a id="nav-account" href="${pre}login.html"${current === 'login.html' || current === 'my-learning.html' ? ' aria-current="page"' : ''}>Log in</a>
      <a class="btn btn-primary" href="${pre}try-f3.html">Try a module</a>
    </nav>
  </div>
</header>`;
}

function footer(pre) {
  return `<footer class="site-foot">
  <div class="wrap">
    <nav class="foot-links" aria-label="Footer">
      <a href="${pre}courses.html">Courses</a><a href="${pre}pricing.html">Pricing</a><a href="${pre}how-it-works.html">How it works</a><a href="${pre}about.html">About</a><a href="${pre}contact.html">Contact</a><a href="${pre}privacy.html">Privacy</a><a href="${pre}terms.html">Terms</a>
    </nav>
    <p class="independent">Groundwork AI Training is an independent training provider. We are not affiliated with, or endorsed by, Anthropic. Claude is a trademark of Anthropic.</p>
  </div>
</footer>`;
}

// A whole page. `body` is the <main> content. `fragment: true` leaves out the document skeleton
// (used for the homepage when it is published as a preview, where the host adds the skeleton).
function page(o) {
  const head = `<title>${esc(o.title)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="${esc(o.description || '')}">
<link rel="stylesheet" href="${o.pre}site.css">
`;
  const body = `${header(o.pre, o.current)}
<main id="main">
${o.body}
</main>
${footer(o.pre)}
<script src="${o.pre}site.js"></script>
${o.account ? '<script src="' + o.pre + 'vendor/supabase.js"></script>\n<script src="' + o.pre + 'config.js"></script>\n<script src="' + o.pre + 'account.js"></script>\n' : ''}`;
  if (o.fragment) return head + body;
  return '<!doctype html>\n<html lang="en-NZ">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    head + '</head>\n<body>\n' + body + '</body>\n</html>\n';
}

module.exports = { page, header, footer, esc, md };
