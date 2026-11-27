'use strict';
// The Groundwork homepage. Pathway facts (module counts, minutes) come from the module files.

const PATHWAYS = [
  { level: 'Foundations', slug: 'foundations', who: 'Everyone. First steps: what Claude is, clear prompts, checking its work and using it safely.' },
  { level: 'Practitioner', slug: 'practitioner', who: 'Regular users. Projects, research, data, documents and tools in day-to-day work.' },
  { level: 'Advanced', slug: 'advanced', who: 'Confident users. Multi-step tasks, agents, automation and a personal AI system.' },
  { level: 'Manager', slug: 'manager', who: 'Team leads. Redesigning team work, coaching and measuring the impact.' },
  { level: 'Leader', slug: 'leader', who: 'Senior leaders. Strategy, governance and risk, leading the change and return on investment.' }
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hours(min) {
  const h = Math.floor(min / 60);
  const m = Math.round((min % 60) / 5) * 5;
  if (!h) return m + ' min';
  return m ? h + ' h ' + m + ' min' : h + ' h';
}

function pathwayStats(modules) {
  return PATHWAYS.map(function (p, i) {
    const mods = modules.filter(function (m) { return m.level === p.level; });
    const minutes = mods.reduce(function (t, m) { return t + (m.minutes || 0); }, 0);
    return Object.assign({ step: i + 1, count: mods.length, minutes }, p);
  });
}

function home(modules, opts) {
  const paths = pathwayStats(modules);
  const total = modules.length;
  const totalMin = modules.reduce(function (t, m) { return t + (m.minutes || 0); }, 0);
  const avg = Math.round(totalMin / total);

  const ladder = paths.map(function (p) {
    const bar = paths.map(function (_, j) { return '<span' + (j < p.step ? ' class="on"' : '') + '></span>'; }).join('');
    return '<li class="rung">' +
      '<div class="steps-bar" aria-hidden="true">' + bar + '</div>' +
      '<h3>' + esc(p.level) + '</h3>' +
      '<p class="who">' + esc(p.who) + '</p>' +
      '<p class="meta"><span><b>' + p.count + '</b> modules</span><span><b>' + hours(p.minutes) + '</b></span></p>' +
      '<a href="pathways/' + p.slug + '.html">See the ' + esc(p.level) + ' modules</a>' +
      '</li>';
  }).join('\n');

  return `<title>Groundwork AI Training</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Short, scenario-based modules that teach everyone at work to use Claude well, from first prompts to leading the change.">
<style>
${opts.css}
</style>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="Groundwork AI Training, home">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><rect x="2" y="20" width="26" height="6" rx="2" fill="var(--accent)"/><rect x="6" y="12" width="18" height="6" rx="2" fill="var(--accent)" opacity=".7"/><rect x="10" y="4" width="10" height="6" rx="2" fill="var(--accent)" opacity=".45"/></svg>
      <span>Groundwork<small>AI Training</small></span>
    </a>
    <nav class="nav" aria-label="Main">
      <a class="hide-sm" href="courses.html">Courses</a>
      <a class="hide-sm" href="pricing.html">Pricing</a>
      <a class="hide-sm" href="how-it-works.html">How it works</a>
      <a href="login.html">Log in</a>
      <a class="btn btn-primary" href="try-f3.html">Try a module</a>
    </nav>
  </div>
</header>

<main id="main">
  <section class="hero">
    <div class="wrap">
      <div>
        <p class="eyebrow">Claude training for the whole workplace</p>
        <h1 style="margin-top:.9rem">Help everyone at work use AI well.</h1>
        <p class="lede">${total} short, scenario-based modules teach your people to use Claude with confidence, from their first prompt to leading the change. Each one takes about ${avg} minutes.</p>
        <div class="actions">
          <a class="btn btn-primary" href="try-f3.html">Try a module free</a>
          <a class="btn btn-secondary" href="pricing.html">See pricing</a>
        </div>
        <ul class="facts">
          <li>No sign-up for the free module</li>
          <li>Buy 1 seat or 1,000</li>
          <li>Accessible (WCAG 2.2 AA)</li>
        </ul>
      </div>

      <figure class="demo" aria-labelledby="demo-cap" style="margin:0">
        <figcaption id="demo-cap" class="demo-label">From module F3, Your first prompts</figcaption>
        <div>
          <p class="demo-label" style="margin-bottom:.5rem">Sam's first try</p>
          <p class="prompt weak">Write an email about the office move.</p>
        </div>
        <p class="arrow" aria-hidden="true">↓ three short additions</p>
        <div>
          <p class="demo-label" style="margin-bottom:.5rem">Sam's prompt after the module</p>
          <p class="prompt">
            <span class="line p1"><span class="tag">Goal</span>Tell staff about our office move, so they know what to do before moving day.</span>
            <span class="line p2"><span class="tag">Context</span>We move on Friday 12 March to 10 Harbour St. Pack desks by Thursday. Questions go to Jo in Facilities.</span>
            <span class="line p3"><span class="tag">Format</span>Under 150 words, friendly, a checklist of three actions.</span>
          </p>
        </div>
        <p class="demo-foot"><span>Result: an email ready to send</span><span>18 minutes</span></p>
      </figure>
    </div>
  </section>

  <section class="band alt" aria-labelledby="paths-h">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Five pathways</p>
        <h2 id="paths-h">A clear path from beginner to leader</h2>
        <p>Start everyone on Foundations, then add the pathways that fit each role. Examples are drawn from everyday work in any industry.</p>
      </div>
      <ol class="ladder">
${ladder}
      </ol>
    </div>
  </section>

  <section class="band" aria-labelledby="inside-h">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Inside every module</p>
        <h2 id="inside-h">Learn by doing, in under 20 minutes</h2>
        <p>Every module follows the same pattern, so learners know what to expect and finish what they start.</p>
      </div>
      <ol class="inside">
        <li><h3>Meet a real situation</h3><p>A short workplace story shows a common mistake and why it happens.</p></li>
        <li><h3>Build the skill</h3><p>Interactive steps show the better way, one idea at a time.</p></li>
        <li><h3>Try it on your own work</h3><p>Practise with a task from your week, guided by a checklist.</p></li>
        <li><h3>Check and keep</h3><p>A short quiz confirms the learning, and a one-page job aid card is kept for later.</p></li>
      </ol>
    </div>
  </section>

  <section class="band alt" aria-labelledby="teams-h">
    <div class="wrap teams">
      <div>
        <div class="section-head" style="margin-bottom:1.75rem">
          <p class="eyebrow">For teams</p>
          <h2 id="teams-h">Set up your team in minutes</h2>
          <p>No minimum order and no sales call. You stay in charge of who has access.</p>
        </div>
        <ol class="flow">
          <li><b>1</b><span><strong>Buy seats</strong>Choose a pathway or the full suite and how many learners. Pay by card.</span></li>
          <li><b>2</b><span><strong>Invite your people</strong>Add learners by email. Remove a leaver and the seat is free for someone new.</span></li>
          <li><b>3</b><span><strong>See progress</strong>Check who has started and finished, and download a report.</span></li>
        </ol>
      </div>
      <div class="admin" role="img" aria-label="An example team admin page: 15 of 20 seats used, with three learners and their progress">
        <div class="admin-top"><h3>Team admin</h3><span class="seats">15 of 20 seats used</span></div>
        <div class="seatbar"><span></span></div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Learner</th><th>Pathway</th><th>Progress</th></tr></thead>
            <tbody>
              <tr><td>Aroha N.</td><td>Foundations</td><td><span class="pill done">Finished</span></td></tr>
              <tr><td>Daniel K.</td><td>Practitioner</td><td><span class="pill going">6 of 10</span></td></tr>
              <tr><td>Priya S.</td><td>Foundations</td><td><span class="pill new">Invited</span></td></tr>
            </tbody>
          </table>
        </div>
        <p class="example">Example data</p>
      </div>
    </div>
  </section>

  <section class="band" aria-labelledby="price-h">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Pricing</p>
        <h2 id="price-h">Simple pricing, per learner, per year</h2>
        <p>Prices are in US dollars. Buy as many seats as you need.</p>
      </div>
      <div class="prices">
        <div class="price">
          <h3>Foundations</h3>
          <p class="amount">$25<small>per learner, per year</small></p>
          <ul><li>8 Foundations modules</li><li>Job aid cards</li><li>Progress for team admins</li></ul>
          <a class="btn btn-secondary" href="pricing.html#foundations">Choose Foundations</a>
        </div>
        <div class="price featured">
          <h3>Full suite</h3>
          <p class="amount">$60<small>per learner, per year</small></p>
          <ul><li>All ${total} modules, five pathways</li><li>Updates included</li><li>Progress reports and certificates</li></ul>
          <a class="btn btn-primary" href="pricing.html#full-suite">Choose the full suite</a>
        </div>
        <div class="price">
          <h3>Your own LMS</h3>
          <p class="amount">$20,000<small>per year, up to 1,000 staff</small></p>
          <ul><li>All ${total} modules as SCORM 2004 files</li><li>Updates included</li><li>Larger organisations by quote</li></ul>
          <a class="btn btn-secondary" href="contact.html">Ask about SCORM</a>
        </div>
      </div>
      <p class="price-note">Teams of 500 or more learners can <a href="contact.html">ask for a quote</a>.</p>
    </div>
  </section>

  <section class="band" style="padding-top:0" aria-labelledby="cta-h">
    <div class="wrap">
      <div class="cta">
        <div><h2 id="cta-h">See it for yourself</h2><p>Take F3, Your first prompts, free in your browser. No sign-up needed.</p></div>
        <a class="btn btn-primary" href="try-f3.html">Try a module free</a>
      </div>
    </div>
  </section>
</main>

<footer class="site-foot">
  <div class="wrap">
    <nav class="foot-links" aria-label="Footer">
      <a href="courses.html">Courses</a><a href="pricing.html">Pricing</a><a href="how-it-works.html">How it works</a><a href="about.html">About</a><a href="contact.html">Contact</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a>
    </nav>
    <p class="independent">Groundwork AI Training is an independent training provider. We are not affiliated with, or endorsed by, Anthropic. Claude is a trademark of Anthropic.</p>
  </div>
</footer>
`;
}

module.exports = { home, pathwayStats, PATHWAYS, hours };
