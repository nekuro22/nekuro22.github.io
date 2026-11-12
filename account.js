// Gemeinsame Logik für Login, Freundes-Bereich und Adminboard.
// Die Seiten selbst enthalten nichts Geheimes: Inhalte und Rechte kommen nur
// nach dem Login vom Backend (options.json → api_base).

const KEY = 'nl_token';

export const token = {
  get() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
  set(t) { try { localStorage.setItem(KEY, t); } catch { } },
  clear() { try { localStorage.removeItem(KEY); } catch { } },
};

export async function apiBase() {
  try {
    const o = await fetch('options.json', { cache: 'no-cache' }).then(r => r.json());
    return String(o.api_base || '').replace(/\/+$/, '');
  } catch { return ''; }
}

export async function api(base, method, path, body) {
  let r;
  try {
    r = await fetch(base + path, {
      method,
      headers: {
        ...(token.get() ? { Authorization: 'Bearer ' + token.get() } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Der Server ist gerade nicht erreichbar. Versuch es gleich noch einmal.'), { status: 0 });
  }
  let d = null;
  try { d = await r.json(); } catch { }
  if (r.status === 401) token.clear();
  if (!r.ok) throw Object.assign(new Error((d && d.error) || 'Das hat nicht geklappt. Versuch es noch einmal.'), { status: r.status });
  return d;
}

// Token oder Fehlermeldung aus dem #-Teil übernehmen (Rückkehr vom GitHub-Login)
export function takeHash() {
  if (!location.hash) return '';
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('token')) token.set(h.get('token'));
  history.replaceState(null, '', location.pathname + location.search);
  return h.get('error') || '';
}

export function toLogin() {
  location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
}

export const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function show(el, text, kind = 'error') {
  el.textContent = text;
  el.className = kind;
  el.hidden = !text;
}
