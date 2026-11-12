// Cloudflare Pages: admin.niklas-leidert.de zeigt nur den Ordner admin/.
// Alle anderen Adressen bekommen die normale Seite.
export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  if (!url.hostname.startsWith('admin.')) return next();
  if (!url.pathname.startsWith('/admin/')) {
    url.pathname = '/admin' + (url.pathname === '/' ? '/' : url.pathname);
  }
  const res = await env.ASSETS.fetch(new Request(url, request));
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('Referrer-Policy', 'same-origin');
  return out;
}
