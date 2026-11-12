// Cloudflare Pages-Funktion für alle Anfragen dieser Seite.
// 1. admin.niklas-leidert.de zeigt nur den Ordner admin/.
// 2. HTML-Seiten mit dem Schutz-Skript (protect.js mit data-page="…") werden erst nach
//    der Prüfung beim Backend ausgeliefert. Ohne Login kommt nur ein Hinweis, nicht der Inhalt.

const DEFAULT_API = 'https://api.niklas-leidert.de';

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  let res;
  if (url.hostname.startsWith('admin.')) {
    if (!url.pathname.startsWith('/admin/')) url.pathname = '/admin' + (url.pathname === '/' ? '/' : url.pathname);
    res = await env.ASSETS.fetch(new Request(url, request));
    res = new Response(res.body, res);
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('Referrer-Policy', 'same-origin');
    return res;
  }

  res = await next();
  if (!(res.headers.get('Content-Type') || '').includes('text/html')) return res;
  const html = await res.text();
  const page = protectedPage(html);
  if (!page) return new Response(html, res);

  const api = String(env.GATE_API || DEFAULT_API).replace(/\/+$/, '');
  let status = 503, d = { message: 'Die Seite kann gerade nicht prüfen, ob du angemeldet bist. Versuch es gleich noch einmal.' };
  try {
    const r = await fetch(`${api}/api/gate?page=${encodeURIComponent(page)}&url=${encodeURIComponent(url.origin + url.pathname + url.search)}`, {
      headers: { Cookie: request.headers.get('Cookie') || '' },
    });
    status = r.status;
    d = await r.json();
  } catch { }

  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (status === 200) return new Response(html, { status: res.status, headers });
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.delete('Content-Length');
  return new Response(gatePage(d.message || 'Kein Zugang.', d.login), { status: status === 401 ? 401 : 403, headers });
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

function gatePage(message, login) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Private Page: Niklas-Leidert.de</title>
<link rel="icon" href="/favicon.ico">
<style>
body { margin: 0; min-height: 100dvh; display: grid; place-items: center; background: oklch(11% 0.012 265); color: oklch(96% 0.005 265); font: 1rem/1.55 system-ui, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; }
main { max-width: 420px; }
h1 { font-size: 2.5rem; line-height: 1.05; letter-spacing: -0.03em; margin: 0 0 12px; }
p { margin: 0 0 24px; color: oklch(84% 0.01 265); }
a.btn { display: inline-flex; align-items: center; min-height: 48px; padding: 0 20px; background: oklch(68% 0.16 255); color: oklch(14% 0.02 265); font-weight: 700; text-decoration: none; border-radius: 4px; }
a { color: inherit; }
a:focus-visible { outline: 2px solid oklch(82% 0.12 255); outline-offset: 2px; }
</style>
</head>
<body>
<main>
<h1>Private Page.</h1>
<p>${esc(message)}</p>
${login ? `<a class="btn" href="${esc(login)}">Anmelden</a>` : '<a href="https://niklas-leidert.de/">Zur Startseite</a>'}
</main>
</body>
</html>`;
}
