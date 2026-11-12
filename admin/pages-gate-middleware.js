// Schutz für geschützte HTML-Seiten in einem Cloudflare-Pages-Projekt.
// In das Projekt kopieren als: functions/_middleware.js
// Seiten mit <script src="https://api.niklas-leidert.de/protect.js" data-page="…"> werden erst
// ausgeliefert, wenn das Backend sie freigibt. Ohne Freigabe kommt nur ein Hinweis, nicht der Inhalt.
// Erreichbar über eine Subdomain von niklas-leidert.de oder über privat.niklas-leidert.de/<pfad>.

const API = 'https://api.niklas-leidert.de';

export async function onRequest({ request, next }) {
  const res = await next();
  if (!(res.headers.get('Content-Type') || '').includes('text/html')) return res;
  const html = await res.text();
  const page = protectedPage(html);
  if (!page) return new Response(html, res);

  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');

  // Aufruf über privat.niklas-leidert.de: Der Proxy hat schon geprüft und schickt ein Ticket mit
  const ticket = request.headers.get('X-NL-Ticket');
  if (ticket) {
    try {
      const t = await fetch(`${API}/api/gate/ticket?page=${encodeURIComponent(page)}&t=${encodeURIComponent(ticket)}`);
      if (t.ok) return new Response(html, { status: res.status, headers });
    } catch { }
  }

  const url = new URL(request.url);
  let status = 503, d = { message: 'Die Seite kann gerade nicht prüfen, ob du angemeldet bist. Versuch es gleich noch einmal.' };
  try {
    const r = await fetch(`${API}/api/gate?page=${encodeURIComponent(page)}&url=${encodeURIComponent(url.origin + url.pathname + url.search)}`, {
      headers: { Cookie: request.headers.get('Cookie') || '' },
    });
    status = r.status;
    d = await r.json();
  } catch { }

  if (status === 200) return new Response(html, { status: res.status, headers });
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.delete('Content-Length');
  headers.delete('ETag');
  return new Response(gatePage(d.message || 'Kein Zugang.', d.login, d.canonical), { status: status === 401 ? 401 : 403, headers });
}

function protectedPage(html) {
  for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
    if (!/protect\.js/i.test(tag)) continue;
    const m = tag.match(/data-page\s*=\s*["']?([a-z0-9-]+)/i);
    if (m) return m[1].toLowerCase();
  }
  return '';
}

const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeLink = u => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)niklas-leidert\.de$/.test(x.hostname) ? x.toString() : ''; } catch { return ''; } };

function gatePage(message, login, canonical) {
  const go = safeLink(canonical), li = safeLink(login);
  const action = go ? `<a class="btn" href="${esc(go)}">Zur richtigen Adresse</a><p class="small">${esc(go)}</p>`
    : li ? `<a class="btn" href="${esc(li)}">Anmelden</a>` : '<a href="https://niklas-leidert.de/">Zur Startseite</a>';
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Private Page</title>
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
