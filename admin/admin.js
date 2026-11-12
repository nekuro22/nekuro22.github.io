// Adminboard: eigenständig, damit der Ordner als eigene Seite (admin.niklas-leidert.de)
// laufen kann. Alle Daten und Rechte kommen vom Backend, die Seite selbst ist leer.
import { marked } from './vendor/marked.esm.js';

const $ = id => document.getElementById(id);
const KEY = 'nl_admin_token';
const token = {
  get() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } },
  set(t) { try { localStorage.setItem(KEY, t); } catch { } },
  clear() { try { localStorage.removeItem(KEY); } catch { } },
};
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function say(text, kind = 'ok', html = false) {
  const m = $('msg');
  if (html) m.innerHTML = text; else m.textContent = text;
  m.className = kind;
  m.hidden = !text;
  if (text) m.scrollIntoView({ block: 'nearest' });
}

async function loadBase() {
  for (const f of ['config.json', '../options.json']) {
    try {
      const o = await fetch(f, { cache: 'no-cache' }).then(r => r.json());
      if (o.api_base) return String(o.api_base).replace(/\/+$/, '');
    } catch { }
  }
  return '';
}

let base = '';
async function api(method, path, body) {
  let r;
  try {
    r = await fetch(base + path, {
      method,
      headers: { ...(token.get() ? { Authorization: 'Bearer ' + token.get() } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
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

// Ein Tipp = eine Aktion: Knopf sperren, bis die Antwort da ist
async function busy(btn, label, fn) {
  if (btn.disabled) return;
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try { await fn(); } catch (e) { say(e.message, 'error'); if (e.status === 401) showLogin(); }
  finally { btn.disabled = false; btn.textContent = old; }
}

// ---------- Anmeldung ----------
async function showLogin(error = '') {
  $('board').hidden = true;
  $('logout').hidden = true;
  $('loading').hidden = true;
  $('login').hidden = false;
  if (error) say(error, 'error');
  try {
    const cfg = await api('GET', '/api/auth/config');
    if (cfg.github) {
      $('gh').href = base + '/api/auth/github?return=' + encodeURIComponent(location.origin + location.pathname);
      $('gh').hidden = false;
    }
  } catch (e) { say(e.message, 'error'); }
}

$('login-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('login-form').querySelector('button'), 'Meldet an …', async () => {
    const d = await api('POST', '/api/auth/login', { name: $('l-name').value, password: $('l-pw').value });
    token.set(d.token);
    say('');
    await start();
  });
});
$('logout').addEventListener('click', () => { token.clear(); say(''); showLogin(); });

// ---------- Seiten ----------
const slugify = t => t.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
let editing = null; // slug der Seite im Editor
let slugTouched = false;

function newPage() {
  editing = null; slugTouched = false;
  $('editor-title').textContent = 'Neue Seite';
  $('p-title').value = ''; $('p-slug').value = ''; $('p-content').value = '';
  $('p-slug').readOnly = false;
  $('p-preview').hidden = true;
}

async function loadPages() {
  const pages = await api('GET', '/api/pages');
  $('page-list').innerHTML = pages.length ? pages.map(p => `<li>
    <div><div class="name">${esc(p.title)}</div><div class="note">freunde.html?p=${esc(p.slug)}, geändert am ${esc(new Date(p.updated).toLocaleDateString('de-DE'))}</div></div>
    <div class="btns"><button class="ghost small" data-edit="${esc(p.slug)}">Bearbeiten</button><button class="ghost small" data-del-page="${esc(p.slug)}" data-title="${esc(p.title)}">Löschen</button></div>
  </li>`).join('') : '<li class="empty">Noch keine Seiten.</li>';
}

$('p-title').addEventListener('input', () => { if (!editing && !slugTouched) $('p-slug').value = slugify($('p-title').value); });
$('p-slug').addEventListener('input', () => { slugTouched = true; });
$('p-new').addEventListener('click', newPage);
$('p-preview-btn').addEventListener('click', () => {
  const pv = $('p-preview');
  pv.hidden = !pv.hidden;
  if (!pv.hidden) pv.innerHTML = marked.parse($('p-content').value || '*Noch leer.*');
});
$('page-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('page-form').querySelector('.btn'), 'Speichert …', async () => {
    const slug = $('p-slug').value.trim();
    await api('PUT', '/api/pages/' + encodeURIComponent(slug), { title: $('p-title').value, content: $('p-content').value });
    say(`Gespeichert. Freunde sehen die Seite unter freunde.html?p=${slug}.`);
    editing = slug; $('p-slug').readOnly = true; $('editor-title').textContent = 'Seite bearbeiten';
    await loadPages();
  });
});
$('page-list').addEventListener('click', ev => {
  const b = ev.target.closest('button');
  if (!b) return;
  if (b.dataset.edit) {
    busy(b, 'Lädt …', async () => {
      const p = await api('GET', '/api/pages/' + encodeURIComponent(b.dataset.edit));
      editing = p.slug;
      $('editor-title').textContent = 'Seite bearbeiten';
      $('p-title').value = p.title; $('p-slug').value = p.slug; $('p-slug').readOnly = true; $('p-content').value = p.content;
      $('p-preview').hidden = true;
      $('page-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (b.dataset.delPage) {
    if (!confirm(`Seite „${b.dataset.title}" löschen? Das lässt sich nicht rückgängig machen.`)) return;
    busy(b, 'Löscht …', async () => {
      await api('DELETE', '/api/pages/' + encodeURIComponent(b.dataset.delPage));
      if (editing === b.dataset.delPage) newPage();
      say('Seite gelöscht.');
      await loadPages();
    });
  }
});

// ---------- Freunde ----------
async function loadFriends() {
  const f = await api('GET', '/api/admin/friends');
  $('user-list').innerHTML = f.users.length ? f.users.map(u => `<li>
    <div><div class="name">${esc(u.name)}</div><div class="note">${u.fixed ? 'aus der Konfiguration, dort ändern' : u.added ? 'seit ' + esc(new Date(u.added).toLocaleDateString('de-DE')) : ''}</div></div>
    ${u.fixed ? '' : `<div class="btns"><button class="ghost small" data-del-user="${esc(u.name)}">Entfernen</button></div>`}
  </li>`).join('') : '<li class="empty">Noch niemand.</li>';
  $('gh-list').innerHTML = f.github.length ? f.github.map(g => `<li>
    <div><div class="name">${esc(g.login)}</div>${g.fixed ? '<div class="note">aus der Konfiguration, dort ändern</div>' : ''}</div>
    ${g.fixed ? '' : `<div class="btns"><button class="ghost small" data-del-gh="${esc(g.login)}">Sperren</button></div>`}
  </li>`).join('') : '<li class="empty">Noch niemand.</li>';
  $('gh-hint').hidden = f.githubReady;
}

$('user-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('user-form').querySelector('.btn'), 'Legt an …', async () => {
    const d = await api('POST', '/api/admin/users', { name: $('u-name').value, password: $('u-pw').value });
    if (d.password) say(`${esc(d.name)} ist angelegt. Das Passwort wird nur jetzt angezeigt, gib es weiter:<span class="secret">${esc(d.password)}</span>`, 'ok', true);
    else say(`${d.name} ist angelegt.`);
    $('u-name').value = ''; $('u-pw').value = '';
    await loadFriends();
  });
});
$('user-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-del-user]');
  if (!b || !confirm(`${b.dataset.delUser} entfernen? Der Zugang endet sofort.`)) return;
  busy(b, 'Entfernt …', async () => { await api('DELETE', '/api/admin/users/' + encodeURIComponent(b.dataset.delUser)); say('Freund entfernt.'); await loadFriends(); });
});
$('gh-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('gh-form').querySelector('.btn'), 'Schaltet frei …', async () => {
    await api('POST', '/api/admin/github', { login: $('g-name').value });
    say('GitHub-Konto freigeschaltet.'); $('g-name').value = '';
    await loadFriends();
  });
});
$('gh-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-del-gh]');
  if (!b || !confirm(`${b.dataset.delGh} sperren? Der Zugang endet sofort.`)) return;
  busy(b, 'Sperrt …', async () => { await api('DELETE', '/api/admin/github/' + encodeURIComponent(b.dataset.delGh)); say('GitHub-Konto gesperrt.'); await loadFriends(); });
});
$('pw-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('pw-form').querySelector('.btn'), 'Ändert …', async () => {
    await api('POST', '/api/admin/password', { current: $('pw-old').value, password: $('pw-new').value });
    $('pw-old').value = ''; $('pw-new').value = '';
    say('Dein Passwort ist geändert.');
  });
});
$('logout-all').addEventListener('click', ev => {
  if (!confirm('Wirklich alle abmelden, auch dich?')) return;
  busy(ev.currentTarget, 'Meldet ab …', async () => { await api('POST', '/api/admin/logout-all'); token.clear(); showLogin(); say('Alle wurden abgemeldet.'); });
});

// ---------- Start ----------
async function start() {
  if (!token.get()) return showLogin();
  let me;
  try { me = await api('GET', '/api/auth/me'); } catch (e) { return showLogin(e.status === 401 ? '' : e.message); }
  if (!me.admin) { token.clear(); return showLogin('Dieses Konto hat keinen Zugang zum Adminboard.'); }
  $('who').textContent = me.name;
  $('pw-sec').hidden = me.via !== 'password';
  $('login').hidden = true;
  $('logout').hidden = false;
  try { await Promise.all([loadPages(), loadFriends()]); } catch (e) { say(e.message, 'error'); }
  $('loading').hidden = true;
  $('board').hidden = false;
}

(async () => {
  // Rückkehr vom GitHub-Login: Token oder Fehler steht im #-Teil
  let hashError = '';
  if (location.hash) {
    const h = new URLSearchParams(location.hash.slice(1));
    if (h.get('token')) token.set(h.get('token'));
    hashError = h.get('error') || '';
    history.replaceState(null, '', location.pathname + location.search);
  }
  base = await loadBase();
  if (!base) { $('loading').hidden = true; say('Das Backend ist noch nicht eingetragen (config.json → api_base).', 'error'); return; }
  if (hashError) { await showLogin(hashError); return; }
  await start();
})();
