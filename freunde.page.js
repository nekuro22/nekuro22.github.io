import { apiBase, api, token, takeHash, toLogin, esc, show } from './account.js';
import { marked } from './vendor/marked.esm.js';

const $ = id => document.getElementById(id);
takeHash();
const base = await apiBase();
const slug = new URLSearchParams(location.search).get('p');

async function main() {
  if (!base) { $('loading').hidden = true; show($('msg'), 'Der Login ist noch nicht eingerichtet.'); return; }
  if (!token.get()) return toLogin();
  let me;
  try { me = await api(base, 'GET', '/api/auth/me'); } catch (e) {
    if (e.status === 401) return toLogin();
    $('loading').hidden = true; show($('msg'), e.message); return;
  }

  if (slug) {
    try {
      const pg = await api(base, 'GET', '/api/pages/' + encodeURIComponent(slug));
      document.title = pg.title + ': Niklas-Leidert.de';
      $('page-title').textContent = pg.title;
      $('page-body').innerHTML = marked.parse(pg.content || ''); // Inhalt schreibt nur der Admin
      $('page-view').hidden = false;
    } catch (e) {
      show($('msg'), e.message);
    }
    $('loading').hidden = true;
    return;
  }

  $('who').textContent = ', ' + me.name;
  if (me.admin) $('admin-link').hidden = false;
  try {
    const pages = await api(base, 'GET', '/api/pages');
    $('pages').innerHTML = pages.map(p => `<li><span class="noicon" aria-hidden="true">${esc(p.title.charAt(0).toUpperCase())}</span><div><h2>${esc(p.title)}</h2><p class="owner">Aktualisiert am ${esc(new Date(p.updated).toLocaleDateString('de-DE'))}</p></div><a class="go" href="freunde.html?p=${encodeURIComponent(p.slug)}">Öffnen</a></li>`).join('');
    $('empty').hidden = pages.length > 0;
  } catch (e) {
    show($('msg'), e.message);
  }
  $('loading').hidden = true;
  $('list-view').hidden = false;
}

$('logout').addEventListener('click', () => { token.clear(); location.replace('login.html'); });
main();
