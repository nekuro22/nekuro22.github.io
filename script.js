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

  let drawnW = 0, drawnH = 0;
  function draw() {
    const w = window.innerWidth;
    const h = Math.max(window.innerHeight, screen.height || 0);
    if (w === drawnW && h <= drawnH) return;
    drawnW = w; drawnH = h;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const perLayer = Math.round((w * h) / 9000);
    layers.forEach(c => {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < perLayer; i++) {
        const r = (Math.random() * 2.4 + 0.4) / 2;
        ctx.globalAlpha = Math.random() * 0.7 + 0.3;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, r, 0, 6.2832);
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
  // GitHub Pages liefert /maintenance.html unter /maintenance aus, beides zählt
  const onMaintenance = /\/maintenance(\.html)?\/?$/.test(window.location.pathname);

  try {
    const response = await fetch('options.json', {
      cache: 'no-cache',
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (response.ok) {
      const options = await response.json();
      maintenanceActive = options.maintenance_mode === true;
    }
  } catch (e) {
    maintenanceActive = false;
  }

  if (maintenanceActive && !onMaintenance) {
    window.location.replace('maintenance.html');
    return;
  }

  if (!onMaintenance) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createStars);
    } else {
      createStars();
    }
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
      const ext = /^https?:/.test(url);
      const ic = icon ? `<img src="${esc(icon)}" alt="" width="48" height="48" loading="lazy" decoding="async">` : `<span class="noicon" aria-hidden="true">${esc(title.charAt(0).toUpperCase())}</span>`;
      return `<li>${ic}<div><h2>${esc(title)}</h2><p>${esc(text)}</p><p class="owner">${esc(meta)}</p></div><a class="go" href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${ext ? 'Auf GitHub' : 'Ansehen'}</a></li>`;
    };

    Promise.all([loadPinned(), loadRepos()]).then(([pinned, repos]) => {
      if (!pinned.length && !repos.length) return;
      let html = '';
      if (pinned.length) {
        html += '<ul class="plist">' + pinned.map(p => item(p.title, p.text, 'Von ' + (p.owner || 'Niklas Leidert'), p.url, p.icon)).join('') + '</ul>';
      }
      if (repos.length) {
        html += '<h2 class="sec plist-head">Beliebteste öffentliche Repos</h2><ul class="plist">' + repos.map(r => {
          const parts = [];
          if (r.lang) parts.push(r.lang);
          parts.push(r.stars === 1 ? '1 Stern' : r.stars + ' Sterne');
          parts.push('zuletzt ' + month(r.pushed));
          return item(r.name, r.text || 'Keine Beschreibung.', parts.join(', '), r.url);
        }).join('') + '</ul>';
      }
      list.innerHTML = html;
    });
  }
})();