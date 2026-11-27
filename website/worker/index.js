// Groundwork website server (Cloudflare Worker).
// Serves the built site, keeps the modules behind a login, takes payments through Stripe
// and sends contact-form emails. Secrets live in Cloudflare, never in this file.
//
// Settings (wrangler.jsonc "vars"): SITE_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, CONTACT_TO,
//   STRIPE_PRICE_FOUNDATIONS, STRIPE_PRICE_FULL, EMAIL_FROM
// Secrets (npx wrangler secret put ...): SUPABASE_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY

import { planAllows, verifyStripeSignature, readCookie, json } from './lib.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/learn/')) return await serveModule(request, env, url);
      if (url.pathname === '/api/checkout' && request.method === 'POST') return await checkout(request, env);
      if (url.pathname === '/api/stripe-webhook' && request.method === 'POST') return await stripeWebhook(request, env);
      if (url.pathname === '/api/contact' && request.method === 'POST') return await contact(request, env);
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    } catch (e) {
      console.error(e);
      return json({ error: 'Something went wrong on our side. Please try again.' }, 500);
    }
    return env.ASSETS.fetch(request);
  }
};

// ---------- Supabase helpers ----------

async function getUser(env, token) {
  if (!token) return null;
  const r = await fetch(env.SUPABASE_URL + '/auth/v1/user', {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token }
  });
  return r.ok ? r.json() : null;
}

async function myPlan(env, token) {
  const r = await fetch(env.SUPABASE_URL + '/rest/v1/rpc/my_plan', {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: '{}'
  });
  return r.ok ? r.json() : null;
}

// Server-side database writes, using the secret key (bypasses the row rules on purpose).
async function db(env, path, method, body, prefer) {
  const r = await fetch(env.SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      // New-style secret keys (sb_secret_...) go on the apikey header only: Supabase
      // rejects them as a Bearer token. Old JWT-style service keys still need both.
      ...(/^eyJ/.test(env.SUPABASE_SECRET_KEY || '') ? { Authorization: 'Bearer ' + env.SUPABASE_SECRET_KEY } : {}),
      'Content-Type': 'application/json',
      Prefer: prefer || 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error('Database ' + method + ' ' + path.split('?')[0] + ' failed: ' + r.status + ' ' + detail.slice(0, 500));
    throw new Error('Database ' + method + ' failed: ' + r.status);
  }
  return r.status === 204 ? null : r.json();
}

// ---------- Modules behind the login ----------

// A module is many files (page, styles, script, fonts, PDFs), so remember each login's plan for a minute
// rather than asking the login service again for every file.
const planCache = new Map();

async function planFor(env, token) {
  const hit = planCache.get(token);
  if (hit && hit.until > Date.now()) return hit;
  const user = await getUser(env, token);
  const entry = { user: !!user, plan: user ? await myPlan(env, token) : null, until: Date.now() + 60000 };
  if (planCache.size > 500) planCache.clear();
  planCache.set(token, entry);
  return entry;
}

async function serveModule(request, env, url) {
  const id = (url.pathname.split('/')[2] || '').toUpperCase();
  const token = readCookie(request.headers.get('Cookie'), 'gw_session');
  const back = '/login.html?next=' + encodeURIComponent('play.html?m=' + id);
  const who = token ? await planFor(env, token) : { user: false };
  if (!who.user) return Response.redirect(new URL(back, url).toString(), 302);
  if (!planAllows(who.plan, id)) return Response.redirect(new URL('/my-learning.html?locked=' + id, url).toString(), 302);
  const res = await env.ASSETS.fetch(request);
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'private, no-store');
  return out;
}

// ---------- Checkout ----------

async function checkout(request, env) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const user = await getUser(env, token);
  if (!user) return json({ error: 'Please log in or create an account first.' }, 401);
  const body = await request.json().catch(function () { return {}; });
  const plan = body.plan === 'foundations' ? 'foundations' : body.plan === 'full' ? 'full' : null;
  const seats = Math.floor(Number(body.seats));
  if (!plan) return json({ error: 'Choose a plan.' }, 400);
  if (!(seats >= 1 && seats <= 499)) return json({ error: 'Choose between 1 and 499 learners. For 500 or more, ask us for a quote.' }, 400);

  const price = plan === 'full' ? env.STRIPE_PRICE_FULL : env.STRIPE_PRICE_FOUNDATIONS;
  const form = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': price,
    'line_items[0][quantity]': String(seats),
    customer_email: user.email,
    client_reference_id: user.id,
    'metadata[plan]': plan,
    'metadata[seats]': String(seats),
    'subscription_data[metadata][plan]': plan,
    success_url: env.SITE_URL + '/my-learning.html?paid=1',
    cancel_url: env.SITE_URL + '/pricing.html?cancelled=1'
  });
  const r = await fetch(stripeApi(env) + 'checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const s = await r.json();
  if (!r.ok) { console.error('Stripe', s); return json({ error: 'We couldn\'t start the payment. Please try again.' }, 502); }
  return json({ url: s.url });
}

// ---------- Stripe tells us about payments ----------

async function stripeWebhook(request, env) {
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: 'Bad signature' }, 400);
  const event = JSON.parse(raw);
  const o = event.data.object;

  if (event.type === 'checkout.session.completed' && o.mode === 'subscription') {
    const existing = await db(env, 'licences?stripe_subscription=eq.' + encodeURIComponent(o.subscription) + '&select=id', 'GET');
    if (existing.length) return json({ received: true });            // Stripe can send an event twice
    const sub = await stripeGet(env, 'subscriptions/' + o.subscription);
    const plan = o.metadata.plan;
    const seats = Number(o.metadata.seats);
    const email = (o.customer_details && o.customer_details.email) || o.customer_email;
    const team = (await db(env, 'teams', 'POST', { name: seats === 1 ? 'Personal' : 'My team', created_by: o.client_reference_id }))[0];
    await db(env, 'licences', 'POST', {
      team_id: team.id, plan, seats, status: 'active',
      renews_at: new Date(periodEnd(sub) * 1000).toISOString(),
      stripe_customer: o.customer, stripe_subscription: o.subscription
    });
    // The buyer is the admin, and takes a seat (team admins can change this in stage 2).
    await db(env, 'members', 'POST', { team_id: team.id, email: email.toLowerCase(), user_id: o.client_reference_id, role: 'admin', learner: true });
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const status = event.type === 'customer.subscription.deleted' || o.status === 'canceled' ? 'cancelled'
      : o.status === 'past_due' || o.status === 'unpaid' ? 'past_due' : 'active';
    const qty = o.items && o.items.data && o.items.data[0] ? o.items.data[0].quantity : undefined;
    const patch = { status, renews_at: new Date(periodEnd(o) * 1000).toISOString() };
    if (qty) patch.seats = qty;
    await db(env, 'licences?stripe_subscription=eq.' + encodeURIComponent(o.id), 'PATCH', patch, 'return=minimal');
  }
  return json({ received: true });
}

// Stripe moved current_period_end from the subscription onto its items in 2025; read either.
function periodEnd(sub) {
  if (sub.current_period_end) return sub.current_period_end;
  const item = sub.items && sub.items.data && sub.items.data[0];
  return item && item.current_period_end ? item.current_period_end : Math.floor(Date.now() / 1000) + 365 * 86400;
}

// The outside services can be swapped for stand-ins when testing (STRIPE_API, RESEND_API).
function stripeApi(env) { return env.STRIPE_API || 'https://api.stripe.com/v1/'; }

async function stripeGet(env, path) {
  const r = await fetch(stripeApi(env) + path, { headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY } });
  if (!r.ok) throw new Error('Stripe GET ' + path + ' failed: ' + r.status);
  return r.json();
}

// ---------- Contact form ----------

async function contact(request, env) {
  const b = await request.json().catch(function () { return {}; });
  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().slice(0, 200);
  const message = String(b.message || '').trim().slice(0, 5000);
  if (b.website) return json({ ok: true });                         // hidden field: bots fill it in
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) return json({ error: 'Please add your name, a valid email address and a message.' }, 400);
  const lines = [
    'Name: ' + name, 'Email: ' + email, 'Organisation: ' + String(b.organisation || '-').slice(0, 200),
    'About: ' + String(b.topic || '-').slice(0, 100), 'Learners: ' + String(b.learners || '-').slice(0, 20), '', message
  ].join('\n');
  await sendEmail(env, { to: env.CONTACT_TO, reply_to: email, subject: 'Website enquiry: ' + String(b.topic || 'General question').slice(0, 100), text: lines });
  await sendEmail(env, {
    to: email,
    subject: 'We\'ve got your message',
    text: 'Hi ' + name + ',\n\nThanks for getting in touch with Groundwork AI Training. This is a copy of your message so you know it arrived. We\'ll get back to you.\n\n---\n' + lines + '\n\nGroundwork AI Training'
  });
  return json({ ok: true });
}

async function sendEmail(env, m) {
  const r = await fetch((env.RESEND_API || 'https://api.resend.com/') + 'emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ from: env.EMAIL_FROM || 'Groundwork AI Training <hello@' + new URL(env.SITE_URL).hostname + '>' }, m))
  });
  if (!r.ok) throw new Error('Email failed: ' + r.status + ' ' + (await r.text()));
}
