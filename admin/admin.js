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
$('logout').addEventListener('click', async () => { try { await api('POST', '/api/auth/logout'); } catch { } token.clear(); say(''); showLogin(); });

// ---------- Wer darf sehen? (Umschalter) ----------
let accounts = []; // [{ tag, label }]
const ACCESS = [['all', 'Alle'], ['friends', 'Nur Freunde'], ['some', 'Einzelne Accounts']];
const accessLabel = r => r.access === 'all' ? 'für alle' : r.access === 'some' ? `für ${(r.allow || []).length} ${(r.allow || []).length === 1 ? 'Account' : 'Accounts'}` : 'nur Freunde';
let widgetId = 0;
function accessWidget(rec = {}) {
  const id = 'acc' + (++widgetId);
  const a = rec.access || 'friends';
  const allow = new Set(rec.allow || []);
  return `<fieldset class="access"><legend>Wer darf die Seite sehen?</legend>
    <div class="seg" role="radiogroup">${ACCESS.map(([v, l]) => `<label><input type="radio" name="${id}" value="${v}"${a === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <div class="pick"${a === 'some' ? '' : ' hidden'}>${accounts.length
      ? accounts.map(x => `<label class="chk"><input type="checkbox" value="${esc(x.tag)}"${allow.has(x.tag) ? ' checked' : ''}><span>${esc(x.label)}</span></label>`).join('')
      : '<span class="muted">Noch keine Freunde angelegt.</span>'}</div>
  </fieldset>`;
}
function readWidget(root) {
  const access = (root.querySelector('.access input[type=radio]:checked') || {}).value || 'friends';
  const allow = [...root.querySelectorAll('.access .pick input:checked')].map(i => i.value);
  if (access === 'some' && !allow.length) throw new Error('Wähle mindestens einen Account aus, der die Seite sehen darf.');
  return { access, allow };
}
document.addEventListener('change', e => {
  if (e.target.matches('.access input[type=radio]')) e.target.closest('.access').querySelector('.pick').hidden = e.target.value !== 'some';
});

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
  $('p-access').innerHTML = accessWidget();
}

async function loadPages() {
  const pages = await api('GET', '/api/pages');
  $('page-list').innerHTML = pages.length ? pages.map(p => `<li>
    <div><div class="name">${esc(p.title)}</div><div class="note">${esc(accessLabel(p))}, freunde.html?p=${esc(p.slug)}, geändert am ${esc(new Date(p.updated).toLocaleDateString('de-DE'))}</div></div>
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
    await api('PUT', '/api/pages/' + encodeURIComponent(slug), { title: $('p-title').value, content: $('p-content').value, ...readWidget($('page-form')) });
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
      $('p-access').innerHTML = accessWidget(p);
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

// ---------- Eigene HTML-Seiten (Schutz-Skript) ----------
const STATUS = { pending: 'wartet auf Freigabe', accepted: 'freigegeben', rejected: 'abgelehnt' };
async function loadGates() {
  const gates = await api('GET', '/api/admin/gates');
  const rp = $('r-page'), keepP = rp.value;
  rp.innerHTML = gates.length ? gates.map(g => `<option value="${esc(g.name)}">${esc(g.name)}</option>`).join('') : '<option value="">Erst eine Seite mit Schutz-Skript aufrufen</option>';
  if (keepP) rp.value = keepP;
  $('gate-list').innerHTML = gates.length ? gates.map(g => `<li data-gate="${esc(g.name)}">
    <div class="gate-info">
      <div class="name">${esc(g.name)} <span class="badge ${esc(g.status)}">${esc(STATUS[g.status] || g.status)}</span>${g.status === 'accepted' ? ` <span class="note">${esc(accessLabel(g))}</span>` : ''}</div>
      ${g.seen ? `<div class="note">gesehen auf <a href="${esc(g.seen.url)}" target="_blank" rel="noopener">${esc(g.seen.url)}</a></div>` : ''}
      <label class="small-label" for="dom-${esc(g.name)}">Erlaubte Domain oder Subdomain</label>
      <input class="dom" id="dom-${esc(g.name)}" value="${esc((g.domains || []).join(', '))}" placeholder="spiel.niklas-leidert.de" autocapitalize="none" spellcheck="false" />
      ${accessWidget(g)}
    </div>
    <div class="btns">
      <button class="btn small" data-act="accepted">${g.status === 'accepted' ? 'Speichern' : 'Freigeben'}</button>
      ${g.status === 'rejected' ? '' : '<button class="ghost small" data-act="rejected">Ablehnen</button>'}
      <button class="ghost small" data-act="delete">Löschen</button>
    </div>
  </li>`).join('') : '<li class="empty">Noch keine Seite mit Schutz-Skript aufgerufen.</li>';
}
$('gate-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-act]');
  if (!b) return;
  const li = b.closest('li'); const name = li.dataset.gate;
  if (b.dataset.act === 'delete') {
    if (!confirm(`„${name}" aus der Liste löschen? Ruft jemand die Seite wieder auf, erscheint sie erneut als wartend.`)) return;
    return busy(b, 'Löscht …', async () => { await api('DELETE', '/api/admin/gates/' + encodeURIComponent(name)); say('Gelöscht.'); await loadGates(); });
  }
  busy(b, b.dataset.act === 'accepted' ? 'Speichert …' : 'Lehnt ab …', async () => {
    await api('PUT', '/api/admin/gates/' + encodeURIComponent(name), { status: b.dataset.act, domains: li.querySelector('.dom').value, ...readWidget(li) });
    say(b.dataset.act === 'accepted' ? `„${name}" ist freigegeben. Angemeldete Freunde sehen die Seite jetzt.` : `„${name}" ist abgelehnt.`);
    await loadGates();
  });
});
$('copy-snippet').addEventListener('click', async ev => {
  try { await navigator.clipboard.writeText($('snippet').textContent); ev.currentTarget.textContent = 'Kopiert'; }
  catch { say('Kopieren ging nicht. Markiere die Zeile und kopiere sie von Hand.', 'error'); }
});

// ---------- Adressen unter privat. ----------
async function loadRoutes() {
  const routes = await api('GET', '/api/admin/routes');
  $('route-list').innerHTML = routes.length ? routes.map(r => `<li>
    <div><div class="name"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a></div><div class="note">zeigt ${esc(r.origin.replace('https://', ''))}, Seite „${esc(r.page)}"</div></div>
    <div class="btns"><button class="ghost small" data-del-route="${esc(r.path)}">Entfernen</button></div>
  </li>`).join('') : '<li class="empty">Noch keine Adresse festgelegt.</li>';
}
$('route-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('route-form').querySelector('.btn'), 'Speichert …', async () => {
    const path = $('r-path').value.trim().toLowerCase();
    const r = await api('PUT', '/api/admin/routes/' + encodeURIComponent(path), { origin: $('r-origin').value, page: $('r-page').value });
    say(`Festgelegt: ${r.url}`);
    $('r-path').value = ''; $('r-origin').value = '';
    await loadRoutes();
  });
});
$('route-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-del-route]');
  if (!b || !confirm(`privat.niklas-leidert.de/${b.dataset.delRoute} entfernen?`)) return;
  busy(b, 'Entfernt …', async () => { await api('DELETE', '/api/admin/routes/' + encodeURIComponent(b.dataset.delRoute)); say('Adresse entfernt.'); await loadRoutes(); });
});

// ---------- Einmal-Links ----------
async function loadInvites() {
  const inv = await api('GET', '/api/admin/invites');
  $('invite-list').innerHTML = inv.length ? inv.map(i => `<li>
    <div><div class="name">für ${esc(i.name)}</div><div class="note">gültig bis ${esc(new Date(i.exp).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }))}</div></div>
    <div class="btns"><button class="ghost small" data-del-invite="${esc(i.id)}">Widerrufen</button></div>
  </li>`).join('') : '<li class="empty">Kein offener Link.</li>';
}
$('invite-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('invite-form').querySelector('.btn'), 'Erstellt …', async () => {
    const d = await api('POST', '/api/admin/invites', { account: $('i-acc').value, hours: Number($('i-hours').value) });
    say(`Link für ${esc(d.name)}. Er wird nur jetzt angezeigt und funktioniert einmal:<span class="secret" id="invite-url">${esc(d.url)}</span><button class="ghost small" type="button" id="copy-invite">Kopieren</button>`, 'ok', true);
    $('copy-invite').addEventListener('click', async e => {
      try { await navigator.clipboard.writeText(d.url); e.currentTarget.textContent = 'Kopiert'; } catch { }
    });
    await loadInvites();
  });
});
$('invite-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-del-invite]');
  if (!b || !confirm('Diesen Link widerrufen?')) return;
  busy(b, 'Widerruft …', async () => { await api('DELETE', '/api/admin/invites/' + encodeURIComponent(b.dataset.delInvite)); say('Link widerrufen.'); await loadInvites(); });
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
  $('link-list').innerHTML = (f.links || []).length ? f.links.map(l => `<li>
    <div><div class="name">${esc(l.github)} (GitHub) = ${esc(l.user)}</div>${l.fixed ? '<div class="note">aus der Konfiguration, dort ändern</div>' : ''}</div>
    ${l.fixed ? '' : `<div class="btns"><button class="ghost small" data-unlink="${esc(l.github)}">Lösen</button></div>`}
  </li>`).join('') : '<li class="empty">Noch keine Verknüpfung.</li>';
  const ia = $('i-acc'), keepA = ia.value;
  ia.innerHTML = accounts.map(a => `<option value="${esc(a.tag)}">${esc(a.label)}</option>`).join('');
  if (keepA) ia.value = keepA;
  const sel = $('lk-user'), keep = sel.value;
  sel.innerHTML = f.users.map(u => `<option value="${esc(u.name)}">${esc(u.name)}</option>`).join('');
  if (keep) sel.value = keep;
  accounts = [...f.users.map(u => ({ tag: u.tag || 'pw:' + u.name, label: u.name + ' (Passwort)' })), ...f.github.map(g => ({ tag: g.tag || 'github:' + g.login, label: g.login + ' (GitHub)' }))];
  // Auswahl im Seiten-Editor mit den neuen Accounts neu zeichnen, aktuelle Wahl behalten
  if ($('p-access').firstChild) {
    const root = $('page-form');
    const cur = {
      access: (root.querySelector('.access input[type=radio]:checked') || {}).value || 'friends',
      allow: [...root.querySelectorAll('.access .pick input:checked')].map(i => i.value),
    };
    $('p-access').innerHTML = accessWidget(cur);
  }
}

$('user-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('user-form').querySelector('.btn'), 'Legt an …', async () => {
    const d = await api('POST', '/api/admin/users', { name: $('u-name').value, password: $('u-pw').value });
    if (d.password) say(`${esc(d.name)} ist angelegt. Das Passwort wird nur jetzt angezeigt, gib es weiter:<span class="secret">${esc(d.password)}</span>`, 'ok', true);
    else say(`${d.name} ist angelegt.`);
    $('u-name').value = ''; $('u-pw').value = '';
    await loadFriends(); await loadGates();
  });
});
$('user-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-del-user]');
  if (!b || !confirm(`${b.dataset.delUser} entfernen? Der Zugang endet sofort.`)) return;
  busy(b, 'Entfernt …', async () => { await api('DELETE', '/api/admin/users/' + encodeURIComponent(b.dataset.delUser)); say('Freund entfernt.'); await loadFriends(); await loadGates(); });
});
$('link-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('link-form').querySelector('.btn'), 'Verknüpft …', async () => {
    await api('POST', '/api/admin/links', { github: $('lk-gh').value, user: $('lk-user').value });
    say(`${$('lk-gh').value.trim()} ist jetzt mit ${$('lk-user').value} verknüpft.`); $('lk-gh').value = '';
    await loadFriends();
  });
});
$('link-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-unlink]');
  if (!b || !confirm(`Verknüpfung von ${b.dataset.unlink} lösen? Eine Anmeldung über GitHub endet sofort.`)) return;
  busy(b, 'Löst …', async () => { await api('DELETE', '/api/admin/links/' + encodeURIComponent(b.dataset.unlink)); say('Verknüpfung gelöst.'); await loadFriends(); });
});
$('gh-form').addEventListener('submit', ev => {
  ev.preventDefault();
  busy(ev.submitter || $('gh-form').querySelector('.btn'), 'Schaltet frei …', async () => {
    await api('POST', '/api/admin/github', { login: $('g-name').value });
    say('GitHub-Konto freigeschaltet.'); $('g-name').value = '';
    await loadFriends(); await loadGates();
  });
});
$('gh-list').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-del-gh]');
  if (!b || !confirm(`${b.dataset.delGh} sperren? Der Zugang endet sofort.`)) return;
  busy(b, 'Sperrt …', async () => { await api('DELETE', '/api/admin/github/' + encodeURIComponent(b.dataset.delGh)); say('GitHub-Konto gesperrt.'); await loadFriends(); await loadGates(); });
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
  try { await loadFriends(); await Promise.all([loadPages(), loadGates(), loadRoutes(), loadInvites()]); newPage(); } catch (e) { say(e.message, 'error'); }
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
