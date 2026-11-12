import { apiBase, api, token, takeHash, show } from './account.js';

const msg = document.getElementById('msg');
const form = document.getElementById('f');
const next = (() => {
  const n = new URLSearchParams(location.search).get('next') || 'freunde.html';
  return /^[a-z0-9-]+\.html(\?[^#]*)?$/i.test(n) ? n : 'freunde.html'; // nur eigene Seiten
})();

const hashError = takeHash();
const base = await apiBase();

if (!base) {
  show(msg, 'Der Login ist noch nicht eingerichtet.');
} else {
  // Schon angemeldet (oder gerade von GitHub zurück)? Dann direkt weiter.
  if (token.get()) {
    try { await api(base, 'GET', '/api/auth/me'); location.replace(next); } catch { }
  }
  if (hashError) show(msg, hashError);
  try {
    const cfg = await api(base, 'GET', '/api/auth/config');
    if (cfg.github) {
      const back = location.origin + location.pathname + '?next=' + encodeURIComponent(next);
      document.getElementById('gh').href = base + '/api/auth/github?return=' + encodeURIComponent(back);
      document.getElementById('gh-wrap').hidden = false;
    }
    form.hidden = false;
  } catch (e) {
    show(msg, e.message);
  }

  let busy = false;
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (busy) return; // ein Tipp = eine Aktion
    busy = true;
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Meldet an …';
    try {
      const d = await api(base, 'POST', '/api/auth/login', { name: form.name.value, password: form.password.value });
      token.set(d.token);
      location.replace(next);
    } catch (e) {
      show(msg, e.message);
      btn.disabled = false;
      btn.textContent = 'Anmelden';
      busy = false;
    }
  });
}
