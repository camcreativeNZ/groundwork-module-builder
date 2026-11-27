'use strict';
// Pretend versions of the outside services (login service and database, Stripe, Resend),
// so the whole website can be tested on one computer without real accounts or payments.
// Only the parts the website uses are copied, and only roughly.
const http = require('http');

function standIns() {
  const state = { users: [], teams: [], licences: [], members: [], progress: [], emails: [], checkouts: [] };
  const SECRET = 'stand-in-secret-key';
  let n = 0;
  const id = function (p) { n++; return p + '-' + n; };

  function session(u) {
    return {
      access_token: 'tok-' + u.id, token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'ref-' + u.id,
      user: { id: u.id, email: u.email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() }
    };
  }
  function who(req) {
    const t = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (t === SECRET) return 'admin';
    return state.users.find(function (u) { return 'tok-' + u.id === t; }) || null;
  }
  function planOf(uid) {
    const teams = state.members.filter(function (m) { return m.user_id === uid && m.learner; }).map(function (m) { return m.team_id; });
    const live = state.licences.filter(function (l) { return teams.includes(l.team_id) && l.status !== 'cancelled' && new Date(l.renews_at) > new Date(); });
    return live.some(function (l) { return l.plan === 'full'; }) ? 'full' : live.some(function (l) { return l.plan === 'foundations'; }) ? 'foundations' : null;
  }
  // PostgREST-style filters: ?col=eq.value
  function filters(url) {
    const f = [];
    url.searchParams.forEach(function (v, k) { if (v.startsWith('eq.')) f.push([k, decodeURIComponent(v.slice(3))]); });
    return function (row) { return f.every(function (p) { return String(row[p[0]]) === p[1]; }); };
  }

  const server = http.createServer(function (req, res) {
    let body = '';
    req.on('data', function (c) { body += c; });
    req.on('end', function () {
      const url = new URL(req.url, 'http://x');
      const p = url.pathname;
      const send = function (status, data, type) {
        res.writeHead(status, { 'Content-Type': type || 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
        res.end(data === undefined ? '' : typeof data === 'string' && type ? data : JSON.stringify(data));
      };
      if (req.method === 'OPTIONS') return send(204);
      const json = function () { try { return JSON.parse(body || '{}'); } catch (e) { return {}; } };
      const me = who(req);

      // ----- Login service -----
      if (p === '/auth/v1/signup') {
        const b = json();
        if (state.users.find(function (u) { return u.email === b.email; })) return send(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
        const u = { id: id('user'), email: b.email, password: b.password };
        state.users.push(u);
        state.members.filter(function (m) { return m.email === u.email && !m.user_id; }).forEach(function (m) { m.user_id = u.id; });
        return send(200, session(u));
      }
      if (p === '/auth/v1/token') {
        const b = json();
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          const u = state.users.find(function (x) { return 'ref-' + x.id === b.refresh_token; });
          return u ? send(200, session(u)) : send(400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
        }
        const u = state.users.find(function (x) { return x.email === b.email && x.password === b.password; });
        return u ? send(200, session(u)) : send(400, { error: 'invalid_grant', error_code: 'invalid_credentials', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' });
      }
      if (p === '/auth/v1/user') {
        if (!me || me === 'admin') return send(401, { msg: 'invalid JWT' });
        if (req.method === 'PUT') { me.password = json().password || me.password; }
        return send(200, session(me).user);
      }
      if (p === '/auth/v1/logout') return send(204);
      if (p === '/auth/v1/recover') return send(200, {});

      // ----- Database -----
      if (p === '/rest/v1/rpc/my_plan') return send(200, me && me !== 'admin' ? planOf(me.id) : null);
      const table = p.startsWith('/rest/v1/') ? p.slice(9) : null;
      if (table && state[table]) {
        const rows = state[table];
        const match = filters(url);
        if (req.method === 'GET') {
          let out = rows.filter(match);
          if (me !== 'admin') {
            if (!me) return send(401, { message: 'no user' });
            if (table === 'progress') out = out.filter(function (r) { return r.user_id === me.id; });
          }
          if (/vnd\.pgrst\.object/.test(req.headers.accept || '')) {
            return out.length === 1 ? send(200, out[0]) : send(406, { code: 'PGRST116', message: 'no rows', details: 'The result contains 0 rows' });
          }
          return send(200, out);
        }
        if (req.method === 'POST') {
          let b = json();
          b = Array.isArray(b) ? b : [b];
          if (me !== 'admin' && (table !== 'progress' || !me || b.some(function (r) { return r.user_id !== me.id; }) || !planOf(me.id))) return send(403, { message: 'row rules say no' });
          const made = b.map(function (r) {
            if (table === 'progress') {
              const old = rows.find(function (x) { return x.user_id === r.user_id && x.module_id === r.module_id; });
              if (old) return Object.assign(old, r);
            }
            const row = Object.assign({ id: id(table) }, r);
            rows.push(row);
            return row;
          });
          return send(201, made);
        }
        if (req.method === 'PATCH') {
          if (me !== 'admin') return send(403, { message: 'row rules say no' });
          const b = json();
          rows.filter(match).forEach(function (r) { Object.assign(r, b); });
          return send(204);
        }
      }

      // ----- Stripe -----
      if (p === '/stripe/checkout/sessions' && req.method === 'POST') {
        const form = Object.fromEntries(new URLSearchParams(body));
        const s = { id: id('cs'), form: form, url: 'http://127.0.0.1:' + server.address().port + '/stripe/pay' };
        state.checkouts.push(s);
        return send(200, { id: s.id, url: s.url });
      }
      if (p.startsWith('/stripe/subscriptions/')) {
        return send(200, { id: p.split('/').pop(), status: 'active', items: { data: [{ quantity: 1, current_period_end: Math.floor(Date.now() / 1000) + 365 * 86400 }] } });
      }
      if (p === '/stripe/pay') return send(200, '<!doctype html><title>Stand-in payment page</title><h1>Stand-in payment page</h1>', 'text/html');

      // ----- Email -----
      if (p === '/resend/emails' && req.method === 'POST') { state.emails.push(json()); return send(200, { id: id('email') }); }

      send(404, { error: 'stand-in does not know ' + req.method + ' ' + p });
    });
  });
  return { server, state, SECRET, planOf };
}

module.exports = { standIns };
