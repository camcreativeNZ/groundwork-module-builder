'use strict';
// The public pages of the Groundwork website (apart from the homepage, in home.js).
// Words come from the approved "Groundwork website copy" doc. Module facts come from the module files.
const { esc, md } = require('./layout');
const { pathwayStats, hours } = require('./home');

const OUTCOMES = {
  Foundations: { heading: 'Foundations: a confident start with Claude', who: 'Everyone in your organisation, including people who have never used an AI tool.',
    learn: ['explain what Claude is good at, and where it falls short', 'write clear requests using a goal, context and format', 'check Claude\'s work before they rely on it', 'keep personal and confidential information safe', 'use Claude for everyday writing, files and images'] },
  Practitioner: { heading: 'Practitioner: make Claude part of your weekly work', who: 'People who use Claude regularly and want to get more done with less effort.',
    learn: ['structure longer prompts and set up Projects for ongoing work', 'research, analyse data and draft documents with Claude', 'write in their own voice and connect the tools they already use', 'save reusable prompts, and use Claude for meetings, planning and thinking problems through'] },
  Advanced: { heading: 'Advanced: hand Claude bigger pieces of work', who: 'Confident users who are ready for multi-step tasks and automation. No coding needed.',
    learn: ['delegate multi-step tasks and work safely with agents', 'automate routine work and build workflows a team can share', 'manage quality and risk when Claude does more of the work', 'build a prompt library and a personal AI system'] },
  Manager: { heading: 'Manager: lead a team that uses Claude', who: 'Team leads and supervisors.',
    learn: ['set clear expectations for how the team uses Claude', 'redesign team work so time saved goes to the right places', 'coach people and review AI-assisted work fairly', 'measure the impact on the team\'s results'] },
  Leader: { heading: 'Leader: set the direction for AI at work', who: 'Senior leaders and executives.',
    learn: ['shape an AI strategy that fits the organisation\'s goals', 'set governance, policy and risk controls', 'lead people through the change', 'judge the return on investment'] }
};

function pageHead(eyebrow, title, intro) {
  return `<section class="page-head"><div class="wrap">
  ${eyebrow ? '<p class="eyebrow">' + esc(eyebrow) + '</p>' : ''}
  <h1>${esc(title)}</h1>
  ${intro ? '<p class="lede">' + intro + '</p>' : ''}
</div></section>`;
}

function buyButton(level, pre) {
  return level === 'Foundations'
    ? `<a class="btn btn-primary" href="${pre}pricing.html#foundations">Buy Foundations: US$25 per learner, per year</a>`
    : `<a class="btn btn-primary" href="${pre}pricing.html#full-suite">Get ${esc(level)} in the full suite: US$60 per learner, per year</a>`;
}

// ---------- Courses ----------
function courses(modules) {
  const paths = pathwayStats(modules);
  const map = paths.map(function (p) {
    const items = modules.filter(function (m) { return m.level === p.level; }).map(function (m) {
      return `<li><a href="modules/${m.id.toLowerCase()}.html"><span class="mid">${m.id}</span>${esc(m.title)}</a></li>`;
    }).join('');
    return `<section class="map-col" aria-labelledby="map-${p.slug}">
  <h2 id="map-${p.slug}"><a href="pathways/${p.slug}.html">${esc(p.level)}</a></h2>
  <p class="map-meta">${p.count} modules · ${hours(p.minutes)}</p>
  <ol>${items}</ol>
</section>`;
  }).join('\n');
  const rows = paths.map(function (p) {
    return `<tr><th scope="row"><a href="pathways/${p.slug}.html">${esc(p.level)}</a></th><td>${esc(OUTCOMES[p.level].who)}</td><td class="num">${p.count}</td><td class="num">${hours(p.minutes)}</td></tr>`;
  }).join('');
  return pageHead('Courses', 'All ' + modules.length + ' modules, in five pathways',
    'Each module takes 12 to 18 minutes and teaches one practical skill through a workplace story. Start everyone on Foundations, then add the pathways that fit each role.') + `
<section class="band" style="padding-top:1rem"><div class="wrap">
  <div class="course-map">${map}</div>
</div></section>
<section class="band alt"><div class="wrap">
  <div class="section-head"><h2>Which pathway fits?</h2></div>
  <div class="table-scroll"><table class="data">
    <thead><tr><th scope="col">Pathway</th><th scope="col">Who it's for</th><th scope="col" class="num">Modules</th><th scope="col" class="num">Time</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
</div></section>
<section class="band"><div class="wrap"><div class="cta">
  <div><h2>Not sure where to start?</h2><p>Try F3, Your first prompts, free. No sign-up needed.</p></div>
  <a class="btn btn-primary" href="try-f3.html">Try a module free</a>
</div></div></section>`;
}

// ---------- Pathway pages ----------
function pathway(p, modules) {
  const o = OUTCOMES[p.level];
  const list = modules.filter(function (m) { return m.level === p.level; }).map(function (m) {
    return `<li><a href="../modules/${m.id.toLowerCase()}.html"><span class="mid">${m.id}</span><span class="mtitle">${esc(m.title)}</span><span class="mmin">${m.minutes} min</span></a></li>`;
  }).join('');
  return pageHead(p.level + ' pathway · ' + p.count + ' modules · ' + hours(p.minutes), o.heading, '<strong>Who it\'s for:</strong> ' + esc(o.who)) + `
<section class="band" style="padding-top:1rem"><div class="wrap two-col">
  <div>
    <h2 class="h3">By the end, learners can</h2>
    <ul class="ticks">${o.learn.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('')}</ul>
    <div class="actions">${buyButton(p.level, '../')}</div>
  </div>
  <div>
    <h2 class="h3">Modules in this pathway</h2>
    <ol class="mod-list">${list}</ol>
  </div>
</div></section>`;
}

// ---------- Module pages ----------
function modulePage(m, listing, next) {
  const free = m.id === 'F3';
  const btn = free
    ? '<a class="btn btn-primary" href="../try-f3.html">Try this module free</a>'
    : '<a class="btn btn-primary" href="../pricing.html' + (m.level === 'Foundations' ? '#foundations' : '#full-suite') + '">Get this module</a>';
  const slug = m.level.toLowerCase();
  const nextLine = next
    ? `Next module: <a href="${next.id.toLowerCase()}.html">${next.id}, ${esc(next.title)}</a>.`
    : 'This is the last module in the pathway.';
  return pageHead(m.level + ' · ' + m.id + ' · ' + m.minutes + ' minutes', m.title, esc(listing.summary)) + `
<section class="band" style="padding-top:1rem"><div class="wrap two-col">
  <div>
    <h2 class="h3">You'll learn to</h2>
    <ul class="ticks">${listing.learn.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('')}</ul>
    <div class="actions">${btn}</div>
  </div>
  <div class="note-card">
    <h2 class="h3">What's inside</h2>
    <p>A workplace story, interactive practice, a short quiz, and a one-page job aid card to keep.</p>
    <p>Part of the <a href="../pathways/${slug}.html">${esc(m.level)} pathway</a>. ${nextLine}</p>
  </div>
</div></section>`;
}

// ---------- Try F3 ----------
function tryF3() {
  return pageHead('Free module', 'Try a module free: Your first prompts',
    'This is the full F3 module, exactly as your team would see it. It takes about 18 minutes, and you don\'t need to sign up. Your progress isn\'t saved, so you can\'t come back to where you left off.') + `
<section class="band" style="padding-top:0"><div class="wrap">
  <div class="player-frame">
    <iframe src="try/f3/index.html" title="F3, Your first prompts (interactive module)" loading="lazy"></iframe>
  </div>
  <div class="player-bar">
    <p><strong>What you'll practise:</strong> turning a vague request into a clear one, using a goal, context and format.</p>
    <a class="btn btn-secondary" href="try/f3/index.html" target="_blank" rel="noopener">Open full screen</a>
  </div>
  <p class="small-note">Works in any up-to-date browser on a computer, tablet or phone. Keyboard and screen reader friendly.</p>
</div></section>
<section class="band" style="padding-top:0"><div class="wrap"><div class="cta">
  <div><h2>Liked it?</h2><p>F3 is one of 34 modules.</p></div>
  <div class="actions" style="margin:0"><a class="btn btn-secondary" href="courses.html">See all courses</a><a class="btn btn-primary" href="pricing.html">See pricing</a></div>
</div></div></section>`;
}

// ---------- Pricing ----------
function pricing(modules) {
  const faq = [
    ['Can I buy for just myself?', 'Yes. Buy one seat and you\'re both the buyer and the learner.'],
    ['Can I add more learners later?', 'Yes. Buy extra seats from your team admin page at any time. They renew on the same date as your other seats.'],
    ['What happens when someone leaves?', 'Remove them from your team and the seat is free for someone else.'],
    ['What happens at renewal?', 'We email you 30 days before. If you don\'t renew, access ends on the renewal date.'],
    ['Do you offer refunds?', 'No. Try F3 free first to make sure the modules suit your team.'],
    ['How do I pay?', 'By card, through our secure payment provider. We never see or store your card details. You\'ll get a receipt by email.']
  ].map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('');
  return pageHead('Pricing', 'Simple pricing, per learner, per year',
    'Prices are in US dollars. Buy 1 seat or 1,000 with no minimum order. Seats renew each year.') + `
<section class="band" style="padding-top:1rem"><div class="wrap">
  <div class="prices">
    <div class="price" id="foundations">
      <h2 class="h3">Foundations</h2>
      <p class="amount">$25<small>per learner, per year</small></p>
      <ul><li>8 Foundations modules</li><li>Job aid cards</li><li>Progress for team admins</li></ul>
    </div>
    <div class="price featured" id="full-suite">
      <h2 class="h3">Full suite</h2>
      <p class="amount">$60<small>per learner, per year</small></p>
      <ul><li>All ${modules.length} modules, five pathways</li><li>Updates included</li><li>Progress reports and certificates</li></ul>
    </div>
    <div class="price" id="scorm">
      <h2 class="h3">Your own LMS (SCORM)</h2>
      <p class="amount">$20,000<small>per year, up to 1,000 staff</small></p>
      <ul><li>All ${modules.length} modules as SCORM 2004 files</li><li>Updates included</li><li>Larger organisations by quote</li></ul>
      <a class="btn btn-secondary" href="contact.html">Ask about SCORM</a>
    </div>
  </div>

  <form class="checkout" id="checkout" aria-labelledby="checkout-h" novalidate>
    <h2 id="checkout-h" class="h3">Buy seats</h2>
    <div class="fields">
      <label for="plan">Plan
        <select id="plan" name="plan"><option value="25">Foundations (US$25)</option><option value="60" selected>Full suite (US$60)</option></select>
      </label>
      <label for="seats">How many learners?
        <input id="seats" name="seats" type="number" min="1" max="499" value="10" inputmode="numeric">
      </label>
      <p class="total" aria-live="polite">Total per year: <strong id="total">US$600</strong></p>
    </div>
    <button class="btn btn-primary" type="submit" data-soon="Checkout opens in the next step of the build.">Continue to payment</button>
    <p class="small-note">Buying for 500 or more learners? <a href="contact.html">Ask for a quote</a>.</p>
  </form>
</div></section>
<section class="band alt"><div class="wrap narrow">
  <div class="section-head"><h2>Questions and answers</h2></div>
  <div class="faq">${faq}</div>
</div></section>`;
}

// ---------- How it works ----------
function howItWorks() {
  return pageHead('How it works', 'How Groundwork works', '') + `
<section class="band" style="padding-top:1rem"><div class="wrap how">
  <section aria-labelledby="h-ind">
    <h2 id="h-ind" class="h3">For individuals</h2>
    <ol class="flow">
      <li><b>1</b><span>Buy a seat and create your account.</span></li>
      <li><b>2</b><span>Start with any module in your plan. Your progress is saved as you go.</span></li>
      <li><b>3</b><span>Finish a pathway to earn a certificate.</span></li>
    </ol>
  </section>
  <section aria-labelledby="h-team">
    <h2 id="h-team" class="h3">For teams</h2>
    <ol class="flow">
      <li><b>1</b><span><strong>Buy seats</strong>Choose a plan and how many learners.</span></li>
      <li><b>2</b><span><strong>Invite your people</strong>Add learners by email. Each person gets an invitation to set up their account.</span></li>
      <li><b>3</b><span><strong>See progress</strong>Your team admin page shows who has started and finished. Download a report at any time.</span></li>
      <li><b>4</b><span><strong>Change as you go</strong>Remove leavers, add new starters and buy more seats when you need them.</span></li>
    </ol>
  </section>
</div></section>
<section class="band alt"><div class="wrap two-col">
  <div>
    <h2 class="h3">For organisations with their own LMS</h2>
    <p class="prose">The SCORM licence gives you all 34 modules as SCORM 2004 files to upload to your learning management system. Your LMS tracks completion and quiz scores.</p>
    <p class="prose">When we update a module, you can download the new version from your admin page, with a note on what changed. We release bigger updates about twice a year and tell you in advance.</p>
    <div class="actions"><a class="btn btn-secondary" href="contact.html">Ask about SCORM</a></div>
  </div>
  <div>
    <h2 class="h3">Built for everyone</h2>
    <ul class="ticks">
      <li>Meets WCAG 2.2 AA accessibility, with full keyboard access and screen reader support.</li>
      <li>Works on computers, tablets and phones.</li>
      <li>Modules make no calls to outside websites, so they work behind company firewalls.</li>
      <li>Written in plain English with examples from everyday work in any industry.</li>
    </ul>
  </div>
</div></section>`;
}

// ---------- About ----------
function about() {
  return pageHead('About', 'About Groundwork AI Training', '') + `
<section class="band" style="padding-top:1rem"><div class="wrap narrow prose-block">
  <p>Groundwork AI Training makes short, practical training that helps people at work use Claude well. Our modules are designed by an experienced learning designer. Each one is built around a real workplace situation, with practice on the learner's own tasks and a job aid to keep.</p>
  <p>We believe everyone at work, not just technical teams, should be able to use AI with confidence and good judgement. So we start with the basics, keep each module under 20 minutes, and write in plain English.</p>
  <h2 class="h3">Our approach</h2>
  <ul class="ticks">
    <li><strong>Outcome first:</strong> every module teaches one skill learners can use the same day.</li>
    <li><strong>Learn by doing:</strong> stories, practice and feedback, not slides.</li>
    <li><strong>Safe by design:</strong> checking AI output and protecting information are built into every pathway.</li>
    <li><strong>Accessible to all:</strong> WCAG 2.2 AA, plain language and mobile friendly.</li>
  </ul>
  <h2 class="h3">Independence</h2>
  <p>Groundwork AI Training is an independent training provider. We are not affiliated with, or endorsed by, Anthropic. Claude is a trademark of Anthropic.</p>
</div></section>`;
}

// ---------- Contact ----------
function contact() {
  return pageHead('Contact', 'Get in touch',
    'Questions about the modules, a quote for 500 or more learners, or the SCORM licence? Send us a message and we\'ll get back to you.') + `
<section class="band" style="padding-top:1rem"><div class="wrap narrow">
  <form class="form" id="contact-form" novalidate>
    <label for="c-name">Name<input id="c-name" name="name" autocomplete="name" required></label>
    <label for="c-email">Work email<input id="c-email" name="email" type="email" autocomplete="email" required></label>
    <label for="c-org">Organisation <span class="opt">(optional)</span><input id="c-org" name="organisation" autocomplete="organization"></label>
    <label for="c-topic">What's it about?
      <select id="c-topic" name="topic"><option>General question</option><option>Quote for 500+ learners</option><option>SCORM licence</option><option>Help with my account</option></select>
    </label>
    <label for="c-count">Number of learners <span class="opt">(optional)</span><input id="c-count" name="learners" type="number" min="1" inputmode="numeric"></label>
    <label for="c-msg">Message<textarea id="c-msg" name="message" rows="5" required></textarea></label>
    <p class="form-error" id="c-error" role="alert" hidden></p>
    <button class="btn btn-primary" type="submit">Send message</button>
  </form>
  <div class="sent" id="c-sent" role="status" hidden>
    <h2 class="h3">Thanks, your message is on its way.</h2>
    <p>We've emailed a copy to <strong id="c-sent-email"></strong> so you know we've got it.</p>
  </div>
</div></section>`;
}

// ---------- Log in (form only in this stage) ----------
function login() {
  return pageHead('', 'Log in to Groundwork', '') + `
<section class="band" style="padding-top:1rem"><div class="wrap narrow">
  <form class="form" id="login-form" novalidate>
    <label for="l-email">Email<input id="l-email" type="email" autocomplete="email"></label>
    <label for="l-pass">Password<input id="l-pass" type="password" autocomplete="current-password"></label>
    <button class="btn btn-primary" type="submit" data-soon="Logging in is added in the next step of the build.">Log in</button>
    <p class="small-note"><a href="#" data-soon="Password resets are added in the next step of the build.">Forgot your password?</a></p>
  </form>
</div></section>`;
}

// ---------- Legal placeholders ----------
function legal(title) {
  return pageHead('', title, '') + `
<section class="band" style="padding-top:1rem"><div class="wrap narrow prose-block">
  <p>This page will be written before the site goes live. If you have a question in the meantime, please <a href="contact.html">get in touch</a>.</p>
</div></section>`;
}

module.exports = { courses, pathway, modulePage, tryF3, pricing, howItWorks, about, contact, login, legal, OUTCOMES };
