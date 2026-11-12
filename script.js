// Handy: Menü-Knopf für die Navigation (ohne JavaScript bleiben die Links sichtbar)
(() => {
  document.documentElement.classList.add('js');
  const nav = document.querySelector('.navbar');
  if (!nav || nav.querySelector('.nav-menu')) return;
  const links = nav.querySelector('.nav-links');
  if (!links) return;
  links.id = links.id || 'nav-links';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-menu';
  btn.textContent = 'Menü';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', links.id);
  nav.insertBefore(btn, links);
  const set = open => { nav.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? 'Schließen' : 'Menü'; };
  btn.addEventListener('click', () => set(!nav.classList.contains('open')));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { set(false); btn.focus(); } });
  links.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
})();

// ========== STERNENHIMMEL ==========
// Zwei Canvas-Ebenen, einmal gezeichnet. Nur die Deckkraft der Ebenen
// pulsiert (läuft auf der GPU), statt 900 einzeln animierter Elemente.
function createStars() {
  if (document.getElementById('stars-container')) return;

  const container = document.createElement('div');
  container.id = 'stars-container';
  container.style.cssText = 'position:fixed;inset:0;z-index:-2;pointer-events:none';
  const layers = [0, 1].map(i => {
    const c = document.createElement('canvas');
    c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;animation:twinkleAnim ${i ? 9 : 6}s ease-in-out ${i ? -4 : 0}s infinite alternate`;
    container.appendChild(c);
    return c;
  });
  document.body.appendChild(container);

  if (!document.getElementById('star-anim-style')) {
    const style = document.createElement('style');
    style.id = 'star-anim-style';
    style.textContent = `
      @keyframes twinkleAnim { from { opacity: 0.35; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { #stars-container canvas { animation: none !important; } }
    `;
    document.head.appendChild(style);
  }

  // Fester Zufall: auf jeder Seite derselbe Himmel, kein Springen beim Seitenwechsel
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  let drawnW = 0, drawnH = 0;
  function draw() {
    const w = window.innerWidth;
    const h = Math.max(window.innerHeight, screen.height || 0);
    if (w === drawnW && h <= drawnH) return;
    drawnW = w; drawnH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const perLayer = Math.round((w * h) / 9000);
    layers.forEach((c, li) => {
      const rand = rng(1337 + li);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < perLayer; i++) {
        const r = (rand() * 2.4 + 0.4) / 2;
        ctx.globalAlpha = rand() * 0.7 + 0.3;
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, r, 0, 6.2832);
        ctx.fill();
      }
    });
  }
  draw();
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); });
}

// ========== WARTUNGSMODUS + PROJEKTE ==========
(async function () {
  let maintenanceActive = false;
  let apiBase = '';
  // GitHub Pages liefert /maintenance.html unter /maintenance aus, beides zählt
  const onMaintenance = /\/maintenance(\.html)?\/?$/.test(window.location.pathname);
  // Himmel sofort zeichnen, nicht erst nach dem Laden der Optionen
  if (document.body) createStars(); else document.addEventListener('DOMContentLoaded', createStars);

  try {
    const response = await fetch('options.json', {
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (response.ok) {
      const options = await response.json();
      maintenanceActive = options.maintenance_mode === true;
      if (typeof options.api_base === 'string') apiBase = options.api_base.replace(/\/+$/, '');
      // Link zum Freundes-Bereich, sobald das Backend eingetragen ist
      if (apiBase) {
        const links = document.querySelector('.nav-links');
        const gh = links && links.querySelector('.nav-github');
        if (links && !links.querySelector('.nav-friends')) {
          const a = document.createElement('a');
          a.href = 'freunde.html';
          a.className = 'nav-friends';
          a.textContent = 'Private Pages';
          if (/\/(freunde|admin|login)(\.html)?$/.test(location.pathname)) a.setAttribute('aria-current', 'page');
          links.insertBefore(a, gh);
        }
      }
    }
  } catch (e) {
    maintenanceActive = false;
  }

  if (maintenanceActive && !onMaintenance) {
    window.location.replace('maintenance.html');
    return;
  }

  // Projekte: angeheftete aus projects.json, dazu die beliebtesten öffentlichen GitHub-Repos
  const list = document.getElementById('projects-list');
  if (list) {
    const GH_USER = 'nekuro22';
    const SKIP = [GH_USER + '.github.io'];
    const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const month = d => new Date(d).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    const loadPinned = () => fetch('projects.json').then(r => r.ok ? r.json() : []).catch(() => []);
    const loadRepos = async () => {
      const key = 'gh-repos-' + GH_USER;
      try {
        const c = JSON.parse(localStorage.getItem(key) || 'null');
        if (c && Date.now() - c.t < 3600e3) return c.d;
      } catch (e) { }
      // Zuerst das eigene Backend fragen, falls eingetragen
      if (apiBase) {
        try {
          const r = await fetch(apiBase + '/api/projects');
          if (r.ok) {
            const d = await r.json();
            if (Array.isArray(d)) {
              try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) { }
              return d;
            }
          }
        } catch (e) { }
      }
      try {
        const r = await fetch(`https://api.github.com/users/${GH_USER}/repos?per_page=100&type=owner`);
        if (!r.ok) throw 0;
        const d = (await r.json())
          .filter(x => !x.fork && !x.private && !x.archived && !SKIP.includes(x.name))
          .sort((a, b) => b.stargazers_count - a.stargazers_count || new Date(b.pushed_at) - new Date(a.pushed_at))
          .slice(0, 6)
          .map(x => ({ name: x.name, text: x.description, url: x.html_url, lang: x.language, stars: x.stargazers_count, pushed: x.pushed_at }));
        try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) { }
        return d;
      } catch (e) {
        try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) return c.d; } catch (e2) { }
        return [];
      }
    };

    const item = (title, text, meta, url, icon) => {
      const desc = text ? `<p>${esc(text)}</p>` : '';
      const ext = /^https?:/.test(url);
      const ic = icon ? `<img src="${esc(icon)}" alt="" width="48" height="48" loading="lazy" decoding="async">` : `<span class="noicon" aria-hidden="true">${esc(title.charAt(0).toUpperCase())}</span>`;
      return `<li>${ic}<div><h2>${esc(title)}</h2>${desc}<p class="owner">${esc(meta)}</p></div><a class="go" href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${ext ? 'Auf GitHub' : 'Ansehen'}</a></li>`;
    };

    const render = (pinned, repos) => {
      if (!pinned.length && !repos.length) { list.innerHTML = '<p class="owner">Gerade keine Projekte abrufbar. Schau auf GitHub vorbei.</p>'; return; }
      let html = '';
      if (pinned.length) {
        html += '<ul class="plist">' + pinned.map(p => item(p.title, p.text, 'Von ' + (p.owner || 'Niklas Leidert'), p.url, p.icon)).join('') + '</ul>';
      }
      if (repos.length) {
        html += '<h2 class="sec plist-head">Beliebteste öffentliche Repos</h2><ul class="plist">' + repos.map(r => {
          const parts = [];
          if (r.lang) parts.push(r.lang);
          if (r.stars > 0) parts.push(r.stars === 1 ? '1 Stern' : r.stars + ' Sterne');
          parts.push('zuletzt ' + month(r.pushed));
          return item(r.name, r.text || '', parts.join(', ').replace(/^./, c => c.toUpperCase()), r.url);
        }).join('') + '</ul>';
      }
      if (list.dataset.html === html) return;
      list.dataset.html = html;
      list.innerHTML = html;
      list.classList.add('loaded');
    };
    // Sofort aus dem Zwischenspeicher zeichnen, dann frisch laden
    try {
      const c = JSON.parse(localStorage.getItem('gh-repos-' + GH_USER) || 'null');
      const p = JSON.parse(localStorage.getItem('pinned') || 'null');
      if (c && p) render(p, c.d);
    } catch (e) { }
    Promise.all([loadPinned(), loadRepos()]).then(([pinned, repos]) => {
      try { localStorage.setItem('pinned', JSON.stringify(pinned)); } catch (e) { }
      render(pinned, repos);
    });
  }
})();