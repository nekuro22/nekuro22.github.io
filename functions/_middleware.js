// Cloudflare Pages-Funktion für alle Anfragen dieser Seite.
// 1. admin.niklas-leidert.de zeigt nur den Ordner admin/.
// 2. privat.niklas-leidert.de/<pfad>/… zeigt ein anderes Pages-Projekt (im Adminboard festgelegt),
//    erst nach der Prüfung beim Backend. Ohne Login kommt nur ein Hinweis, nicht der Inhalt.
// 3. HTML-Seiten dieser Seite mit dem Schutz-Skript (protect.js mit data-page="…") werden erst
//    nach der Prüfung beim Backend ausgeliefert.

const DEFAULT_API = 'https://api.niklas-leidert.de';
const DOMAIN = 'niklas-leidert.de';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const api = String(env.GATE_API || DEFAULT_API).replace(/\/+$/, '');

  if (url.hostname.startsWith('admin.')) {
    if (!url.pathname.startsWith('/admin/')) url.pathname = '/admin' + (url.pathname === '/' ? '/' : url.pathname);
    const a = await env.ASSETS.fetch(new Request(url, request));
    const res = new Response(a.body, a);
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'same-origin');
    // Nur eigene Skripte: eingeschleuster Code soll das Admin-Token nicht lesen können
    res.headers.set('Content-Security-Policy', "frame-ancestors 'none'; script-src 'self'; object-src 'none'; base-uri 'none'");
    return res;
  }

  if (url.hostname === 'privat.' + DOMAIN || url.hostname.startsWith('privat.')) return privat(request, url, api);

  // Ohne Range: Ein Teilstück ohne <head> würde die Prüfung unten umgehen
  const res = await next(withoutRange(request));
  if (!(res.headers.get('Content-Type') || '').includes('text/html')) return res;
  const html = await res.text();
  const page = protectedPage(html);
  if (!page) return new Response(html, res);

  const d = await gate(api, page, url, request);
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (d.code === 200) return new Response(html, { status: res.status, headers });
  return gateResponse(d, headers);
}

// ---------- privat.niklas-leidert.de/<pfad>/… ----------
async function privat(request, url, api) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Nur GET', { status: 405 });
  const m = url.pathname.match(/^\/([a-z0-9-]+)(\/.*)?$/i);
  if (!m) return Response.redirect(`https://${DOMAIN}/private-pages`, 302);
  const path = m[1].toLowerCase();
  if (m[2] === undefined) return Response.redirect(`${url.origin}/${path}/${url.search}`, 301); // damit relative Links stimmen

  let route = null;
  try {
    const r = await fetch(`${api}/api/route?path=${encodeURIComponent(path)}`);
    if (r.ok) route = await r.json();
  } catch { }
  if (!route || !/^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(route.origin || '')) {
    return gateResponse({ code: 404, message: 'Unter dieser Adresse liegt nichts.' }, new Headers({ 'Cache-Control': 'no-store' }));
  }

  // Jede Anfrage prüfen, auch Bilder und Skripte
  const d = await gate(api, route.page, url, request);
  const headers = new Headers({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  if (d.code !== 200 || !d.ticket) return gateResponse(d, headers);

  const up = new URL(route.origin);
  up.pathname = m[2];
  up.search = url.search;
  const fwd = new Headers({ 'X-NL-Ticket': d.ticket });
  for (const h of ['Accept', 'Accept-Language', 'User-Agent', 'Range']) if (request.headers.get(h)) fwd.set(h, request.headers.get(h));
  let res;
  try {
    res = await fetch(up.toString(), { method: request.method, headers: fwd, redirect: 'manual' });
  } catch {
    return gateResponse({ code: 502, message: 'Die Seite ist gerade nicht erreichbar. Versuch es gleich noch einmal.' }, headers);
  }
  // Nur harmlose Header des Projekts übernehmen
  const out = new Response(res.body, { status: res.status, statusText: res.statusText });
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Content-Language', 'ETag', 'Last-Modified']) {
    if (res.headers.get(h)) out.headers.set(h, res.headers.get(h));
  }
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('X-Frame-Options', 'DENY');
  // Weiterleitungen nur innerhalb des Projekts, auf den Pfad unter privat. umgeschrieben
  const loc = res.headers.get('Location');
  if (loc) {
    let to = null;
    try {
      const u = new URL(loc, up);
      if (u.origin === route.origin) to = `/${path}${u.pathname}${u.search}`;
    } catch { }
    if (!to) return gateResponse({ code: 502, message: 'Die Seite leitet auf eine fremde Adresse weiter.' }, headers);
    out.headers.set('Location', to);
  }
  out.headers.set('Cache-Control', 'private, no-store');
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  out.headers.set('Referrer-Policy', 'same-origin');
  return out;
}

// ---------- gemeinsam ----------
function withoutRange(request) {
  if (!request.headers.has('Range') && !request.headers.has('If-Range')) return request;
  const h = new Headers(request.headers);
  h.delete('Range'); h.delete('If-Range');
  return new Request(request, { headers: h });
}

async function gate(api, page, url, request) {
  try {
    const r = await fetch(`${api}/api/gate?page=${encodeURIComponent(page)}&url=${encodeURIComponent(url.origin + url.pathname + url.search)}`, {
      headers: { Cookie: request.headers.get('Cookie') || '' },
    });
    return { ...(await r.json()), code: r.status }; // code = HTTP-Status, status = Text vom Backend
  } catch {
    return { code: 503, message: 'Die Seite kann gerade nicht prüfen, ob du angemeldet bist. Versuch es gleich noch einmal.' };
  }
}

function gateResponse(d, headers) {
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.delete('Content-Length');
  headers.delete('ETag');
  const code = d.code === 401 ? 401 : d.code === 404 ? 404 : d.code >= 500 ? d.code : 403;
  return new Response(gatePage(d.message || 'Kein Zugang.', d.login, d.canonical), { status: code, headers });
}

// Sucht <script … protect.js … data-page="name"> im HTML
function protectedPage(html) {
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    if (!/protect\.js/i.test(tag)) continue;
    const m = tag.match(/data-page\s*=\s*["']?([a-z0-9-]+)/i);
    if (m) return m[1].toLowerCase();
  }
  return '';
}

const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeLink = u => { try { const x = new URL(u); return x.protocol === 'https:' && (x.hostname === DOMAIN || x.hostname.endsWith('.' + DOMAIN)) ? x.toString() : ''; } catch { return ''; } };

function gatePage(message, login, canonical) {
  const go = safeLink(canonical), li = safeLink(login);
  const action = go ? `<a class="btn" href="${esc(go)}">Zur richtigen Adresse</a><p class="small">${esc(go)}</p>`
    : li ? `<a class="btn" href="${esc(li)}">Anmelden</a>` : `<a href="https://${DOMAIN}/">Zur Startseite</a>`;
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Private Page: Niklas-Leidert.de</title>
<style>
body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: oklch(11% 0.012 265); color: oklch(96% 0.005 265); font: 1rem/1.55 system-ui, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; }
main { max-width: 460px; }
h1 { font-size: 2.5rem; line-height: 1.05; letter-spacing: -0.03em; margin: 0 0 12px; }
p { margin: 0 0 24px; color: oklch(84% 0.01 265); }
p.small { margin: 12px 0 0; font-size: 0.875rem; color: oklch(70% 0.015 265); overflow-wrap: anywhere; }
a.btn { display: inline-flex; align-items: center; min-height: 48px; padding: 0 20px; background: oklch(68% 0.16 255); color: oklch(14% 0.02 265); font-weight: 700; text-decoration: none; border-radius: 4px; }
a { color: inherit; }
a:focus-visible { outline: 2px solid oklch(82% 0.12 255); outline-offset: 2px; }
</style>
</head>
<body>
<main>
<h1>Private Page.</h1>
<p>${esc(message)}</p>
${action}
</main>
</body>
</html>`;
}
