// Small pure helpers for the website server, kept separate so they can be tested.

// Which modules a plan opens. Foundations opens F1 to F8; the full suite opens everything.
export function planAllows(plan, moduleId) {
  if (!/^[FPAML]\d{1,2}$/.test(moduleId || '')) return false;
  if (plan === 'full') return true;
  if (plan === 'foundations') return moduleId.charAt(0) === 'F';
  return false;
}

export function readCookie(header, name) {
  if (!header) return null;
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const i = p.indexOf('=');
    if (i > 0 && p.slice(0, i) === name) return decodeURIComponent(p.slice(i + 1));
  }
  return null;
}

export function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

// Checks Stripe's signature header (t=...,v1=...) with the webhook secret. Rejects events older than 5 minutes.
export async function verifyStripeSignature(payload, header, secret, now) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(function (kv) { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  const t = Number(parts.t);
  const v1s = header.split(',').filter(function (kv) { return kv.startsWith('v1='); }).map(function (kv) { return kv.slice(3); });
  if (!t || !v1s.length) return false;
  const seconds = Math.floor((now || Date.now()) / 1000);
  if (Math.abs(seconds - t) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(t + '.' + payload));
  const hex = Array.from(new Uint8Array(sig)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  return v1s.some(function (v) { return timingSafeEqual(v, hex); });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
